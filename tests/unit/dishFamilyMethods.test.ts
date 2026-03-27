import test from "node:test";
import assert from "node:assert/strict";
import { findDishFamilyRule } from "../../lib/ai/dishFamilyRules";
import { validateCulinaryFit } from "../../lib/ai/culinaryValidator";
import { evaluateStepDiff } from "../../lib/ai/stepDiffEvaluator";

test("dish family rules use canonical registry-backed required methods", () => {
  const breadPudding = findDishFamilyRule("bread pudding");
  const stirFry = findDishFamilyRule("stir fry");

  assert.ok(breadPudding);
  assert.ok(stirFry);

  assert.deepEqual(breadPudding.requiredMethods, ["soak"]);
  assert.deepEqual(stirFry.requiredMethods, ["stir_fry", "high_heat"]);
});

test("culinary validator accepts bread pudding steps that express soak and slow-cook in text", () => {
  const result = validateCulinaryFit(
    "bread pudding",
    [
      { name: "brioche bread" },
      { name: "eggs" },
      { name: "whole milk" },
      { name: "brown sugar" },
    ],
    [
      { text: "Soak the torn brioche in the custard for 20 minutes." },
      { text: "Slow-cook the pudding on low until softly set in the center." },
    ]
  );

  assert.equal(result.valid, true);
  assert.equal(
    result.violations.some((issue) => issue.code === "missing_required_method:soak"),
    false
  );
});

test("step diff evaluator preserves required methods when they are inferred from step text", () => {
  const breadPudding = findDishFamilyRule("bread pudding");
  assert.ok(breadPudding);

  const result = evaluateStepDiff({
    dishFamily: breadPudding,
    originalSteps: [
      { text: "Soak the bread in custard.", methodTag: "soak" },
      { text: "Bake until set.", methodTag: "bake" },
    ],
    repairedSteps: [
      { text: "Let the bread soak in the custard for 15 minutes." },
      { text: "Bake until the center is softly set." },
    ],
  });

  assert.equal(result.passed, true);
  assert.equal(
    result.issues.some((issue) => issue.code === "STEP_DIFF_MISSING_REQUIRED_METHOD"),
    false
  );
});
