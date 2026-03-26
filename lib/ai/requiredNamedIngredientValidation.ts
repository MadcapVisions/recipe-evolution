import type { RequiredNamedIngredient } from "./requiredNamedIngredient";
import { ingredientMentionedInSteps, matchesRequiredIngredient } from "./requiredNamedIngredient";

export type RequiredNamedIngredientValidationIssue = {
  code: "RECIPE_MISSING_REQUIRED_NAMED_INGREDIENT" | "STEP_MISSING_REQUIRED_INGREDIENT_USAGE";
  severity: "error";
  message: string;
};

export function validateRequiredNamedIngredientsInRecipe(params: {
  ingredients: Array<{ ingredientName: string; normalizedName?: string | null }>;
  steps: Array<{ text: string; methodTag?: string | null }>;
  requiredNamedIngredients?: RequiredNamedIngredient[] | null;
}): RequiredNamedIngredientValidationIssue[] {
  const issues: RequiredNamedIngredientValidationIssue[] = [];
  const hardRequired = (params.requiredNamedIngredients ?? []).filter(
    (req) => req.requiredStrength === "hard"
  );

  for (const req of hardRequired) {
    const presentInIngredients = params.ingredients.some((ing) =>
      matchesRequiredIngredient(ing.normalizedName || ing.ingredientName, req)
    );
    if (!presentInIngredients) {
      issues.push({
        code: "RECIPE_MISSING_REQUIRED_NAMED_INGREDIENT",
        severity: "error",
        message: `Required ingredient "${req.normalizedName}" is missing from the final recipe.`,
      });
      continue;
    }

    if (!ingredientMentionedInSteps(req, params.steps)) {
      issues.push({
        code: "STEP_MISSING_REQUIRED_INGREDIENT_USAGE",
        severity: "error",
        message: `Required ingredient "${req.normalizedName}" appears in ingredients but is not used in any step.`,
      });
    }
  }

  return issues;
}
