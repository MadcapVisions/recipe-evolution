import test from "node:test";
import assert from "node:assert/strict";
import { checkBlueprintFeasibility } from "../../lib/ai/blueprint/feasibility";
import type { ResolvedCookingIntent } from "../../lib/ai/intent/intentTypes";

function makeIntent(overrides: Partial<ResolvedCookingIntent> = {}): ResolvedCookingIntent {
  return {
    dishName: "Pasta Carbonara",
    rawUserPhrase: "pasta carbonara",
    dishFamily: "pasta",
    dishFamilyConfidence: 0.95,
    cuisineHint: "italian",
    mealOccasion: "dinner",
    intentSource: "explicit_user_message",
    premiseTrust: "high",
    constraints: [],
    ingredientMentions: ["pasta", "eggs", "parmesan", "guanciale"],
    pivotDetected: "no_pivot",
    invalidatedConstraints: [],
    requiresClarification: false,
    clarificationReason: null,
    requestId: "req-feas-001",
    resolvedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("checkBlueprintFeasibility: all-pass for valid launch-family intent", () => {
  const result = checkBlueprintFeasibility(makeIntent());
  assert.equal(result.familyFit, true);
  assert.equal(result.ingredientFit, true);
  assert.equal(result.timeBudgetPlausible, true);
  assert.equal(result.difficultyPlausible, true);
  assert.deepEqual(result.issues, []);
});

test("checkBlueprintFeasibility: familyFit false for unrecognized family", () => {
  const result = checkBlueprintFeasibility(makeIntent({ dishFamily: "mystery_dish" }));
  assert.equal(result.familyFit, false);
  assert.ok(result.issues.length > 0);
});

test("checkBlueprintFeasibility: familyFit false for null family", () => {
  const result = checkBlueprintFeasibility(makeIntent({ dishFamily: null }));
  assert.equal(result.familyFit, false);
  assert.ok(result.issues.length > 0);
});

test("checkBlueprintFeasibility: ingredientFit false when forbidden ingredient is mentioned", () => {
  const intent = makeIntent({
    constraints: [
      {
        type: "forbidden_ingredient",
        value: "pasta",
        scope: "session_active",
        strength: "hard",
        source: "explicit_user",
      },
    ],
  });
  const result = checkBlueprintFeasibility(intent);
  assert.equal(result.ingredientFit, false);
  assert.ok(result.issues.some((i) => i.includes("pasta")));
});

test("checkBlueprintFeasibility: timeBudgetPlausible false for impossibly short time", () => {
  const intent = makeIntent({
    constraints: [
      {
        type: "technique",
        value: "5 min total",
        scope: "session_active",
        strength: "hard",
        source: "explicit_user",
      },
    ],
  });
  const result = checkBlueprintFeasibility(intent);
  assert.equal(result.timeBudgetPlausible, false);
  assert.ok(result.issues.some((i) => i.toLowerCase().includes("time")));
});

test("checkBlueprintFeasibility: timeBudgetPlausible false when shorter than family default", () => {
  // pasta default is 35 min total; requesting 20 min should fail
  const intent = makeIntent({
    constraints: [
      {
        type: "technique",
        value: "20 min total",
        scope: "session_active",
        strength: "hard",
        source: "explicit_user",
      },
    ],
  });
  const result = checkBlueprintFeasibility(intent);
  assert.equal(result.timeBudgetPlausible, false);
});

test("checkBlueprintFeasibility: reasonable time budget passes", () => {
  const intent = makeIntent({
    constraints: [
      {
        type: "technique",
        value: "45 min total",
        scope: "session_active",
        strength: "hard",
        source: "explicit_user",
      },
    ],
  });
  const result = checkBlueprintFeasibility(intent);
  assert.equal(result.timeBudgetPlausible, true);
});

test("checkBlueprintFeasibility: no constraints means all plausible", () => {
  const result = checkBlueprintFeasibility(makeIntent({ constraints: [] }));
  assert.equal(result.timeBudgetPlausible, true);
  assert.equal(result.ingredientFit, true);
});
