import type { IngredientMatchPolicy } from "./ingredientResolutionTypes";

export const CONFIDENCE_THRESHOLDS = {
  hard_constraint: 0.9,
  soft_preference: 0.75,
  note_only_max: 0.74,
} as const;

export function isHardConstraintConfident(confidence: number): boolean {
  return confidence >= CONFIDENCE_THRESHOLDS.hard_constraint;
}

export function isSoftPreferenceConfident(confidence: number): boolean {
  return confidence >= CONFIDENCE_THRESHOLDS.soft_preference;
}

export function isNoteOnly(confidence: number): boolean {
  return confidence < CONFIDENCE_THRESHOLDS.soft_preference;
}

export const POLICY_FOR_SLOT: Record<
  "required" | "preferred" | "forbidden" | "centerpiece",
  IngredientMatchPolicy
> = {
  required: "canonical_with_family_fallback",
  preferred: "soft_preference",
  forbidden: "strict_canonical",
  centerpiece: "strict_canonical",
};
