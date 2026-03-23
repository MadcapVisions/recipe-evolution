import "server-only";

import { callAIForJson } from "./jsonResponse";
import type { LockedDirectionRefinement, LockedDirectionSelected } from "./contracts/lockedDirectionSession";
import type { ResolvedIngredientIntent } from "./ingredientResolutionTypes";
import { extractRefinementDelta } from "./refinementExtractor";
import { buildDistilledIngredientIntent, normalizeIngredientPhrase } from "./ingredientCanonicalization";
import { resolveIngredientPhrase } from "./ingredientResolver";
import { isHardConstraintConfident, isSoftPreferenceConfident } from "./ingredientResolutionPolicy";
import type { AiTaskSettingRecord } from "./taskSettings";

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}

function sanitizeIngredientValues(values: unknown[] | undefined) {
  return unique(
    (values ?? [])
      .filter((value): value is string => typeof value === "string")
      .map((value) => normalizeIngredientPhrase(value))
      .filter((value): value is string => Boolean(value))
  );
}

function hasStructuredChanges(refinement: LockedDirectionRefinement) {
  return (
    refinement.extracted_changes.required_ingredients.length > 0 ||
    refinement.extracted_changes.preferred_ingredients.length > 0 ||
    refinement.extracted_changes.forbidden_ingredients.length > 0 ||
    refinement.extracted_changes.style_tags.length > 0
  );
}

function demoteAmbiguousStructuredChanges(refinement: LockedDirectionRefinement): LockedDirectionRefinement {
  if (refinement.confidence >= 0.7) {
    return refinement;
  }

  return {
    ...refinement,
    ambiguous_notes: unique([
      ...(refinement.ambiguous_notes ?? []),
      refinement.user_text,
      ...(refinement.assistant_text ? [refinement.assistant_text] : []),
    ]),
    extracted_changes: {
      ...refinement.extracted_changes,
      required_ingredients: [],
      preferred_ingredients: [],
      forbidden_ingredients: [],
      style_tags: [],
    },
    field_state: {
      ...refinement.field_state,
      ingredients: "unknown",
      style: "unknown",
    },
  };
}

export function shouldEscalateRefinementExtraction(refinement: LockedDirectionRefinement) {
  return refinement.confidence < 0.7 || !hasStructuredChanges(refinement);
}

function resolveIngredientList(phrases: string[]): ResolvedIngredientIntent[] {
  return phrases
    .map((phrase) => {
      const resolved = resolveIngredientPhrase(phrase);
      return {
        raw_phrase: phrase,
        label: resolved.display_label ?? resolved.core_phrase ?? phrase,
        canonical_key: resolved.canonical_key,
        canonical_id: resolved.canonical_id,
        family_key: resolved.family_key,
        confidence: resolved.confidence,
        resolution_method: resolved.resolution_method,
      } satisfies ResolvedIngredientIntent;
    })
    .filter((intent) => isHardConstraintConfident(intent.confidence) || isSoftPreferenceConfident(intent.confidence));
}

function normalizeAiRefinement(parsed: unknown, fallback: LockedDirectionRefinement): LockedDirectionRefinement | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const raw = parsed as Record<string, unknown>;
  const extracted = raw.extracted_changes;
  const fieldState = raw.field_state;

  // Compute sanitized ingredient lists up front so they can be reused in both
  // extracted_changes and resolved_ingredient_intents without circular references.
  const sanitizedRequired = sanitizeIngredientValues(
    Array.isArray((extracted as { required_ingredients?: unknown[] } | undefined)?.required_ingredients)
      ? ((extracted as { required_ingredients?: unknown[] }).required_ingredients ?? [])
      : []
  );
  const sanitizedPreferred = sanitizeIngredientValues(
    Array.isArray((extracted as { preferred_ingredients?: unknown[] } | undefined)?.preferred_ingredients)
      ? ((extracted as { preferred_ingredients?: unknown[] }).preferred_ingredients ?? [])
      : []
  );
  const sanitizedForbidden = sanitizeIngredientValues(
    Array.isArray((extracted as { forbidden_ingredients?: unknown[] } | undefined)?.forbidden_ingredients)
      ? ((extracted as { forbidden_ingredients?: unknown[] }).forbidden_ingredients ?? [])
      : []
  );

  const normalized: LockedDirectionRefinement = {
    user_text: fallback.user_text,
    assistant_text: fallback.assistant_text,
    confidence:
      typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
        ? Math.max(0, Math.min(1, raw.confidence))
        : fallback.confidence,
    ambiguity_reason: typeof raw.ambiguity_reason === "string" ? raw.ambiguity_reason.trim() || null : fallback.ambiguity_reason,
    ambiguous_notes: unique(
      Array.isArray(raw.ambiguous_notes)
        ? raw.ambiguous_notes.filter((value): value is string => typeof value === "string")
        : fallback.ambiguous_notes ?? []
    ),
    extracted_changes: {
      required_ingredients: sanitizedRequired,
      preferred_ingredients: sanitizedPreferred,
      forbidden_ingredients: sanitizedForbidden,
      style_tags: unique(Array.isArray((extracted as { style_tags?: unknown[] } | undefined)?.style_tags) ? ((extracted as { style_tags?: unknown[] }).style_tags ?? []).filter((value): value is string => typeof value === "string") : []),
      notes: unique(Array.isArray((extracted as { notes?: unknown[] } | undefined)?.notes) ? ((extracted as { notes?: unknown[] }).notes ?? []).filter((value): value is string => typeof value === "string") : [fallback.user_text]),
    },
    field_state: {
      ingredients:
        (fieldState as { ingredients?: "locked" | "inferred" | "unknown" } | undefined)?.ingredients ?? fallback.field_state.ingredients,
      style:
        (fieldState as { style?: "locked" | "inferred" | "unknown" } | undefined)?.style ?? fallback.field_state.style,
      notes:
        (fieldState as { notes?: "locked" | "inferred" | "unknown" } | undefined)?.notes ?? fallback.field_state.notes,
    },
    distilled_intents: {
      ingredient_additions: sanitizedRequired
        .map((value) => buildDistilledIngredientIntent(value))
        .filter((value): value is NonNullable<LockedDirectionRefinement["distilled_intents"]>["ingredient_additions"][number] => Boolean(value)),
      ingredient_preferences: sanitizedPreferred
        .map((value) => buildDistilledIngredientIntent(value))
        .filter((value): value is NonNullable<LockedDirectionRefinement["distilled_intents"]>["ingredient_preferences"][number] => Boolean(value)),
      ingredient_removals: sanitizedForbidden
        .map((value) => buildDistilledIngredientIntent(value))
        .filter((value): value is NonNullable<LockedDirectionRefinement["distilled_intents"]>["ingredient_removals"][number] => Boolean(value)),
    },
    resolved_ingredient_intents: {
      required: resolveIngredientList(sanitizedRequired),
      preferred: resolveIngredientList(sanitizedPreferred),
      forbidden: resolveIngredientList(sanitizedForbidden),
    },
  };

  return demoteAmbiguousStructuredChanges(normalized);
}

export async function extractRefinementDeltaWithFallback(input: {
  userText: string;
  assistantText: string | null;
  selectedDirection?: LockedDirectionSelected | null;
  taskSetting?: AiTaskSettingRecord | null;
}): Promise<LockedDirectionRefinement> {
  const heuristic = extractRefinementDelta({
    userText: input.userText,
    assistantText: input.assistantText,
  });

  if (!shouldEscalateRefinementExtraction(heuristic)) {
    return heuristic;
  }

  try {
    const result = await callAIForJson(
      [
        {
          role: "system",
          content: `You extract structured refinement constraints for a recipe workflow.
Return only valid JSON with this exact shape:
{
  "confidence": number,
  "ambiguity_reason": string | null,
  "extracted_changes": {
    "required_ingredients": string[],
    "preferred_ingredients": string[],
    "forbidden_ingredients": string[],
    "style_tags": string[],
    "notes": string[]
  },
  "field_state": {
    "ingredients": "locked" | "inferred" | "unknown",
    "style": "locked" | "inferred" | "unknown",
    "notes": "locked" | "inferred" | "unknown"
  }
}

Rules:
- Capture explicit swaps like "use thighs instead of breasts" as required_ingredients=["thighs"], forbidden_ingredients=["breasts"].
- Capture natural preference language like "I'd love jalapeños" or "more garlic please".
- Capture semantic style changes like "more Italian", "feel authentic", "heartier", "lighter", "spicier".
- If the refinement is too vague to enforce, leave arrays empty, set low confidence, and explain ambiguity_reason.
- Never invent a dish pivot. This is a refinement of the existing direction unless the user explicitly abandoned it.
- Notes must always include the original user request.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            selected_direction: input.selectedDirection ?? null,
            user_refinement: input.userText,
            assistant_reply: input.assistantText ?? null,
            heuristic_extraction: heuristic,
          }),
        },
      ],
      {
        model: input.taskSetting?.primaryModel,
        fallback_models: input.taskSetting?.fallbackModel ? [input.taskSetting.fallbackModel] : [],
        temperature: 0.1,
        max_tokens: Math.min(input.taskSetting?.maxTokens ?? 300, 300),
      }
    );

    const normalized = normalizeAiRefinement(result.parsed, heuristic);
    if (!normalized) {
      return heuristic;
    }

    if (!hasStructuredChanges(normalized) && normalized.confidence < heuristic.confidence) {
      return heuristic;
    }

    if (normalized.confidence < 0.7 && heuristic.confidence >= normalized.confidence) {
      return heuristic;
    }

    return normalized;
  } catch {
    return heuristic;
  }
}
