import type { TasteModel, RecipeFeatures, TasteScore } from "@/lib/ai/tasteModel";
import type { PostCookFeedback } from "./postCookFeedbackTypes";

// Post-cook events carry more evidential weight than thumbs-up/down reactions.
// Scores remain bounded by the same [-1, +1] TasteScore system with RETENTION decay.

const OUTCOME_WEIGHTS: Record<string, { recipeWeight: number; strength: number }> = {
  great:             { recipeWeight: +0.9, strength: 1.0 },
  good_with_changes: { recipeWeight: +0.4, strength: 0.7 },
  disappointing:     { recipeWeight: -0.5, strength: 0.7 },
  failed:            { recipeWeight: -0.7, strength: 0.9 },
};

const RETENTION = 0.9;
const CONFIDENCE_GAIN = 0.12; // slightly higher than lightweight feedback (0.10)

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function emptyScore(): TasteScore {
  return { score: 0, confidence: 0, evidenceCount: 0, lastUpdatedAt: new Date().toISOString() };
}

function updateScore(
  current: TasteScore | null | undefined,
  weight: number,
  strength: number
): TasteScore {
  const prev = current ?? emptyScore();
  return {
    score: clamp(prev.score * RETENTION + weight * strength, -1, 1),
    confidence: clamp(prev.confidence + CONFIDENCE_GAIN, 0, 1),
    evidenceCount: prev.evidenceCount + 1,
    lastUpdatedAt: new Date().toISOString(),
  };
}

function updateMany(
  dict: Record<string, TasteScore>,
  keys: string[],
  weight: number,
  strength: number
): Record<string, TasteScore> {
  if (keys.length === 0) return dict;
  const next = { ...dict };
  for (const k of keys) next[k] = updateScore(dict[k], weight, strength);
  return next;
}

/**
 * Apply a post-cook feedback event to the taste model.
 *
 * This is a separate function from applyFeedback() (thumbs-up/down lightweight reactions).
 * Post-cook signals map a broader tag set and use higher signal weights.
 *
 * Design constraints enforced here:
 * - would_make_again = false is version-resurfacing signal only — do not create a broad
 *   cuisine dislike from it. Apply a modest additional dishFamily downrank only.
 * - texture_off / too_wet / too_dry have no current TasteModel dimension. They are silently
 *   skipped here and remain in the raw recipe_postcook_feedback table for Plans C/D.
 * - One noisy event cannot dominate: RETENTION decay bounds score accumulation.
 */
export function applyPostCookFeedback(
  model: TasteModel | null,
  feedback: PostCookFeedback,
  features: RecipeFeatures
): TasteModel {
  const m: TasteModel = model ?? {
    cuisines: {},
    proteins: {},
    flavors: {},
    dishFamilies: {},
    dislikedIngredients: {},
    spiceTolerance: null,
    richnessPreference: null,
  };

  const w = OUTCOME_WEIGHTS[feedback.overall_outcome];

  // Base outcome: reinforce or downrank recipe feature dimensions
  let next: TasteModel = {
    ...m,
    cuisines:     updateMany(m.cuisines,    features.cuisines,  w.recipeWeight, w.strength * 0.70),
    proteins:     updateMany(m.proteins,    features.proteins,  w.recipeWeight, w.strength * 0.60),
    flavors:      updateMany(m.flavors,     features.flavors,   w.recipeWeight, w.strength * 0.50),
    dishFamilies: features.dishFamily
      ? updateMany(m.dishFamilies, [features.dishFamily], w.recipeWeight, w.strength * 0.85)
      : m.dishFamilies,
  };

  // would_make_again = false: reduce resurfacing suitability for this recipe version shape.
  // Applies a modest additional dishFamily downrank — does NOT penalise cuisines or proteins.
  if (feedback.would_make_again === false) {
    next = {
      ...next,
      dishFamilies: features.dishFamily
        ? updateMany(next.dishFamilies, [features.dishFamily], -0.3, 0.5)
        : next.dishFamilies,
    };
  }

  // Issue-tag → score dimension mapping
  for (const tag of feedback.issue_tags) {
    switch (tag) {
      case "too_spicy":
        next = {
          ...next,
          spiceTolerance: updateScore(next.spiceTolerance, -0.8, 1.0),
          flavors: updateMany(next.flavors, ["spicy"], -0.8, 1.0),
        };
        break;

      case "too_heavy":
        next = {
          ...next,
          richnessPreference: updateScore(next.richnessPreference, -0.7, 1.0),
          flavors: updateMany(
            next.flavors,
            features.flavors.filter((f) => ["creamy", "rich"].includes(f)),
            -0.7,
            0.8
          ),
        };
        break;

      case "too_bland":
        // User wants stronger flavor — increase flavorIntensityPreference
        next = {
          ...next,
          flavorIntensityPreference: updateScore(next.flavorIntensityPreference, +0.6, 0.8),
        };
        break;

      case "too_salty":
        // User wants less aggressive seasoning — decrease flavorIntensityPreference
        next = {
          ...next,
          flavorIntensityPreference: updateScore(next.flavorIntensityPreference, -0.5, 0.8),
        };
        break;

      case "too_complex":
      case "too_many_steps":
        next = {
          ...next,
          complexityTolerance: updateScore(next.complexityTolerance, -0.6, 0.9),
        };
        break;

      // texture_off, too_wet, too_dry:
      // No TasteModel dimension for texture/moisture yet.
      // Remain in raw recipe_postcook_feedback for resurfacing logic in Plans C/D.
      default:
        break;
    }
  }

  return next;
}
