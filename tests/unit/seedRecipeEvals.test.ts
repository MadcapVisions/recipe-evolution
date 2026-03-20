import test from "node:test";
import assert from "node:assert/strict";
import { recipeMatchesRequestedDirection } from "../../lib/ai/homeRecipeAlignment";
import {
  SEED_RECIPE_EVAL_CASES,
  buildSeedEvalContext,
  evaluateSeedDishFamily,
} from "../../lib/ai/evals/seedRecipeEvals";

test("seed recipe eval dataset keeps stable unique ids", () => {
  assert.ok(SEED_RECIPE_EVAL_CASES.length >= 8);
  const ids = new Set(SEED_RECIPE_EVAL_CASES.map((item) => item.id));
  assert.equal(ids.size, SEED_RECIPE_EVAL_CASES.length);
});

test("seed recipe eval dish families match current alignment heuristics when specified", () => {
  for (const testCase of SEED_RECIPE_EVAL_CASES) {
    if (testCase.tier === "exploratory") {
      continue;
    }
    if (testCase.expected.dishFamily === null) {
      continue;
    }
    assert.equal(
      evaluateSeedDishFamily(testCase),
      testCase.expected.dishFamily,
      `Expected ${testCase.id} to resolve to ${testCase.expected.dishFamily}`
    );
  }
});

test("seed focaccia pizza case rejects unrelated skillet recipe", () => {
  const testCase = SEED_RECIPE_EVAL_CASES.find((item) => item.id === "focaccia-pizza");
  assert.ok(testCase);
  assert.equal(
    recipeMatchesRequestedDirection(
      {
        title: "Smoky Chicken Skillet",
        description: "Chicken with peppers and rice in a skillet sauce.",
        ingredients: [{ name: "1 lb chicken" }, { name: "1 cup rice" }],
        steps: [{ text: "Cook the rice and finish the chicken in the skillet." }],
      },
      buildSeedEvalContext(testCase)
    ),
    false
  );
});
