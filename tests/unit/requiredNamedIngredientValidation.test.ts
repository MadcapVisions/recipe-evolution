import test from "node:test";
import assert from "node:assert/strict";
import { compileCookingBrief } from "../../lib/ai/briefCompiler";
import { validateRequiredNamedIngredientsInRecipe } from "../../lib/ai/requiredNamedIngredientValidation";
import { buildRequiredNamedIngredient, matchesRequiredIngredient } from "../../lib/ai/requiredNamedIngredient";

test("recipe refinement treats sourdough discard as a distinct hard-required ingredient", () => {
  const brief = compileCookingBrief({
    userMessage: "I want to add sourdough discard to the recipe",
    conversationHistory: [],
    recipeContext: {
      title: "Bread Pudding",
      ingredients: ["stale bread", "milk", "eggs"],
      steps: ["Whisk the custard and bake the bread pudding."],
    },
  });

  assert.deepEqual(
    (brief.ingredients.requiredNamedIngredients ?? []).map((ingredient) => ingredient.normalizedName),
    ["sourdough discard"]
  );

  const issues = validateRequiredNamedIngredientsInRecipe({
    ingredients: [
      { ingredientName: "stale sourdough bread" },
      { ingredientName: "whole milk" },
      { ingredientName: "eggs" },
    ],
    steps: [{ text: "Whisk the milk and eggs, then soak the sourdough bread before baking." }],
    requiredNamedIngredients: brief.ingredients.requiredNamedIngredients ?? [],
  });

  assert.ok(
    issues.some((issue) => issue.code === "RECIPE_MISSING_REQUIRED_NAMED_INGREDIENT")
  );
});

test("required ingredient matcher does not let bare sourdough satisfy sourdough discard", () => {
  const required = buildRequiredNamedIngredient("sourdough discard");

  assert.equal(matchesRequiredIngredient("sourdough", required), false);
  assert.equal(matchesRequiredIngredient("sourdough bread", required), false);
  assert.equal(matchesRequiredIngredient("1 cup sourdough discard", required), true);
});
