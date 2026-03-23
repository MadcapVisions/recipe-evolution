import type { HomeGeneratedRecipe } from "./recipeNormalization";

export type RecipeStructuralValidationResult = {
  passes: boolean;
  reasons: string[];
  checks: {
    title_present: boolean;
    ingredients_present: boolean;
    steps_present: boolean;
    ingredient_names_valid: boolean;
    step_text_valid: boolean;
  };
};

function hasNonEmptyText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateRecipeStructure(recipe: HomeGeneratedRecipe | null | undefined): RecipeStructuralValidationResult {
  if (!recipe) {
    return {
      passes: false,
      reasons: ["Recipe draft was empty after normalization."],
      checks: {
        title_present: false,
        ingredients_present: false,
        steps_present: false,
        ingredient_names_valid: false,
        step_text_valid: false,
      },
    };
  }

  const titlePresent = hasNonEmptyText(recipe.title);
  const ingredientsPresent = Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0;
  const stepsPresent = Array.isArray(recipe.steps) && recipe.steps.length > 0;
  const ingredientNamesValid =
    ingredientsPresent && recipe.ingredients.every((item) => hasNonEmptyText(item?.name));
  const stepTextValid =
    stepsPresent && recipe.steps.every((item) => hasNonEmptyText(item?.text));

  const reasons: string[] = [];
  if (!titlePresent) reasons.push("Recipe title was missing after normalization.");
  if (!ingredientsPresent) reasons.push("Recipe ingredient list was missing after normalization.");
  else if (!ingredientNamesValid) reasons.push("Recipe ingredient entries were missing names after normalization.");
  if (!stepsPresent) reasons.push("Recipe steps were missing after normalization.");
  else if (!stepTextValid) reasons.push("Recipe step entries were missing text after normalization.");

  return {
    passes: reasons.length === 0,
    reasons,
    checks: {
      title_present: titlePresent,
      ingredients_present: ingredientsPresent,
      steps_present: stepsPresent,
      ingredient_names_valid: ingredientNamesValid,
      step_text_valid: stepTextValid,
    },
  };
}
