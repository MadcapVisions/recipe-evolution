import type { PlannerRecipeOption } from "@/lib/plannerData";
import { buildMealPlan } from "@/lib/recipes/mealPlanner";

export type AcceptedMealPlanEntry = {
  plan_date: string;
  sort_order: number;
  recipe_id: string;
  version_id: string;
  servings: number;
};

export type DerivedWeekGroceryReason =
  | "generated_from_accepted_plan"
  | "merged_overlapping_ingredients"
  | "pantry_staples_omitted";

export interface DerivedWeekGroceryResult {
  groceryPlan: ReturnType<typeof buildMealPlan>["groceryPlan"];
  metadata: {
    acceptedEntryCount: number;
    contributingRecipeCount: number;
    mergedItemCount: number;
    pantrySuppressedCount: number;
  };
  reasons: DerivedWeekGroceryReason[];
}

export function deriveWeekGroceryFromAcceptedEntries(input: {
  acceptedEntries: AcceptedMealPlanEntry[];
  recipeOptions: PlannerRecipeOption[];
  pantryStaples: string[];
}): DerivedWeekGroceryResult {
  const acceptedEntries = [...input.acceptedEntries].sort((left, right) => {
    if (left.plan_date === right.plan_date) {
      return left.sort_order - right.sort_order;
    }
    return left.plan_date.localeCompare(right.plan_date);
  });
  const optionByVersionId = new Map(input.recipeOptions.map((option) => [option.versionId, option]));
  const acceptedSelections = acceptedEntries
    .map((entry) => {
      const option = optionByVersionId.get(entry.version_id);
      if (!option) {
        return null;
      }

      return {
        recipeId: option.recipeId,
        recipeTitle: option.recipeTitle,
        versionId: option.versionId,
        versionLabel: option.versionLabel,
        servings: option.servings,
        targetServings: entry.servings,
        ingredients: option.ingredients,
        steps: option.steps,
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));
  const mealPlan = buildMealPlan(acceptedSelections, input.pantryStaples);
  const ingredientLineCount = acceptedSelections.reduce((sum, selection) => sum + selection.ingredients.length, 0);
  const consolidatedItemCount = mealPlan.groceryPlan.neededItems.length + mealPlan.groceryPlan.pantryItems.length;
  const mergedItemCount = Math.max(0, ingredientLineCount - consolidatedItemCount);
  const reasons: DerivedWeekGroceryReason[] = ["generated_from_accepted_plan"];

  if (mergedItemCount > 0) {
    reasons.push("merged_overlapping_ingredients");
  }

  if (mealPlan.groceryPlan.pantryItems.length > 0) {
    reasons.push("pantry_staples_omitted");
  }

  return {
    groceryPlan: mealPlan.groceryPlan,
    metadata: {
      acceptedEntryCount: acceptedEntries.length,
      contributingRecipeCount: acceptedSelections.length,
      mergedItemCount,
      pantrySuppressedCount: mealPlan.groceryPlan.pantryItems.length,
    },
    reasons,
  };
}
