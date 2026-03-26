import test from "node:test";
import assert from "node:assert/strict";
import {
  shouldEscalateVerification,
  findMissingQuantities,
  buildVerificationRepairInstructions,
  buildVerificationRepairPlan,
  buildQualityRepairPlan,
  buildScopedRepairPrompt,
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

test("buildVerificationRepairPlan returns scoped alignment repairs", () => {
  const verification = {
    passes: false,
    confidence: 0.2,
    score: 0.4,
    reasons: ["missing required", "generic title"],
    checks: {
      ...passingChecks(),
      required_ingredients_present: false,
      title_quality_pass: false,
    },
    retry_strategy: "regenerate_stricter" as const,
  };
  const brief = {
    ingredients: {
      centerpiece: null,
      required: ["shrimp", "lime crema"],
      forbidden: [],
      preferred: [],
    },
    style: { tags: [], texture_tags: [], format_tags: [] },
  } as unknown as CookingBrief;

  const plan = buildVerificationRepairPlan(verification, brief);
  assert.deepEqual(plan.scopes, ["alignment_required_ingredients", "alignment_title"]);
  assert.equal(plan.instructions.length, 2);
});

test("buildVerificationRepairPlan adds exact required-named ingredient instructions", () => {
  const verification = {
    passes: false,
    confidence: 0.2,
    score: 0.6,
    reasons: ["missing exact required ingredient"],
    checks: {
      ...passingChecks(),
      required_named_ingredients_present: false,
      required_named_ingredients_used_in_steps: false,
    },
    retry_strategy: "regenerate_stricter" as const,
  };
  const brief = {
    ingredients: {
      centerpiece: null,
      required: ["sourdough discard"],
      forbidden: [],
      preferred: [],
      requiredNamedIngredients: [
        {
          rawText: "sourdough discard",
          normalizedName: "sourdough discard",
          aliases: ["discard"],
          source: "must_include",
          requiredStrength: "hard",
        },
      ],
    },
    style: { tags: [], texture_tags: [], format_tags: [] },
  } as unknown as CookingBrief;

  const plan = buildVerificationRepairPlan(verification, brief);
  assert.ok(plan.scopes.includes("alignment_required_ingredients"));
  assert.ok(plan.instructions.some((instruction) => instruction.includes("sourdough discard")));
  assert.ok(plan.instructions.some((instruction) => /Do not substitute related ingredients/.test(instruction)));
});

test("buildQualityRepairPlan returns scoped quality repairs", () => {
  const plan = buildQualityRepairPlan({
    vagueSteps: [{ text: "Cook until done." }],
    tasteViolations: ["cilantro"],
    missingQuantities: ["olive oil"],
  });

  assert.deepEqual(plan.scopes, ["quality_steps", "quality_taste", "quality_quantities"]);
  assert.equal(plan.instructions.length, 3);
});

test("buildScopedRepairPrompt constrains repairs to the requested scope", () => {
  const prompt = buildScopedRepairPrompt(
    {
      scopes: ["alignment_title"],
      instructions: ["Replace the generic title with a specific dish name."],
    },
    "alignment"
  );

  assert.match(prompt, /Repair scope: alignment_title/);
  assert.match(prompt, /Only fix the listed alignment failures/);
  assert.match(prompt, /Do not change the dish family/);
});
