import test from "node:test";
import assert from "node:assert/strict";
import {
  shouldEscalateVerification,
  findMissingQuantities,
  buildVerificationRepairInstructions,
} from "../../lib/ai/recipeRepair";
import type { VerificationResult } from "../../lib/ai/contracts/verificationResult";
import type { CookingBrief } from "../../lib/ai/contracts/cookingBrief";

function passingChecks(): VerificationResult["checks"] {
  return {
    dish_family_match: true,
    style_match: true,
    centerpiece_match: true,
    required_ingredients_present: true,
    forbidden_ingredients_avoided: true,
    title_quality_pass: true,
    recipe_completeness_pass: true,
  };
}

test("shouldEscalateVerification escalates when dish_family_match fails", () => {
  const checks = { ...passingChecks(), dish_family_match: false };
  assert.equal(shouldEscalateVerification(checks), true);
});

test("shouldEscalateVerification does not escalate for other isolated failures", () => {
  assert.equal(shouldEscalateVerification({ ...passingChecks(), required_ingredients_present: false }), false);
  assert.equal(shouldEscalateVerification({ ...passingChecks(), forbidden_ingredients_avoided: false }), false);
  assert.equal(shouldEscalateVerification({ ...passingChecks(), centerpiece_match: false }), false);
  assert.equal(shouldEscalateVerification({ ...passingChecks(), title_quality_pass: false }), false);
  assert.equal(shouldEscalateVerification({ ...passingChecks(), style_match: false }), false);
});

test("findMissingQuantities flags ingredients without a digit", () => {
  const ingredients = [
    { name: "2 tbsp olive oil" },
    { name: "olive oil" },
    { name: "1 lb chicken thighs" },
    { name: "salt to taste" },
    { name: "3 cloves garlic" },
  ];
  const result = findMissingQuantities(ingredients);
  assert.deepEqual(result, ["olive oil", "salt to taste"]);
});

test("findMissingQuantities returns empty when all ingredients have quantities", () => {
  const ingredients = [
    { name: "2 tbsp olive oil" },
    { name: "1 lb chicken" },
    { name: "3 cloves garlic, minced" },
  ];
  assert.deepEqual(findMissingQuantities(ingredients), []);
});

test("buildVerificationRepairInstructions includes centerpiece fix when centerpiece is missing", () => {
  const verification = {
    passes: false,
    confidence: 0.3,
    score: 0.5,
    reasons: ["Recipe lost the intended centerpiece ingredient or dish."],
    checks: { ...passingChecks(), centerpiece_match: false },
    retry_strategy: "regenerate_stricter" as const,
  };
  const brief = {
    ingredients: { centerpiece: "chicken", required: [], forbidden: [], preferred: [] },
  } as unknown as CookingBrief;

  const instructions = buildVerificationRepairInstructions(verification, brief);
  assert.equal(instructions.length, 1);
  assert.match(instructions[0], /chicken/);
  assert.match(instructions[0], /centerpiece/);
});

test("buildVerificationRepairInstructions includes required and forbidden fixes together", () => {
  const verification = {
    passes: false,
    confidence: 0.3,
    score: 0.4,
    reasons: ["missing required", "has forbidden"],
    checks: { ...passingChecks(), required_ingredients_present: false, forbidden_ingredients_avoided: false },
    retry_strategy: "regenerate_stricter" as const,
  };
  const brief = {
    ingredients: {
      centerpiece: null,
      required: ["jalapeños", "sour cream"],
      forbidden: ["garlic"],
      preferred: [],
    },
    style: { tags: [], texture_tags: [], format_tags: [] },
  } as unknown as CookingBrief;

  const instructions = buildVerificationRepairInstructions(verification, brief);
  assert.equal(instructions.length, 2);
  assert.ok(instructions.some((i) => i.includes("jalapeños") && i.includes("sour cream")));
  assert.ok(instructions.some((i) => i.includes("garlic")));
});

test("buildVerificationRepairInstructions returns empty array when all checks pass", () => {
  const verification = {
    passes: true,
    confidence: 0.95,
    score: 1,
    reasons: [],
    checks: passingChecks(),
    retry_strategy: "none" as const,
  };
  assert.deepEqual(buildVerificationRepairInstructions(verification, null), []);
});

test("buildVerificationRepairInstructions includes title fix for generic titles", () => {
  const verification = {
    passes: false,
    confidence: 0.4,
    score: 0.85,
    reasons: ["Recipe title is too generic."],
    checks: { ...passingChecks(), title_quality_pass: false },
    retry_strategy: "regenerate_stricter" as const,
  };
  const instructions = buildVerificationRepairInstructions(verification, null);
  assert.equal(instructions.length, 1);
  assert.match(instructions[0], /title/i);
});
