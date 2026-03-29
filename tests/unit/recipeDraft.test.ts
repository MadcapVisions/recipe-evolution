import test from "node:test";
import assert from "node:assert/strict";
import {
  coerceIngredientLineWithAmount,
  formatIngredientLine,
  ingredientLineHasAmount,
  normalizeAiIngredients,
  normalizeRecipeDraft,
  normalizeRecipeVersionPayload,
  parseIngredientLines,
  repairRecipeDraftIngredientLines,
  parseStepLines,
} from "../../lib/recipes/recipeDraft";

test("parseIngredientLines trims lines and drops blanks", () => {
  const parsed = parseIngredientLines(" 1 lb chicken \n\n 2 lemons \n   ");

  assert.deepEqual(parsed, [{ name: "1 lb chicken" }, { name: "2 lemons" }]);
});

test("parseIngredientLines returns an empty list for blank input", () => {
  assert.deepEqual(parseIngredientLines(" \n \n "), []);
});

test("ingredientLineHasAmount requires an explicit amount", () => {
  assert.equal(ingredientLineHasAmount("2 tbsp olive oil"), true);
  assert.equal(ingredientLineHasAmount("1 onion"), true);
  assert.equal(ingredientLineHasAmount("olive oil"), false);
  assert.equal(ingredientLineHasAmount("broth"), false);
});

test("formatIngredientLine builds a shopping-ready ingredient line", () => {
  assert.equal(
    formatIngredientLine({ quantity: 2, unit: "tbsp", name: "olive oil" }),
    "2 tbsp olive oil"
  );
  assert.equal(formatIngredientLine({ quantity: 1, name: "onion", prep: "diced" }), "1 onion diced");
});

test("coerceIngredientLineWithAmount adds amounts to common AI ingredient fragments", () => {
  assert.equal(coerceIngredientLineWithAmount("olive oil"), "2 tbsp olive oil");
  assert.equal(coerceIngredientLineWithAmount("garlic"), "2 cloves garlic, minced");
  assert.equal(coerceIngredientLineWithAmount("zucchini"), "2 medium zucchini, sliced");
  assert.equal(coerceIngredientLineWithAmount("salt to taste"), "1 tsp salt");
});

test("repairRecipeDraftIngredientLines converts bare ingredient names into measured lines", () => {
  assert.deepEqual(repairRecipeDraftIngredientLines([{ name: "turkey breast" }, { name: "rice" }, { name: "black pepper" }]), [
    { name: "1 lb turkey breast" },
    { name: "1 cup rice" },
    { name: "1/2 tsp black pepper" },
  ]);
});

test("normalizeAiIngredients removes duplicated leading measurements from structured AI ingredients", () => {
  assert.deepEqual(
    normalizeAiIngredients([
      { name: "6 cup crispy rice cereal", quantity: 6, unit: "cup", prep: null },
      { name: "1.5 cup dark chocolate chunks", quantity: 2, unit: "cup", prep: null },
      { name: "8 tortillas", quantity: 8, unit: null, prep: null },
    ]),
    [
      { name: "6 cup crispy rice cereal" },
      { name: "2 cup dark chocolate chunks" },
      { name: "8 tortillas" },
    ]
  );
});

test("parseStepLines trims lines and drops blanks", () => {
  const parsed = parseStepLines(" Preheat oven \n\n Roast for 20 minutes \n");

  assert.deepEqual(parsed, [{ text: "Preheat oven" }, { text: "Roast for 20 minutes" }]);
});

test("parseStepLines preserves step ordering", () => {
  const parsed = parseStepLines("Step one\nStep two\nStep three");

  assert.deepEqual(parsed.map((step) => step.text), ["Step one", "Step two", "Step three"]);
});

test("normalizeRecipeDraft trims values and strips extra ingredient and step fields", () => {
  const draft = normalizeRecipeDraft({
    title: "  Lemon Pasta  ",
    description: "  Bright and quick  ",
    tags: [" dinner ", "pasta", "dinner"],
    servings: 2,
    prep_time_min: 10,
    cook_time_min: 15,
    difficulty: " easy ",
    ingredients: [
      { name: " 200g spaghetti ", quantity: 200, unit: "g" },
      { name: " 1 lemon " },
    ],
    steps: [
      { text: " Boil pasta ", timer_seconds: 600 },
      { text: " Toss with lemon " },
    ],
    notes: "  Best fresh  ",
    change_log: "  Initial version  ",
    ai_metadata_json: { source: "test" },
  });

  assert.deepEqual(draft, {
    title: "Lemon Pasta",
    description: "Bright and quick",
    tags: ["dinner", "pasta"],
    servings: 2,
    prep_time_min: 10,
    cook_time_min: 15,
    difficulty: "easy",
    ingredients: [{ name: "200g spaghetti" }, { name: "1 lemon" }],
    steps: [{ text: "Boil pasta" }, { text: "Toss with lemon" }],
    notes: "Best fresh",
    change_log: "Initial version",
    ai_metadata_json: { source: "test" },
  });
});

test("normalizeRecipeDraft rejects missing ingredients", () => {
  assert.throws(
    () =>
      normalizeRecipeDraft({
        title: "Soup",
        description: null,
        tags: null,
        servings: null,
        prep_time_min: null,
        cook_time_min: null,
        difficulty: null,
        ingredients: [],
        steps: [{ text: "Heat" }],
      }),
    /At least one ingredient is required/
  );
});

test("normalizeRecipeDraft rejects ingredients without amounts", () => {
  assert.throws(
    () =>
      normalizeRecipeDraft({
        title: "Soup",
        description: null,
        tags: null,
        servings: null,
        prep_time_min: null,
        cook_time_min: null,
        difficulty: null,
        ingredients: [{ name: "broth" }],
        steps: [{ text: "Heat" }],
      }),
    /Each ingredient needs a quantity/
  );
});

test("normalizeRecipeVersionPayload trims values and strips extra fields", () => {
  const payload = normalizeRecipeVersionPayload({
    version_label: "  V2  ",
    change_summary: "  Better texture  ",
    servings: 4,
    prep_time_min: 5,
    cook_time_min: 20,
    difficulty: " medium ",
    ingredients: [{ name: " 2 onions ", prep: "diced" }],
    steps: [{ text: " Roast onions ", timer_seconds: 1200 }],
    notes: "  Add salt at the end  ",
    change_log: "  Roasted the onions first  ",
    ai_metadata_json: { cached: true },
  });

  assert.deepEqual(payload, {
    version_label: "V2",
    change_summary: "Better texture",
    servings: 4,
    prep_time_min: 5,
    cook_time_min: 20,
    difficulty: "medium",
    ingredients: [{ name: "2 onions" }],
    steps: [{ text: "Roast onions" }],
    notes: "Add salt at the end",
    change_log: "Roasted the onions first",
    ai_metadata_json: { cached: true },
    sessionSeed: null,
  });
});
