import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGeneratedRecipePayload } from "../../lib/ai/recipeNormalization";
import { isLikelyTruncatedRecipePayload } from "../../lib/ai/recipeTruncation";

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

test("normalizeGeneratedRecipeForTest unwraps embedded recipe JSON from a text field", () => {
  const normalized = normalizeGeneratedRecipePayload(
    {
      text: JSON.stringify({
        title: "Spicy Pineapple Carnitas Tacos",
        description: "Sweet-spicy pork tacos with pineapple.",
        ingredients: [
          { name: "pork shoulder", quantity: 2, unit: "lb", prep: null },
          { name: "pineapple", quantity: 2, unit: "cups", prep: "chopped" },
        ],
        steps: [
          { text: "Braise the pork until tender." },
          { text: "Crisp the carnitas and serve in tortillas with pineapple." },
        ],
      }),
    },
    "Fallback Title"
  );

  assert.equal(normalized.reason, null);
  assert.deepEqual(normalized.recipe?.ingredients.map((item) => item.name), [
    "2 lb pork shoulder",
    "2 cups pineapple chopped",
  ]);
  assert.deepEqual(normalized.recipe?.steps.map((item) => item.text), [
    "Braise the pork until tender.",
    "Crisp the carnitas and serve in tortillas with pineapple.",
  ]);
  assert.ok(normalized.normalization_log.repaired_fields.includes("embedded_json_unwrapped"));
});

test("normalizeGeneratedRecipeForTest unwraps embedded recipe JSON from nested wrapper objects", () => {
  const normalized = normalizeGeneratedRecipePayload(
    {
      result: {
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              title: "Pineapple Carnitas Tacos",
              ingredients: [{ name: "pork shoulder", quantity: 2, unit: "lb" }],
              steps: [{ text: "Cook the pork until tender and crisp it before serving." }],
            }),
          },
        ],
      },
    },
    "Fallback Title"
  );

  assert.equal(normalized.reason, null);
  assert.deepEqual(normalized.recipe?.ingredients.map((item) => item.name), ["2 lb pork shoulder"]);
  assert.deepEqual(normalized.recipe?.steps.map((item) => item.text), [
    "Cook the pork until tender and crisp it before serving.",
  ]);
  assert.ok(normalized.normalization_log.repaired_fields.includes("embedded_json_unwrapped"));
});

test("isLikelyTruncatedRecipePayloadForTest flags length-truncated wrapped recipe payloads", () => {
  const normalized = normalizeGeneratedRecipePayload(
    {
      text: '{ "title": "Spicy Pineapple Chicken Tacos", "ingredients": [ { "name": "chicken", "quantity": 1, "unit": "lb", "prep": null } ], "steps": [ { "text": "Cook',
    },
    "Fallback Title"
  );

  assert.equal(
    isLikelyTruncatedRecipePayload({
      resultText:
        '{ "text": "{ \\"title\\": \\"Spicy Pineapple Chicken Tacos\\", \\"ingredients\\": [ { \\"name\\": \\"chicken\\", \\"quantity\\": 1, \\"unit\\": \\"lb\\", \\"prep\\": null } ], \\"steps\\": [ { \\"text\\": \\"Cook" }',
      finishReason: "length",
      parsed: {
        text: '{ "title": "Spicy Pineapple Chicken Tacos", "ingredients": [ { "name": "chicken", "quantity": 1, "unit": "lb", "prep": null } ], "steps": [ { "text": "Cook',
      },
      normalized,
    }),
    true
  );
});

test("isLikelyTruncatedRecipePayloadForTest ignores valid normalized recipes", () => {
  const normalized = normalizeGeneratedRecipePayload(
    {
      title: "Pineapple Chicken Tacos",
      ingredients: [{ name: "chicken", quantity: 1, unit: "lb", prep: null }],
      steps: [{ text: "Cook the chicken and serve in tortillas." }],
    },
    "Fallback Title"
  );

  assert.equal(
    isLikelyTruncatedRecipePayload({
      resultText: JSON.stringify({
        title: "Pineapple Chicken Tacos",
        ingredients: [{ name: "chicken", quantity: 1, unit: "lb", prep: null }],
        steps: [{ text: "Cook the chicken and serve in tortillas." }],
      }),
      finishReason: "stop",
      parsed: {
        title: "Pineapple Chicken Tacos",
        ingredients: [{ name: "chicken", quantity: 1, unit: "lb", prep: null }],
        steps: [{ text: "Cook the chicken and serve in tortillas." }],
      },
      normalized,
    }),
    false
  );
});
