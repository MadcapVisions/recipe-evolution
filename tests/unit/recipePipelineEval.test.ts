import test from "node:test";
import assert from "node:assert/strict";
import { SEED_RECIPE_EVAL_CASES } from "../../lib/ai/evals/seedRecipeEvals";
import { runRecipePipelineEval } from "../../lib/ai/evals/recipePipelineEval";

test("seed eval cases pass the deterministic brief-plan-verify pipeline", () => {
  for (const testCase of SEED_RECIPE_EVAL_CASES) {
    if (testCase.tier === "exploratory") {
      continue;
    }
    const result = runRecipePipelineEval(testCase);

    assert.equal(result.passes, true, `Expected ${testCase.id} to pass verification`);
    if (testCase.expected.dishFamily) {
      assert.equal(
        result.brief.dish.dish_family,
        testCase.expected.dishFamily,
        `Expected ${testCase.id} to resolve dish family`
      );
      assert.equal(
        result.recipePlan.dish_family,
        testCase.expected.dishFamily,
        `Expected ${testCase.id} plan to preserve dish family`
      );
    }
    if (testCase.expected.normalizedNameHint && result.brief.dish.normalized_name) {
      assert.match(
        (result.brief.dish.normalized_name ?? "").toLowerCase(),
        new RegExp(testCase.expected.normalizedNameHint.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        `Expected ${testCase.id} normalized name hint`
      );
    }
  }
});
