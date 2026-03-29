import test from "node:test";
import assert from "node:assert/strict";
import { createFailedVerificationResult } from "../../lib/ai/contracts/verificationResult";
import { getRecipeBuildFailureDetails, RecipeBuildError } from "../../lib/ai/recipeBuildError";

test("getRecipeBuildFailureDetails preserves structured verification failures", () => {
  const verification = createFailedVerificationResult(
    "Recipe drifted from the requested dish family or direction.",
    "regenerate_stricter"
  );
  const error = new RecipeBuildError({
    message: verification.reasons[0]!,
    kind: "verification_failed",
    verification,
  });

  const details = getRecipeBuildFailureDetails(error);

  assert.equal(details.kind, "verification_failed");
  assert.equal(details.retryStrategy, "regenerate_stricter");
  assert.equal(details.outcome, "failed_verification");
  assert.deepEqual(details.reasons, verification.reasons);
  assert.equal(details.verification?.retry_strategy, "regenerate_stricter");
});

test("getRecipeBuildFailureDetails maps invalid payloads to parse failures", () => {
  const error = new RecipeBuildError({
    message: "AI returned invalid recipe payload.",
    kind: "invalid_payload",
    retryStrategy: "regenerate_same_model",
    rawModelOutput: {
      text: "null",
      provider: "openrouter",
      model: "openai/gpt-4.1",
    },
    provider: "openrouter",
    model: "openai/gpt-4.1",
  });

  const details = getRecipeBuildFailureDetails(error);

  assert.equal(details.kind, "invalid_payload");
  assert.equal(details.outcome, "parse_failed");
  assert.equal(details.retryStrategy, "regenerate_same_model");
  assert.equal(details.reasons[0], "AI returned invalid recipe payload.");
  assert.deepEqual(details.rawModelOutput, {
    text: "null",
    provider: "openrouter",
    model: "openai/gpt-4.1",
  });
  assert.equal(details.provider, "openrouter");
  assert.equal(details.model, "openai/gpt-4.1");
});

test("getRecipeBuildFailureDetails maps structural validation failures to schema failures", () => {
  const error = new RecipeBuildError({
    message: "Recipe ingredient list was missing after normalization.",
    kind: "structural_validation_failed",
    verification: createFailedVerificationResult("Recipe ingredient list was missing after normalization.", "regenerate_same_model", {
      failure_stage: "schema",
      failure_context: {
        structural_checks: {
          ingredients_present: false,
        },
      },
    }),
    retryStrategy: "regenerate_same_model",
  });

  const details = getRecipeBuildFailureDetails(error);

  assert.equal(details.kind, "structural_validation_failed");
  assert.equal(details.outcome, "schema_failed");
  assert.equal(details.retryStrategy, "regenerate_same_model");
  assert.equal(details.reasons[0], "Recipe ingredient list was missing after normalization.");
  assert.equal(details.failureStage, "schema");
  assert.deepEqual(details.failureContext, {
    structural_checks: {
      ingredients_present: false,
    },
  });
});

test("getRecipeBuildFailureDetails preserves normalized recipe snapshots for downstream failure storage", () => {
  const error = new RecipeBuildError({
    message: "Recipe drifted from the requested dish family or direction.",
    kind: "verification_failed",
    verification: createFailedVerificationResult("Recipe drifted from the requested dish family or direction.", "regenerate_stricter"),
    rawModelOutput: {
      text: "{\"title\":\"Chicken Pasta\"}",
      provider: "openrouter",
      model: "openai/gpt-4.1",
    },
    normalizedRecipe: {
      title: "Chicken Pasta",
      ingredients: [{ name: "1 lb chicken" }],
      steps: [{ text: "Cook it." }],
    },
    provider: "openrouter",
    model: "openai/gpt-4.1",
  });

  const details = getRecipeBuildFailureDetails(error);

  assert.deepEqual(details.normalizedRecipe, {
    title: "Chicken Pasta",
    ingredients: [{ name: "1 lb chicken" }],
    steps: [{ text: "Cook it." }],
  });
  assert.equal(details.provider, "openrouter");
  assert.equal(details.model, "openai/gpt-4.1");
});

test("getRecipeBuildFailureDetails maps input conflicts to blocked outcomes", () => {
  const error = new RecipeBuildError({
    message: "This conflicts with the locked slow-cook method.",
    kind: "input_conflict",
    retryStrategy: "clarify",
  });

  const details = getRecipeBuildFailureDetails(error);

  assert.equal(details.kind, "input_conflict");
  assert.equal(details.outcome, "blocked");
  assert.equal(details.retryStrategy, "clarify");
  assert.equal(details.reasons[0], "This conflicts with the locked slow-cook method.");
});
