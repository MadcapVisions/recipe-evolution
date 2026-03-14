import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCanonicalEnrichment,
  deriveIngredientDetails,
  deriveStepDetails,
} from "../../lib/recipes/canonicalEnrichment";

test("deriveIngredientDetails parses quantity, unit, and prep from canonical ingredient text", () => {
  assert.deepEqual(deriveIngredientDetails("1 1/2 cups onion, diced"), {
    name: "1 1/2 cups onion, diced",
    quantity: 1.5,
    unit: "cups",
    prep: "diced",
  });
});

test("deriveIngredientDetails leaves plain ingredient names simple", () => {
  assert.deepEqual(deriveIngredientDetails("fresh basil"), {
    name: "fresh basil",
    quantity: null,
    unit: null,
    prep: null,
  });
});

test("deriveIngredientDetails handles unicode fractions and range quantities", () => {
  assert.deepEqual(deriveIngredientDetails("1½ cups broth"), {
    name: "1½ cups broth",
    quantity: 1.5,
    unit: "cups",
    prep: null,
  });

  assert.deepEqual(deriveIngredientDetails("2-3 tbsp olive oil"), {
    name: "2-3 tbsp olive oil",
    quantity: 2.5,
    unit: "tbsp",
    prep: null,
  });
});

test("deriveIngredientDetails keeps qualitative ingredients unquantified", () => {
  assert.deepEqual(deriveIngredientDetails("salt to taste"), {
    name: "salt to taste",
    quantity: null,
    unit: null,
    prep: null,
  });
});

test("deriveStepDetails extracts timer information from canonical step text", () => {
  assert.deepEqual(deriveStepDetails("Simmer for 12 minutes until thickened."), {
    text: "Simmer for 12 minutes until thickened.",
    timer_seconds: 720,
  });
});

test("buildCanonicalEnrichment creates enrichment payload from simple canonical recipe text", () => {
  assert.deepEqual(
    buildCanonicalEnrichment({
      ingredientNames: ["2 tbsp olive oil", "1 onion, chopped"],
      stepTexts: ["Roast for 20 minutes.", "Serve warm."],
      preferredUnits: "metric",
    }),
    {
      ingredient_details: [
        { name: "2 tbsp olive oil", quantity: 2, unit: "tbsp", prep: null },
        { name: "1 onion, chopped", quantity: 1, unit: null, prep: "chopped" },
      ],
      step_details: [
        { text: "Roast for 20 minutes.", timer_seconds: 1200 },
        { text: "Serve warm.", timer_seconds: null },
      ],
      preferred_units: "metric",
    }
  );
});
