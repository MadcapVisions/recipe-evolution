import test from "node:test";
import assert from "node:assert/strict";
import { resolvedIntentToBuildSpec } from "../../lib/ai/intent/resolvedIntentToBuildSpec";
import type { ResolvedCookingIntent } from "../../lib/ai/intent/intentTypes";

function makeIntent(overrides: Partial<ResolvedCookingIntent> = {}): ResolvedCookingIntent {
  return {
    dishName: "Chicken Tacos",
    rawUserPhrase: "chicken tacos",
    dishFamily: "tacos",
    dishFamilyConfidence: 0.9,
    cuisineHint: "mexican",
    mealOccasion: "dinner",
    intentSource: "explicit_user_message",
    premiseTrust: "high",
    constraints: [],
    ingredientMentions: [],
    pivotDetected: "no_pivot",
    invalidatedConstraints: [],
    requiresClarification: false,
    clarificationReason: null,
    requestId: "req-test",
    resolvedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("resolvedIntentToBuildSpec: derived_at sentinel is always lock_time", () => {
  const spec = resolvedIntentToBuildSpec(makeIntent());
  assert.equal(spec.derived_at, "lock_time");
});

test("resolvedIntentToBuildSpec: dish_family from intent passes through", () => {
  const spec = resolvedIntentToBuildSpec(makeIntent({ dishFamily: "tacos" }));
  assert.equal(spec.dish_family, "tacos");
});

test("resolvedIntentToBuildSpec: invalid dish_family becomes null", () => {
  const spec = resolvedIntentToBuildSpec(makeIntent({ dishFamily: "not_a_real_family" }));
  assert.equal(spec.dish_family, null);
});

test("resolvedIntentToBuildSpec: null dish_family passes through as null", () => {
  const spec = resolvedIntentToBuildSpec(makeIntent({ dishFamily: null }));
  assert.equal(spec.dish_family, null);
});

test("resolvedIntentToBuildSpec: format-locked family sets must_preserve_format true", () => {
  const spec = resolvedIntentToBuildSpec(makeIntent({ dishFamily: "pasta" }));
  assert.equal(spec.must_preserve_format, true);
});

test("resolvedIntentToBuildSpec: non-format-locked family leaves must_preserve_format false", () => {
  const spec = resolvedIntentToBuildSpec(makeIntent({ dishFamily: "stir_fry" }));
  assert.equal(spec.must_preserve_format, false);
});

test("resolvedIntentToBuildSpec: hard ingredient constraints populate required_ingredients", () => {
  const spec = resolvedIntentToBuildSpec(
    makeIntent({
      constraints: [
        { type: "ingredient", value: "sourdough discard", scope: "session_active", strength: "hard", source: "explicit_user" },
        { type: "ingredient", value: "optional herbs", scope: "session_active", strength: "soft", source: "inferred" },
      ],
    })
  );
  assert.ok(spec.required_ingredients.includes("sourdough discard"));
  assert.ok(!spec.required_ingredients.includes("optional herbs"));
});

test("resolvedIntentToBuildSpec: forbidden_ingredient constraints populate forbidden_ingredients", () => {
  const spec = resolvedIntentToBuildSpec(
    makeIntent({
      constraints: [
        { type: "forbidden_ingredient", value: "walnuts", scope: "user_persistent", strength: "hard", source: "user_settings" },
      ],
    })
  );
  assert.ok(spec.forbidden_ingredients.includes("walnuts"));
});

test("resolvedIntentToBuildSpec: confidence from intent flows to BuildSpec", () => {
  const spec = resolvedIntentToBuildSpec(makeIntent({ dishFamilyConfidence: 0.88 }));
  assert.equal(spec.confidence, 0.88);
});
