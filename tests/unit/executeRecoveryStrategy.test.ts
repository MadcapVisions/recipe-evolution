import test from "node:test";
import assert from "node:assert/strict";
import { executeRecoveryStrategy } from "../../lib/ai/recovery/executeRecoveryStrategy";
import type { ResolvedCookingIntent } from "../../lib/ai/intent/intentTypes";

function makeIntent(overrides: Partial<ResolvedCookingIntent> = {}): ResolvedCookingIntent {
  return {
    dishName: "Chicken Tacos",
    rawUserPhrase: "chicken tacos",
    dishFamily: "tacos",
    dishFamilyConfidence: 0.9,
    cuisineHint: null,
    mealOccasion: null,
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

test("executeRecoveryStrategy: ASK_CLARIFY returns clarification_required outcome", async () => {
  const result = await executeRecoveryStrategy({
    strategy: "ASK_CLARIFY",
    resolvedIntent: makeIntent({ requiresClarification: true, clarificationReason: "Too vague." }),
  });
  assert.equal(result.outcome, "clarification_required");
  assert.ok(result.clarificationMessage !== null && result.clarificationMessage!.length > 0);
});

test("executeRecoveryStrategy: CLEAR_DISH_STATE_AND_REBUILD returns cleared_state outcome", async () => {
  const intent = makeIntent({
    constraints: [
      { type: "equipment", value: "slow cooker", scope: "dish_specific", strength: "hard", source: "explicit_user" },
      { type: "dietary", value: "vegan", scope: "user_persistent", strength: "hard", source: "user_settings" },
    ],
    invalidatedConstraints: [
      { type: "equipment", value: "slow cooker", scope: "dish_specific", strength: "hard", source: "explicit_user" },
    ],
  });
  const result = await executeRecoveryStrategy({
    strategy: "CLEAR_DISH_STATE_AND_REBUILD",
    resolvedIntent: intent,
  });
  assert.equal(result.outcome, "cleared_state");
  assert.ok(result.sanitizedIntent !== null && result.sanitizedIntent !== undefined);
  const sanitized = result.sanitizedIntent!;
  const hasSlowCooker = (sanitized.constraints ?? []).some((c) => c.value === "slow cooker");
  assert.equal(hasSlowCooker, false, "slow cooker should be removed from sanitized intent");
});

test("executeRecoveryStrategy: REGENERATE_FROM_INTENT returns rebuilt_intent outcome", async () => {
  const result = await executeRecoveryStrategy({
    strategy: "REGENERATE_FROM_INTENT",
    resolvedIntent: makeIntent(),
  });
  assert.equal(result.outcome, "rebuilt_intent");
  assert.ok(result.sanitizedIntent !== null && result.sanitizedIntent !== undefined);
});

test("executeRecoveryStrategy: REPAIR_STRUCTURE_ONLY returns structural_repair outcome", async () => {
  const result = await executeRecoveryStrategy({
    strategy: "REPAIR_STRUCTURE_ONLY",
    resolvedIntent: makeIntent(),
  });
  assert.equal(result.outcome, "structural_repair");
});

test("executeRecoveryStrategy: NO_RETRY returns stopped outcome", async () => {
  const result = await executeRecoveryStrategy({
    strategy: "NO_RETRY",
    resolvedIntent: makeIntent(),
    rawFailureReason: "Dietary constraints are contradictory.",
  });
  assert.equal(result.outcome, "stopped");
  assert.ok(result.conflictDetails !== null && result.conflictDetails !== undefined);
});

test("executeRecoveryStrategy: always returns the strategy in result", async () => {
  const result = await executeRecoveryStrategy({
    strategy: "REGENERATE_FROM_INTENT",
    resolvedIntent: makeIntent(),
  });
  assert.equal(result.strategy, "REGENERATE_FROM_INTENT");
});
