import { buildGroceryPlan, type GroceryPlanningItem } from "./groceryPlanning";
import { buildPrepPlan } from "./prepPlan";
import { deriveIngredientDetails } from "./canonicalEnrichment";
import { combineMeasuredQuantities, normalizeMeasurementUnit } from "./measurements";
import { scaleCanonicalIngredientLine } from "./servings";

export type PlannerRecipeSelection = {
  recipeId: string;
  recipeTitle: string;
  versionId: string;
  versionLabel: string | null;
  servings: number | null;
  targetServings: number | null;
  ingredients: Array<{ name: string }>;
  steps: Array<{ text: string }>;
};

function normalizeIngredientName(name: string) {
  const details = deriveIngredientDetails(name);
  const unit = normalizeMeasurementUnit(details.unit);
  return name
    .toLowerCase()
    .replace(/[(),]/g, " ")
    .replace(/^((?:about|approx\.?|approximately)\s+)?(\d+(?:\.\d+)?(?:\/\d+)?(?:\s+\d+\/\d+)?|[\d¼½¾⅐⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]+(?:\s*(?:-|to)\s*[\d¼½¾⅐⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞/. ]+)?)\s+/i, "")
    .replace(unit ? new RegExp(`^${unit}\\s+`, "i") : /^$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toPlanningItems(recipes: PlannerRecipeSelection[]): GroceryPlanningItem[] {
  const aggregations = new Map<string, GroceryPlanningItem>();

  for (const recipe of recipes) {
    const baseServings = typeof recipe.servings === "number" && recipe.servings > 0 ? recipe.servings : null;
    const targetServings = typeof recipe.targetServings === "number" && recipe.targetServings > 0 ? recipe.targetServings : null;
    const scaledIngredients =
      baseServings != null && targetServings != null
        ? recipe.ingredients.map((ingredient) => ({
            name: scaleCanonicalIngredientLine(ingredient.name, baseServings, targetServings),
          }))
        : recipe.ingredients;

    for (const ingredient of scaledIngredients) {
      const details = deriveIngredientDetails(ingredient.name);
      const normalizedName = normalizeIngredientName(ingredient.name);
      const key = normalizedName;
      const existing = aggregations.get(key);

      if (!existing) {
        aggregations.set(key, {
          id: `${recipe.versionId}-${normalizedName}`,
          name: ingredient.name,
          normalized_name: normalizedName,
          quantity: details.quantity,
          unit: normalizeMeasurementUnit(details.unit),
          prep: details.prep,
          checked: false,
        });
        continue;
      }

      const combined = combineMeasuredQuantities(
        { quantity: existing.quantity, unit: existing.unit },
        { quantity: details.quantity, unit: details.unit }
      );

      existing.quantity = combined.quantity;
      existing.unit = combined.unit;
    }
  }

  return Array.from(aggregations.values());
}

export function buildMealPlan(recipes: PlannerRecipeSelection[], pantryStaples: string[]) {
  const groceryItems = toPlanningItems(recipes);
  const groceryPlan = buildGroceryPlan(groceryItems, pantryStaples);
  const prepPlans = recipes.map((recipe) => {
    const baseServings = typeof recipe.servings === "number" && recipe.servings > 0 ? recipe.servings : null;
    const targetServings = typeof recipe.targetServings === "number" && recipe.targetServings > 0 ? recipe.targetServings : null;
    const scaledIngredientNames =
      baseServings != null && targetServings != null
        ? recipe.ingredients.map((item) => scaleCanonicalIngredientLine(item.name, baseServings, targetServings))
        : recipe.ingredients.map((item) => item.name);

    return {
      recipeId: recipe.recipeId,
      recipeTitle: recipe.recipeTitle,
      versionId: recipe.versionId,
      versionLabel: recipe.versionLabel,
      prepPlan: buildPrepPlan({
        ingredientNames: scaledIngredientNames,
        stepTexts: recipe.steps.map((item) => item.text),
      }),
    };
  });

  return {
    groceryPlan,
    prepPlans,
    recipeCount: recipes.length,
  };
}
