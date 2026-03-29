import test from "node:test";
import assert from "node:assert/strict";
import { adjudicateRecipeFailure, applyFailureAdjudicationToBrief } from "../../lib/ai/failureAdjudicator";
import { createEmptyCookingBrief } from "../../lib/ai/contracts/cookingBrief";
import { buildRequiredNamedIngredient } from "../../lib/ai/requiredNamedIngredient";

test("failure adjudicator drops obvious acknowledgement noise from required ingredients", async () => {
  const brief = createEmptyCookingBrief();
  brief.ingredients.required = ["ok", "peanut butter"];
  brief.ingredients.requiredNamedIngredients = [
    buildRequiredNamedIngredient("ok"),
    buildRequiredNamedIngredient("peanut butter"),
  ];

  const adjudication = await adjudicateRecipeFailure({
    flow: "home_create",
    failureKind: "verification_failed",
    cookingBrief: brief,
    reasons: ['Required ingredient "ok" appears in ingredients but is not used in any step.'],
  });

  assert.equal(adjudication.decision, "sanitize_constraints");
  assert.equal(adjudication.adjudicatorSource, "heuristic");
  assert.deepEqual(adjudication.dropRequiredNamedIngredients, ["ok"]);
  assert.deepEqual(adjudication.dropRequiredIngredients, ["ok"]);
  assert.equal(adjudication.escalated, false);
});

test("applyFailureAdjudicationToBrief removes dropped required ingredients and preserves real ones", () => {
  const brief = createEmptyCookingBrief();
  brief.ingredients.required = ["ok", "peanut butter"];
  brief.ingredients.requiredNamedIngredients = [
    buildRequiredNamedIngredient("ok"),
    buildRequiredNamedIngredient("peanut butter"),
  ];

  const updated = applyFailureAdjudicationToBrief(brief, {
    adjudicatorSource: "heuristic",
    decision: "sanitize_constraints",
    confidence: 0.99,
    summary: "Dropped noisy required ingredient.",
    retryStrategy: "regenerate_stricter",
    dropRequiredNamedIngredients: ["ok"],
    dropRequiredIngredients: ["ok"],
    correctedStructuredRecipe: null,
  });

  assert.deepEqual(updated.ingredients.required, ["peanut butter"]);
  assert.deepEqual(
    (updated.ingredients.requiredNamedIngredients ?? []).map((item) => item.normalizedName),
    ["peanut butter"]
  );
});
