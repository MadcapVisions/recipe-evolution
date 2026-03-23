import test from "node:test";
import assert from "node:assert/strict";
import { validateRecipeStructure } from "../../lib/ai/recipeStructuralValidation";

test("validateRecipeStructure passes for a complete normalized recipe", () => {
  const result = validateRecipeStructure({
    title: "Spanish-Inspired Chicken with Peppers",
    description: null,
    servings: 4,
    prep_time_min: 15,
    cook_time_min: 30,
    difficulty: "Easy",
    ingredients: [{ name: "1 lb chicken thighs" }, { name: "2 peppers" }],
    steps: [{ text: "Brown the chicken." }, { text: "Simmer until tender." }],
    chefTips: [],
  });

  assert.equal(result.passes, true);
  assert.deepEqual(result.reasons, []);
});

test("validateRecipeStructure fails when ingredients are missing", () => {
  const result = validateRecipeStructure({
    title: "Broken Recipe",
    description: null,
    servings: 4,
    prep_time_min: 15,
    cook_time_min: 30,
    difficulty: "Easy",
    ingredients: [],
    steps: [{ text: "Cook until done." }],
    chefTips: [],
  });

  assert.equal(result.passes, false);
  assert.equal(result.checks.ingredients_present, false);
  assert.ok(result.reasons.some((reason) => reason.includes("ingredient list was missing")));
});

test("validateRecipeStructure fails when steps are missing text", () => {
  const result = validateRecipeStructure({
    title: "Broken Recipe",
    description: null,
    servings: 4,
    prep_time_min: 15,
    cook_time_min: 30,
    difficulty: "Easy",
    ingredients: [{ name: "1 onion" }],
    steps: [{ text: " " }],
    chefTips: [],
  });

  assert.equal(result.passes, false);
  assert.equal(result.checks.step_text_valid, false);
  assert.ok(result.reasons.some((reason) => reason.includes("step entries were missing text")));
});
