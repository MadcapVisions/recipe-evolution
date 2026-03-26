import test from "node:test";
import assert from "node:assert/strict";
import { orchestrateRecipeGeneration } from "../../lib/ai/recipeGenerationOrchestrator";
import { findDishFamilyRule } from "../../lib/ai/dishFamilyRules";
import { buildRequiredNamedIngredient } from "../../lib/ai/requiredNamedIngredient";
import { validateRequiredNamedIngredientsInRecipe } from "../../lib/ai/requiredNamedIngredientValidation";

test("orchestrateRecipeGeneration forwards hard required named ingredients into planner validation", async () => {
  const breadPudding = findDishFamilyRule("bread_pudding");
  assert.ok(breadPudding);

  const result = await orchestrateRecipeGeneration(
    {
      userIntent: "bread pudding with sourdough discard",
      dishHint: "bread_pudding",
      requiredNamedIngredients: [buildRequiredNamedIngredient("sourdough discard")],
      maxIngredientRepairRetries: 0,
      maxFallbackFamilies: 1,
    },
    {
      callPlannerModel: async () => ({
        title: "Bread Pudding",
        ingredients: [
          { ingredientName: "stale bread", quantity: 1, unit: "lb", grams: 454, classes: ["starch_bread"] },
          { ingredientName: "whole milk", quantity: 3, unit: "cup", grams: 720, classes: ["dairy"] },
          { ingredientName: "heavy cream", quantity: 1, unit: "cup", grams: 240, classes: ["dairy"] },
          { ingredientName: "eggs", quantity: 4, unit: "count", grams: 200, classes: ["egg"] },
          { ingredientName: "granulated sugar", quantity: 0.75, unit: "cup", grams: 150, classes: ["sweetener"] },
        ],
        notes: [],
      }),
      callStepModel: async () => ({
        title: "Bread Pudding",
        steps: [{ text: "Bake until set.", methodTag: "bake" }],
        notes: [],
      }),
      callRepairModel: async () => ({
        title: "Bread Pudding",
        ingredients: [],
        steps: [],
        notes: [],
      }),
      validateRecipe: () => ({ passed: true, score: 1, issues: [] }),
      resolveIngredients: (ingredients) => ingredients,
      stripForPersistence: (draft) => draft,
    }
  );

  assert.equal(result.success, false);
  assert.equal(result.status, "regenerate_from_ingredients");
  const plannerAttempt = result.attempts.find((attempt) => attempt.stage === "ingredient_planning");
  assert.ok(plannerAttempt);
  const issues = ((plannerAttempt.details?.issues as Array<{ code: string }>) ?? []);
  assert.ok(issues.some((issue) => issue.code === "PLANNER_MISSING_REQUIRED_NAMED_INGREDIENT"));
});

test("required named ingredient validator blocks recipes that omit or fail to use hard required named ingredients", () => {
  const required = [buildRequiredNamedIngredient("sourdough discard")];

  const missingFromRecipe = validateRequiredNamedIngredientsInRecipe({
    ingredients: [
      { ingredientName: "stale bread", normalizedName: "stale bread" },
      { ingredientName: "whole milk", normalizedName: "whole milk" },
      { ingredientName: "eggs", normalizedName: "eggs" },
    ],
    steps: [{ text: "Whisk the milk and eggs, then bake with the bread.", methodTag: "bake" }],
    requiredNamedIngredients: required,
  });

  assert.ok(
    missingFromRecipe.some(
      (issue: { code: string }) => issue.code === "RECIPE_MISSING_REQUIRED_NAMED_INGREDIENT"
    )
  );

  const missingFromSteps = validateRequiredNamedIngredientsInRecipe({
    ingredients: [
      { ingredientName: "stale bread", normalizedName: "stale bread" },
      { ingredientName: "whole milk", normalizedName: "whole milk" },
      { ingredientName: "eggs", normalizedName: "eggs" },
      { ingredientName: "sourdough discard", normalizedName: "sourdough discard" },
    ],
    steps: [{ text: "Whisk the milk and eggs, then bake with the bread.", methodTag: "bake" }],
    requiredNamedIngredients: required,
  });

  assert.ok(
    missingFromSteps.some(
      (issue: { code: string }) => issue.code === "STEP_MISSING_REQUIRED_INGREDIENT_USAGE"
    )
  );
});
