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
  });

  const details = getRecipeBuildFailureDetails(error);

  assert.equal(details.kind, "invalid_payload");
  assert.equal(details.outcome, "parse_failed");
  assert.equal(details.retryStrategy, "regenerate_same_model");
  assert.equal(details.reasons[0], "AI returned invalid recipe payload.");
});
