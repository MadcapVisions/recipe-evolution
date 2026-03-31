// lib/ai/intent/enrichBriefWithIntent.ts
import type { CookingBrief } from "../contracts/cookingBrief";
import type { ResolvedCookingIntent } from "./intentTypes";
import { DISH_FAMILIES } from "../homeRecipeAlignment";

const DISH_FAMILY_SET = new Set<string>(DISH_FAMILIES);

/**
 * Enriches a compiled CookingBrief with semantic data from ResolvedCookingIntent.
 *
 * ONLY applied on the non-locked path. Locked sessions use BuildSpec as the
 * authoritative source for dish identity — this function must never be called
 * for a brief built from a locked session (lockedSession.selected_direction != null).
 *
 * Currently: overrides dish_family when the intent resolver found one with
 * confidence >= 0.7 and the brief has not already locked it. This fixes the
 * core Milestone 1 pain point of wrong dish-intent classification.
 */
export function enrichBriefWithIntent(
  brief: CookingBrief,
  intent: ResolvedCookingIntent
): CookingBrief {
  if (
    intent.dishFamily !== null &&
    DISH_FAMILY_SET.has(intent.dishFamily) &&
    intent.dishFamilyConfidence >= 0.7 &&
    brief.field_state.dish_family !== "locked"
  ) {
    return {
      ...brief,
      dish: { ...brief.dish, dish_family: intent.dishFamily },
      field_state: { ...brief.field_state, dish_family: "inferred" },
    };
  }
  return brief;
}
