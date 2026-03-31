import test from "node:test";
import assert from "node:assert/strict";
import { planMethod } from "../../lib/ai/method/planMethod";
import type { CulinaryBlueprint } from "../../lib/ai/blueprint/blueprintTypes";

function makeBlueprint(overrides: Partial<CulinaryBlueprint> = {}): CulinaryBlueprint {
  return {
    dishName: "Chicken Stir-Fry",
    dishFamily: "skillet_saute",
    cuisineHint: "asian",
    richnessLevel: "moderate",
    flavorArchitecture: ["savory base", "umami depth"],
    components: [
      {
        name: "seared chicken",
        purpose: "main",
        ingredients: [
          { name: "chicken thigh", role: "protein", rationale: "main protein" },
          { name: "olive oil", role: "fat", rationale: "searing medium" },
        ],
        cookMethod: "sear",
        textureTarget: "crispy exterior",
      },
      {
        name: "pan sauce",
        purpose: "sauce",
        ingredients: [
          { name: "soy sauce", role: "umami", rationale: "savory depth" },
          { name: "garlic", role: "aromatic", rationale: "aromatic base" },
        ],
        cookMethod: "deglaze",
        textureTarget: "glossy coating sauce",
      },
    ],
    primaryMethod: "sear then deglaze",
    sequenceLogic: "sear, then deglaze, then toss",
    finishStrategy: "fresh herb",
    textureTargets: ["crispy protein", "silky sauce"],
    chefOpportunities: ["dry protein before searing"],
    checkpoints: [
      {
        phase: "active_cook",
        description: "Check pan temperature",
        failureRisk: "steaming instead of searing",
      },
    ],
    feasibility: {
      familyFit: true,
      ingredientFit: true,
      equipmentFit: true,
      timeBudgetPlausible: true,
      difficultyPlausible: true,
      issues: [],
    },
    generatedFrom: "req-method-001",
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("planMethod returns all three sequences", () => {
  const plan = planMethod(makeBlueprint());
  assert.ok(Array.isArray(plan.prepSequence));
  assert.ok(Array.isArray(plan.activeCookSequence));
  assert.ok(Array.isArray(plan.finishSequence));
  assert.ok(plan.prepSequence.length > 0);
  assert.ok(plan.activeCookSequence.length > 0);
  assert.ok(plan.finishSequence.length > 0);
});

test("planMethod propagates checkpoints from blueprint", () => {
  const plan = planMethod(makeBlueprint());
  assert.ok(Array.isArray(plan.checkpoints));
  assert.equal(plan.checkpoints.length, 1);
  assert.equal(plan.checkpoints[0].failureRisk, "steaming instead of searing");
});

test("planMethod produces likelyFailurePoints from checkpoint risks", () => {
  const plan = planMethod(makeBlueprint());
  assert.ok(Array.isArray(plan.likelyFailurePoints));
  assert.ok(plan.likelyFailurePoints.includes("steaming instead of searing"));
});

test("planMethod generates prep step for protein ingredient", () => {
  const plan = planMethod(makeBlueprint());
  const hasProteinPrep = plan.prepSequence.some((s) => /chicken|protein/i.test(s));
  assert.ok(hasProteinPrep);
});

test("planMethod finish sequence references blueprint finishStrategy", () => {
  const plan = planMethod(makeBlueprint());
  const hasFinish = plan.finishSequence.some((s) => /herb|finish|season|serve/i.test(s));
  assert.ok(hasFinish);
});

test("planMethod produces hold points for protein-containing blueprints", () => {
  const plan = planMethod(makeBlueprint());
  assert.ok(Array.isArray(plan.holdPoints));
  assert.ok(plan.holdPoints.length > 0, "should have rest hold point for protein");
});

test("planMethod produces extra hold point for baked_casseroles family", () => {
  const plan = planMethod(
    makeBlueprint({
      dishFamily: "baked_casseroles",
      components: [
        {
          name: "casserole filling",
          purpose: "main",
          ingredients: [{ name: "chicken", role: "protein", rationale: "main protein" }],
          cookMethod: "bake",
          textureTarget: null,
        },
      ],
    })
  );
  const hasCasseroleRest = plan.holdPoints.some((h) => /casserole|rest.*cut/i.test(h));
  assert.ok(hasCasseroleRest);
});

test("planMethod cook sequence references component cook methods", () => {
  const plan = planMethod(makeBlueprint());
  const hasSear = plan.activeCookSequence.some((s) => /sear|chicken/i.test(s));
  const hasSauce = plan.activeCookSequence.some((s) => /sauce|deglaze/i.test(s));
  assert.ok(hasSear);
  assert.ok(hasSauce);
});
