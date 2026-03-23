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
      method_text: "Cook until done.",
    },
    "Fallback Title"
  );

  assert.equal(normalized.recipe, null);
  assert.equal(normalized.reason, "Recipe JSON was missing recognizable steps.");
});
