import { z } from "zod";

/**
 * Shared Zod schema for validating LockedDirectionSession payloads coming from the client.
 * Used by both /api/ai/home and /api/ai/home/build to parse request bodies.
 */
export const lockedSessionSchema = z.object({
  conversation_key: z.string(),
  state: z.enum(["exploring", "direction_locked", "ready_to_build", "building", "built"]),
  selected_direction: z
    .object({
      id: z.string(),
      title: z.string(),
      summary: z.string(),
      tags: z.array(z.string()),
    })
    .nullable(),
  refinements: z.array(
    z.object({
      user_text: z.string(),
      assistant_text: z.string().nullable(),
      confidence: z.number(),
      ambiguity_reason: z.string().nullable(),
      ambiguous_notes: z.array(z.string()).optional(),
      distilled_intents: z
        .object({
          ingredient_additions: z.array(z.object({ label: z.string(), canonical_key: z.string() })),
          ingredient_preferences: z.array(z.object({ label: z.string(), canonical_key: z.string() })),
          ingredient_removals: z.array(z.object({ label: z.string(), canonical_key: z.string() })),
        })
        .optional(),
      extracted_changes: z.object({
        required_ingredients: z.array(z.string()),
        preferred_ingredients: z.array(z.string()),
        forbidden_ingredients: z.array(z.string()),
        style_tags: z.array(z.string()),
        notes: z.array(z.string()),
      }),
      field_state: z.object({
        ingredients: z.enum(["locked", "inferred", "unknown"]),
        style: z.enum(["locked", "inferred", "unknown"]),
        notes: z.enum(["locked", "inferred", "unknown"]),
      }),
    })
  ),
  brief_snapshot: z.any().nullable(),
  // Invalid or partial objects (e.g. stale client, empty {}) fall back to null via .catch(null)
  // so the session degrades to legacy reconstruction rather than throwing a 500.
  build_spec: z
    .object({
      dish_family: z.string().nullable(),
      display_title: z.string(),
      build_title: z.string(),
      primary_anchor_type: z.enum(["dish", "protein", "ingredient", "format"]).nullable(),
      primary_anchor_value: z.string().nullable(),
      required_ingredients: z.array(z.string()),
      forbidden_ingredients: z.array(z.string()),
      style_tags: z.array(z.string()),
      must_preserve_format: z.boolean(),
      confidence: z.number(),
      derived_at: z.literal("lock_time"),
      dish_family_source: z.enum(["model", "inferred"]).optional().default("inferred"),
      anchor_source: z.enum(["model", "inferred", "none"]).optional().default("none"),
    })
    .nullable()
    .optional()
    .catch(null),
});
