import test from "node:test";
import assert from "node:assert/strict";
import { buildMealPlan } from "../../lib/recipes/mealPlanner";

test("buildMealPlan combines grocery needs and prep plans across multiple recipes", () => {
  const result = buildMealPlan(
    [
      {
        recipeId: "r1",
        recipeTitle: "Pasta",
        versionId: "v1",
        versionLabel: "Original",
        servings: 2,
        targetServings: 2,
        ingredients: [{ name: "1 tbsp olive oil" }, { name: "1 onion, chopped" }],
        steps: [{ text: "Saute onion for 10 minutes." }],
      },
      {
        recipeId: "r2",
        recipeTitle: "Soup",
        versionId: "v2",
        versionLabel: "Original",
        servings: 4,
        targetServings: 4,
        ingredients: [{ name: "3 tsp olive oil" }, { name: "2 carrots, diced" }],
        steps: [{ text: "Simmer carrots for 20 minutes." }],
      },
    ],
    []
  );

  assert.equal(result.recipeCount, 2);
  assert.equal(result.prepPlans.length, 2);
  const oil = result.groceryPlan.groupedItems.flatMap((group) => group.items).find((item) => item.normalized_name.includes("olive oil"));
  assert.equal(oil?.quantity, 2);
  assert.equal(oil?.unit, "tbsp");
});
