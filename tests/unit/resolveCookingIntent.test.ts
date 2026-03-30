import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveCookingIntent,
} from "../../lib/ai/intent/resolveCookingIntent";
import type { DishFamilyClassificationResult } from "../../lib/ai/intent/dishFamilyClassifier";

// Mock classifier — synchronous, returns deterministic result
function mockClassifier(
  result: Partial<DishFamilyClassificationResult>
) {
  return async (): Promise<DishFamilyClassificationResult> => ({
    family: null,
    confidence: 0.5,
    source: "null_low_confidence",
    reasoning: "mock",
    ...result,
  });
}

test("resolveCookingIntent: returns deterministic shape for same input", async () => {
  const input = {
    userMessage: "I want chicken tacos",
    requestId: "req-1",
  };
  const deps = {
    classifyFamily: mockClassifier({ family: "tacos", confidence: 0.9, source: "heuristic" as const, reasoning: "matched tacos" }),
  };

  const result1 = await resolveCookingIntent(input, deps);
  const result2 = await resolveCookingIntent(input, deps);

  assert.ok("dishName" in result1);
  assert.ok("dishFamily" in result1);
  assert.ok("premiseTrust" in result1);
  assert.ok("requiresClarification" in result1);
  assert.ok("requestId" in result1);
  assert.ok("resolvedAt" in result1);

  assert.equal(result1.dishFamily, result2.dishFamily);
  assert.equal(result1.premiseTrust, result2.premiseTrust);
  assert.equal(result1.requiresClarification, result2.requiresClarification);
});

test("resolveCookingIntent: high-confidence family sets premiseTrust to high", async () => {
  const result = await resolveCookingIntent(
    { userMessage: "chicken tacos please", requestId: "req-2" },
    { classifyFamily: mockClassifier({ family: "tacos", confidence: 0.9, source: "heuristic" as const, reasoning: "matched" }) }
  );
  assert.equal(result.premiseTrust, "high");
  assert.equal(result.requiresClarification, false);
});

test("resolveCookingIntent: low-confidence family sets premiseTrust to low and requiresClarification", async () => {
  const result = await resolveCookingIntent(
    { userMessage: "make something interesting", requestId: "req-3" },
    { classifyFamily: mockClassifier({ family: null, confidence: 0.2, source: "null_low_confidence" as const, reasoning: "no match" }) }
  );
  assert.ok(result.premiseTrust === "low" || result.premiseTrust === "none");
  assert.equal(result.requiresClarification, true);
  assert.ok(result.clarificationReason !== null);
});

test("resolveCookingIntent: current user message wins over persisted brief", async () => {
  const result = await resolveCookingIntent(
    {
      userMessage: "make chicken tacos",
      requestId: "req-4",
      cookingBrief: {
        request_mode: "locked",
        confidence: 0.9,
        ambiguity_reason: null,
        dish: {
          raw_user_phrase: "pasta carbonara",
          normalized_name: "Pasta Carbonara",
          dish_family: "pasta",
          cuisine: "italian",
          course: null,
          authenticity_target: null,
        },
        style: { tags: [], texture_tags: [], format_tags: [] },
        ingredients: { required: [], preferred: [], forbidden: [], centerpiece: null },
        constraints: { servings: null, time_max_minutes: null, difficulty_target: null, dietary_tags: [], equipment_limits: [] },
        directives: { must_have: [], nice_to_have: [], must_not_have: [], required_techniques: [] },
        field_state: { dish_family: "locked", normalized_name: "locked", cuisine: "inferred", ingredients: "inferred", constraints: "unknown" },
        source_turn_ids: [],
        compiler_notes: [],
      },
    },
    { classifyFamily: mockClassifier({ family: "tacos", confidence: 0.85, source: "heuristic" as const, reasoning: "tacos from user msg" }) }
  );
  assert.equal(result.dishFamily, "tacos");
});

test("resolveCookingIntent: requestId is preserved in output", async () => {
  const result = await resolveCookingIntent(
    { userMessage: "chicken tacos", requestId: "my-request-id-123" },
    { classifyFamily: mockClassifier({ family: "tacos", confidence: 0.9, source: "heuristic" as const, reasoning: "ok" }) }
  );
  assert.equal(result.requestId, "my-request-id-123");
});

test("resolveCookingIntent: dietary tags from user message become user_persistent constraints", async () => {
  const result = await resolveCookingIntent(
    { userMessage: "vegan chicken tacos", requestId: "req-5" },
    { classifyFamily: mockClassifier({ family: "tacos", confidence: 0.85, source: "heuristic" as const, reasoning: "ok" }) }
  );
  const dietaryConstraints = result.constraints.filter((c) => c.type === "dietary");
  assert.ok(dietaryConstraints.length > 0, "should extract vegan dietary constraint");
  assert.ok(dietaryConstraints.every((c) => c.scope === "user_persistent"));
});
