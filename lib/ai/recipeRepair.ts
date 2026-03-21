import type { CookingBrief } from "./contracts/cookingBrief";
import type { VerificationResult } from "./contracts/verificationResult";

/**
 * Returns true when the verification failure is caused by dish_family_match = false,
 * which means the model generated a completely different dish. This cannot be fixed
 * by a targeted repair call — it requires full regeneration.
 */
export function shouldEscalateVerification(checks: VerificationResult["checks"]): boolean {
  return !checks.dish_family_match;
}

/**
 * Finds ingredient names that are missing an explicit quantity.
 * An ingredient name without a digit has no quantity (e.g. "olive oil" vs "2 tbsp olive oil").
 */
export function findMissingQuantities(ingredients: Array<{ name: string }>): string[] {
  return ingredients.map((i) => i.name).filter((name) => !/\d/.test(name));
}

/**
 * Builds a list of specific fix instructions based on which verification checks failed.
 * Returns an empty array if nothing is patchable (caller should escalate).
 */
export function buildVerificationRepairInstructions(
  verification: VerificationResult,
  brief: CookingBrief | null | undefined
): string[] {
  const repairs: string[] = [];
  const checks = verification.checks;
  const ing = brief?.ingredients;

  if (!checks.centerpiece_match && ing?.centerpiece) {
    repairs.push(
      `The centerpiece ingredient must be "${ing.centerpiece}". Make it the main ingredient in both the ingredient list and the cooking steps without changing the dish format.`
    );
  }

  if (!checks.required_ingredients_present && ing?.required && ing.required.length > 0) {
    repairs.push(
      `These required ingredients are missing from the recipe: ${ing.required.join(", ")}. Add them naturally to the ingredient list and adjust the steps to use them.`
    );
  }

  if (!checks.forbidden_ingredients_avoided && ing?.forbidden && ing.forbidden.length > 0) {
    repairs.push(
      `Remove any of these forbidden ingredients: ${ing.forbidden.join(", ")}. Replace each with a compatible alternative that preserves the dish.`
    );
  }

  if (!checks.title_quality_pass) {
    repairs.push(
      `Replace the recipe title with a specific, recognizable name a home cook would understand (e.g. "Garlic Butter Shrimp Tostadas", not "Chef Conversation Recipe" or "Chef Special").`
    );
  }

  if (!checks.style_match && brief?.style) {
    const styleHints = [
      ...(brief.style.tags ?? []),
      ...(brief.style.texture_tags ?? []),
      ...(brief.style.format_tags ?? []),
    ].filter(Boolean);
    if (styleHints.length > 0) {
      repairs.push(
        `The recipe should reflect these style cues: ${styleHints.join(", ")}. Adjust technique and ingredients to match without changing the dish family.`
      );
    }
  }

  return repairs;
}
