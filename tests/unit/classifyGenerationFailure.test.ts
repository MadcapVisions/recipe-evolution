import test from "node:test";
import assert from "node:assert/strict";
import { classifyGenerationFailure } from "../../lib/ai/recovery/classifyGenerationFailure";

test("classifyGenerationFailure: low premise trust → PREMISE_UNCERTAIN", () => {
  const result = classifyGenerationFailure({
    failureKind: "verification_failed",
    premiseTrust: "none",
  });
  assert.equal(result.failureType, "PREMISE_UNCERTAIN");
  assert.equal(result.recoveryStrategy, "ASK_CLARIFY");
});

test("classifyGenerationFailure: family mismatch between resolved and verified → PREMISE_UNCERTAIN", () => {
  const result = classifyGenerationFailure({
    failureKind: "verification_failed",
    premiseTrust: "medium",
    resolvedFamily: "bread",
    verifiedFamily: "cake",
  });
  assert.equal(result.failureType, "PREMISE_UNCERTAIN");
  assert.equal(result.recoveryStrategy, "ASK_CLARIFY");
});

test("classifyGenerationFailure: dish_pivot with dish_specific constraints → STATE_CONTAMINATION", () => {
  const result = classifyGenerationFailure({
    failureKind: "verification_failed",
    premiseTrust: "high",
    pivotDetected: "dish_pivot",
    hadDishSpecificConstraints: true,
  });
  assert.equal(result.failureType, "STATE_CONTAMINATION");
  assert.equal(result.recoveryStrategy, "CLEAR_DISH_STATE_AND_REBUILD");
});

test("classifyGenerationFailure: parse failure → STRUCTURE_INVALID", () => {
  const result = classifyGenerationFailure({
    failureKind: "parse_failed",
    premiseTrust: "high",
  });
  assert.equal(result.failureType, "STRUCTURE_INVALID");
  assert.equal(result.recoveryStrategy, "REPAIR_STRUCTURE_ONLY");
});

test("classifyGenerationFailure: no structured output → STRUCTURE_INVALID", () => {
  const result = classifyGenerationFailure({
    failureKind: "verification_failed",
    premiseTrust: "high",
    hasStructuredOutput: false,
  });
  assert.equal(result.failureType, "STRUCTURE_INVALID");
  assert.equal(result.recoveryStrategy, "REPAIR_STRUCTURE_ONLY");
});

test("classifyGenerationFailure: constraint conflicts → CONSTRAINT_IMPOSSIBLE", () => {
  const result = classifyGenerationFailure({
    failureKind: "verification_failed",
    premiseTrust: "high",
    constraintConflicts: ["vegan but requires parmesan"],
  });
  assert.equal(result.failureType, "CONSTRAINT_IMPOSSIBLE");
  assert.equal(result.recoveryStrategy, "NO_RETRY");
});

test("classifyGenerationFailure: model_error → MODEL_FAILURE with regenerate strategy", () => {
  const result = classifyGenerationFailure({
    failureKind: "model_error",
    premiseTrust: "high",
  });
  assert.equal(result.failureType, "MODEL_FAILURE");
  assert.equal(result.recoveryStrategy, "REGENERATE_FROM_INTENT");
});

test("classifyGenerationFailure: always returns confidence and reasoning", () => {
  const result = classifyGenerationFailure({ failureKind: "generation_failed" });
  assert.equal(typeof result.confidence, "number");
  assert.ok(result.confidence >= 0 && result.confidence <= 1);
  assert.equal(typeof result.reasoning, "string");
  assert.ok(result.reasoning.length > 0);
});
