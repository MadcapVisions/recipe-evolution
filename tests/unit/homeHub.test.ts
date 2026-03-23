import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGeneratedRecipePayload } from "../../lib/ai/recipeNormalization";

test("normalizeGeneratedRecipeForTest accepts alternate instruction and ingredient key shapes", () => {
  const normalized = normalizeGeneratedRecipePayload(
    {
      recipe: {
        title: "Tomato Braised Chicken",
        ingredient_list: [
          { ingredient: "chicken leg quarters", amount: "3", prep: "patted dry" },
          { ingredient: "tomato pulp", amount: "2", measure: "cups" },
        ],
        instructions: [
          { instruction: "Sear the chicken until browned." },
          { direction: "Braise with the tomato pulp until tender." },
        ],
      },
    },
    "Fallback Title"
  );

  assert.equal(normalized.reason, null);
  assert.equal(normalized.recipe?.title, "Tomato Braised Chicken");
  assert.deepEqual(normalized.recipe?.ingredients.map((item) => item.name), [
    "3 chicken leg quarters patted dry",
    "2 cups tomato pulp",
  ]);
  assert.deepEqual(normalized.recipe?.steps.map((item) => item.text), [
    "Sear the chicken until browned.",
    "Braise with the tomato pulp until tender.",
  ]);
});

test("normalizeGeneratedRecipeForTest explains when recognizable steps are missing", () => {
  const normalized = normalizeGeneratedRecipePayload(
    {
      title: "Broken Recipe",
      ingredients: [{ name: "2 onions" }],
      step_notes: "Cook until done.",
    },
    "Fallback Title"
  );

  assert.equal(normalized.recipe, null);
  assert.equal(normalized.reason, "Recipe JSON was missing recognizable steps.");
});

test("normalizeGeneratedRecipeForTest accepts multiline string ingredients and steps", () => {
  const normalized = normalizeGeneratedRecipePayload(
    {
      title: "Spanish-Style Braise",
      ingredients: "1 chicken leg quarter\n2 cups tomato pulp\n8 oz mushrooms",
      steps: "1. Sear the chicken until browned.\n2. Braise with tomato pulp and mushrooms until tender.",
    },
    "Fallback Title"
  );

  assert.equal(normalized.reason, null);
  assert.deepEqual(normalized.recipe?.ingredients.map((item) => item.name), [
    "1 chicken leg quarter",
    "2 cups tomato pulp",
    "8 oz mushrooms",
  ]);
  assert.deepEqual(normalized.recipe?.steps.map((item) => item.text), [
    "Sear the chicken until browned.",
    "Braise with tomato pulp and mushrooms until tender.",
  ]);
});

test("normalizeGeneratedRecipeForTest accepts capitalized and underscored key variants", () => {
  const normalized = normalizeGeneratedRecipePayload(
    {
      Title: "Spanish-Inspired Chicken with Peppers",
      Ingredients_Text: "1 lb chicken thighs\n2 bell peppers\n1 tsp paprika",
      Instructions_Text: "1. Brown the chicken.\n2. Simmer with peppers and paprika until tender.",
    },
    "Fallback Title"
  );

  assert.equal(normalized.reason, null);
  assert.deepEqual(normalized.recipe?.ingredients.map((item) => item.name), [
    "1 lb chicken thighs",
    "2 bell peppers",
    "1 tsp paprika",
  ]);
  assert.deepEqual(normalized.recipe?.steps.map((item) => item.text), [
    "Brown the chicken.",
    "Simmer with peppers and paprika until tender.",
  ]);
});
