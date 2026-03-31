import test from "node:test";
import assert from "node:assert/strict";
import { buildCulinaryBlueprint } from "../../lib/ai/blueprint/buildCulinaryBlueprint";
import type { ResolvedCookingIntent } from "../../lib/ai/intent/intentTypes";

function makeIntent(overrides: Partial<ResolvedCookingIntent> = {}): ResolvedCookingIntent {
  return {
    dishName: "Chicken Stir-Fry",
    rawUserPhrase: "chicken stir fry please",
    dishFamily: "skillet_saute",
    dishFamilyConfidence: 0.9,
    cuisineHint: "asian",
    mealOccasion: "dinner",
    intentSource: "explicit_user_message",
    premiseTrust: "high",
    constraints: [],
    ingredientMentions: ["chicken thigh", "garlic", "soy sauce"],
    pivotDetected: "no_pivot",
    invalidatedConstraints: [],
    requiresClarification: false,
    clarificationReason: null,
    requestId: "req-test-001",
    resolvedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("buildCulinaryBlueprint returns correct identity fields", () => {
  const bp = buildCulinaryBlueprint(makeIntent());
  assert.equal(bp.dishName, "Chicken Stir-Fry");
  assert.equal(bp.dishFamily, "skillet_saute");
  assert.equal(bp.cuisineHint, "asian");
  assert.equal(bp.generatedFrom, "req-test-001");
  assert.ok(bp.generatedAt.length > 0);
});

test("buildCulinaryBlueprint produces components, method, and finish for known family", () => {
  const bp = buildCulinaryBlueprint(makeIntent());
  assert.ok(bp.components.length > 0);
  assert.ok(bp.primaryMethod.length > 0);
  assert.ok(bp.finishStrategy.length > 0);
  assert.ok(bp.sequenceLogic.length > 0);
});

test("buildCulinaryBlueprint assigns roles to mentioned ingredients", () => {
  const bp = buildCulinaryBlueprint(makeIntent());
  const allIngredients = bp.components.flatMap((c) => c.ingredients);
  const soy = allIngredients.find((i) => i.name === "soy sauce");
  const garlic = allIngredients.find((i) => i.name === "garlic");
  if (soy) assert.equal(soy.role, "umami");
  if (garlic) assert.equal(garlic.role, "aromatic");
});

test("buildCulinaryBlueprint produces feasibility flags", () => {
  const bp = buildCulinaryBlueprint(makeIntent());
  assert.equal(typeof bp.feasibility.familyFit, "boolean");
  assert.ok(Array.isArray(bp.feasibility.issues));
});

test("buildCulinaryBlueprint marks familyFit false for unknown family", () => {
  const bp = buildCulinaryBlueprint(makeIntent({ dishFamily: "mystery_dish_xyz" }));
  assert.equal(bp.feasibility.familyFit, false);
  assert.ok(bp.feasibility.issues.length > 0);
});

test("buildCulinaryBlueprint produces checkpoints", () => {
  const bp = buildCulinaryBlueprint(makeIntent({ dishFamily: "chicken_dinners" }));
  assert.ok(bp.checkpoints.length > 0);
  assert.ok(bp.checkpoints[0].failureRisk.length > 0);
  assert.ok(bp.checkpoints[0].description.length > 0);
});

test("buildCulinaryBlueprint is deterministic — same input same output shape", () => {
  const intent = makeIntent();
  const bp1 = buildCulinaryBlueprint(intent);
  const bp2 = buildCulinaryBlueprint(intent);
  assert.equal(bp1.dishFamily, bp2.dishFamily);
  assert.equal(bp1.primaryMethod, bp2.primaryMethod);
  assert.equal(bp1.finishStrategy, bp2.finishStrategy);
  assert.equal(bp1.components.length, bp2.components.length);
});

test("buildCulinaryBlueprint uses rawUserPhrase when dishName is null", () => {
  const bp = buildCulinaryBlueprint(makeIntent({ dishName: null, rawUserPhrase: "something spicy" }));
  assert.equal(bp.dishName, "something spicy");
});

test("buildCulinaryBlueprint produces flavorArchitecture array", () => {
  const bp = buildCulinaryBlueprint(makeIntent());
  assert.ok(Array.isArray(bp.flavorArchitecture));
  assert.ok(bp.flavorArchitecture.length > 0);
});

test("buildCulinaryBlueprint uses FALLBACK_BLUEPRINT_RULE for unknown family without crashing", () => {
  const bp = buildCulinaryBlueprint(makeIntent({ dishFamily: null }));
  assert.ok(bp.components.length > 0);
  assert.ok(bp.primaryMethod.length > 0);
  assert.equal(bp.feasibility.familyFit, false);
});
