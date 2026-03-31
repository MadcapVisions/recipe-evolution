// tests/unit/enrichBriefWithIntent.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { enrichBriefWithIntent } from "../../lib/ai/intent/enrichBriefWithIntent";
import { createEmptyCookingBrief } from "../../lib/ai/contracts/cookingBrief";
import type { ResolvedCookingIntent } from "../../lib/ai/intent/intentTypes";

function makeIntent(overrides: Partial<ResolvedCookingIntent> = {}): ResolvedCookingIntent {
  return {
    dishName: "Sourdough Bread",
    rawUserPhrase: "make me sourdough bread",
    dishFamily: "bread",
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
    requestId: "test-1",
    resolvedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("enrichBriefWithIntent: overrides dish_family when confidence >= 0.7 and family is known", () => {
  const brief = createEmptyCookingBrief();
  brief.dish.dish_family = null;
  const intent = makeIntent({ dishFamily: "bread", dishFamilyConfidence: 0.9 });
  const enriched = enrichBriefWithIntent(brief, intent);
  assert.equal(enriched.dish.dish_family, "bread");
  assert.equal(enriched.field_state.dish_family, "inferred");
});

test("enrichBriefWithIntent: does not override when confidence < 0.7", () => {
  const brief = createEmptyCookingBrief();
  brief.dish.dish_family = null;
  const intent = makeIntent({ dishFamily: "bread", dishFamilyConfidence: 0.6 });
  const enriched = enrichBriefWithIntent(brief, intent);
  assert.equal(enriched.dish.dish_family, null);
});

test("enrichBriefWithIntent: does not override when dish_family is null", () => {
  const brief = createEmptyCookingBrief();
  brief.dish.dish_family = "pasta";
  const intent = makeIntent({ dishFamily: null, dishFamilyConfidence: 0 });
  const enriched = enrichBriefWithIntent(brief, intent);
  assert.equal(enriched.dish.dish_family, "pasta");
});

test("enrichBriefWithIntent: does not override locked dish_family", () => {
  const brief = createEmptyCookingBrief();
  brief.dish.dish_family = "soup";
  brief.field_state.dish_family = "locked";
  const intent = makeIntent({ dishFamily: "bread", dishFamilyConfidence: 0.95 });
  const enriched = enrichBriefWithIntent(brief, intent);
  assert.equal(enriched.dish.dish_family, "soup");
  assert.equal(enriched.field_state.dish_family, "locked");
});

test("enrichBriefWithIntent: does not override when dish_family is not in canonical list", () => {
  const brief = createEmptyCookingBrief();
  brief.dish.dish_family = null;
  // "stew" is not in DISH_FAMILIES — should be treated as unknown
  const intent = makeIntent({
    dishFamily: "stew" as unknown as string,
    dishFamilyConfidence: 0.95,
  });
  const enriched = enrichBriefWithIntent(brief, intent);
  assert.equal(enriched.dish.dish_family, null);
});

test("enrichBriefWithIntent: returns same object reference when no change is made", () => {
  const brief = createEmptyCookingBrief();
  brief.dish.dish_family = null;
  const intent = makeIntent({ dishFamily: "bread", dishFamilyConfidence: 0.5 });
  const enriched = enrichBriefWithIntent(brief, intent);
  // Low confidence → no change → same reference returned
  assert.strictEqual(enriched, brief);
});

test("enrichBriefWithIntent: does not mutate the input brief", () => {
  const brief = createEmptyCookingBrief();
  brief.dish.dish_family = null;
  const intent = makeIntent({ dishFamily: "bread", dishFamilyConfidence: 0.9 });
  enrichBriefWithIntent(brief, intent);
  // Original brief should not have been mutated
  assert.equal(brief.dish.dish_family, null);
});
