import { DISH_FAMILIES, type DishFamily } from "../homeRecipeAlignment";

export type BuildSpecAnchorType = "dish" | "protein" | "ingredient" | "format";

/**
 * A structured, frozen specification for recipe generation derived at direction-lock time.
 * Downstream stages (planner, generator, verifier) read from this — they never re-derive identity.
 *
 * derived_at: "lock_time" is a sentinel ensuring this was set once and not reconstructed later.
 */
export type BuildSpec = {
  dish_family: DishFamily | null;
  display_title: string;               // shown in UI
  build_title: string;                 // passed to generator as the target dish
  primary_anchor_type: BuildSpecAnchorType | null;
  primary_anchor_value: string | null; // e.g. "chicken", "mushrooms", "pizza"
  required_ingredients: string[];
  forbidden_ingredients: string[];
  style_tags: string[];
  must_preserve_format: boolean;       // true when dish_family was explicitly locked (e.g. pizza, pasta)
  confidence: number;                  // 0–1
  derived_at: "lock_time";
  /** Provenance of dish_family — "model" if the chat model provided it, "inferred" if heuristic. */
  dish_family_source: "model" | "inferred";
  /** Provenance of primary_anchor_value. */
  anchor_source: "model" | "inferred" | "none";
};

const ANCHOR_TYPES = new Set(["dish", "protein", "ingredient", "format"]);
const DISH_FAMILY_SET = new Set<string>(DISH_FAMILIES);

/**
 * Runtime guard and normalizer for BuildSpec values from untrusted sources
 * (client payloads, DB rows, old sessions). Returns the value typed as BuildSpec
 * when all fields satisfy the contract, or null to trigger legacy-path fallback.
 *
 * Validates scalars, enums, and constrained values — not just the arrays that
 * would crash. A payload with impossible field values (e.g. dish_family: "stew",
 * dish_family_source: "garbage") is rejected rather than trusted downstream.
 * Invalid specs are always treated as absent, never as hard errors.
 */
export function normalizeBuildSpec(value: unknown): BuildSpec | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Record<string, unknown>;

  // Sentinel — must have been set by deriveBuildSpec, not reconstructed at runtime.
  if (s.derived_at !== "lock_time") return null;

  // Arrays used directly in spread — crash-safety critical.
  if (
    !Array.isArray(s.required_ingredients) ||
    !Array.isArray(s.forbidden_ingredients) ||
    !Array.isArray(s.style_tags)
  ) return null;

  // Provenance enums — downstream debug/logging trusts these values.
  if (s.dish_family_source !== "model" && s.dish_family_source !== "inferred") return null;
  if (s.anchor_source !== "model" && s.anchor_source !== "inferred" && s.anchor_source !== "none") return null;

  // dish_family: must be a canonical family or null.
  if (s.dish_family !== null && (typeof s.dish_family !== "string" || !DISH_FAMILY_SET.has(s.dish_family))) return null;

  // primary_anchor_type: must be a known enum value or null.
  if (s.primary_anchor_type !== null && (typeof s.primary_anchor_type !== "string" || !ANCHOR_TYPES.has(s.primary_anchor_type))) return null;

  // primary_anchor_value: string or null.
  if (s.primary_anchor_value !== null && typeof s.primary_anchor_value !== "string") return null;

  // Required scalars.
  if (typeof s.build_title !== "string") return null;
  if (typeof s.display_title !== "string") return null;
  if (typeof s.must_preserve_format !== "boolean") return null;
  if (typeof s.confidence !== "number") return null;

  return value as BuildSpec;
}
