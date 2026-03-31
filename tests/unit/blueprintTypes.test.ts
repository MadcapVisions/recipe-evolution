import test from "node:test";
import assert from "node:assert/strict";
import type {
  BlueprintIngredient,
  BlueprintComponent,
  BlueprintCheckpoint,
  FeasibilityFlags,
  CulinaryBlueprint,
} from "../../lib/ai/blueprint/blueprintTypes";

test("CulinaryBlueprint has required identity fields", () => {
  const bp: CulinaryBlueprint = {
    dishName: "Chicken Stir-Fry",
    dishFamily: "skillet_saute",
    cuisineHint: "asian",
    richnessLevel: "moderate",
    flavorArchitecture: ["savory base", "umami depth", "acid finish"],
    components: [],
    primaryMethod: "sear",
    sequenceLogic: "sear protein, build sauce, toss",
    finishStrategy: "fresh herb and sesame oil drizzle",
    textureTargets: ["crispy protein", "tender veg"],
    chefOpportunities: ["high-heat sear for Maillard crust"],
    checkpoints: [],
    feasibility: {
      familyFit: true,
      ingredientFit: true,
      equipmentFit: true,
      timeBudgetPlausible: true,
      difficultyPlausible: true,
      issues: [],
    },
    generatedFrom: "req-abc",
    generatedAt: new Date().toISOString(),
  };

  assert.equal(bp.dishName, "Chicken Stir-Fry");
  assert.equal(bp.richnessLevel, "moderate");
  assert.ok(Array.isArray(bp.components));
  assert.ok(Array.isArray(bp.checkpoints));
  assert.ok(Array.isArray(bp.flavorArchitecture));
  assert.ok(typeof bp.feasibility.familyFit === "boolean");
});

test("BlueprintComponent has ingredient list with role and rationale", () => {
  const comp: BlueprintComponent = {
    name: "seared chicken",
    purpose: "main",
    cookMethod: "sear",
    textureTarget: "crispy exterior, juicy interior",
    ingredients: [
      { name: "chicken thigh", role: "protein", rationale: "main protein source" },
      { name: "neutral oil", role: "fat", rationale: "searing medium" },
    ],
  };

  assert.equal(comp.ingredients[0].role, "protein");
  assert.equal(comp.ingredients[1].role, "fat");
  assert.ok(comp.ingredients[0].rationale.length > 0);
});

test("BlueprintCheckpoint has all required fields", () => {
  const chk: BlueprintCheckpoint = {
    phase: "active_cook",
    description: "Check internal temperature reaches 165°F",
    failureRisk: "undercooked chicken",
  };

  assert.equal(chk.phase, "active_cook");
  assert.ok(chk.description.length > 0);
  assert.ok(chk.failureRisk.length > 0);
});

test("FeasibilityFlags issues is always an array", () => {
  const flags: FeasibilityFlags = {
    familyFit: false,
    ingredientFit: true,
    equipmentFit: true,
    timeBudgetPlausible: true,
    difficultyPlausible: true,
    issues: ["dish family not recognized"],
  };

  assert.equal(flags.familyFit, false);
  assert.ok(Array.isArray(flags.issues));
  assert.equal(flags.issues[0], "dish family not recognized");
});

test("BlueprintIngredient role covers all expected culinary roles", () => {
  const roles: BlueprintIngredient["role"][] = [
    "base", "protein", "aromatic", "fat", "acid", "sweetness",
    "umami", "heat", "texture", "binder", "structure", "liquid",
    "finish", "garnish", "seasoning",
  ];
  // TypeScript validates these at compile time; this confirms runtime shape
  assert.equal(roles.length, 15);
  assert.ok(roles.includes("protein"));
  assert.ok(roles.includes("umami"));
  assert.ok(roles.includes("finish"));
});
