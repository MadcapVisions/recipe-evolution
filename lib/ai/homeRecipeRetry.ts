import type { RecipePlan } from "./contracts/recipePlan";
import type { VerificationRetryStrategy } from "./contracts/verificationResult";

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}

export function shouldAutoRetryRecipeBuild(retryStrategy: VerificationRetryStrategy, attemptNumber: number) {
  if (retryStrategy === "try_fallback_model") {
    return attemptNumber < 3;
  }

  if (attemptNumber >= 2) {
    return false;
  }

  return retryStrategy === "regenerate_same_model" || retryStrategy === "regenerate_stricter";
}

export function buildRetryRecipePlan(
  recipePlan: RecipePlan,
  input: {
    retryStrategy: VerificationRetryStrategy;
    reasons: string[];
    attemptNumber: number;
  }
): RecipePlan {
  const strictnessNote =
    input.retryStrategy === "regenerate_stricter"
      ? "Retry with stricter alignment to the locked dish family, title, and ingredient constraints."
      : "Retry the recipe build and resolve the failed checks from the previous draft.";

  return {
    ...recipePlan,
    notes: unique([
      ...recipePlan.notes,
      strictnessNote,
      ...input.reasons.map((reason) => `Previous draft failed because: ${reason}`),
      `Retry attempt ${input.attemptNumber}: preserve the brief exactly and do not drift to adjacent dishes.`,
    ]),
  };
}

export function buildRetryInstructions(input: {
  retryStrategy: VerificationRetryStrategy;
  reasons: string[];
  attemptNumber: number;
}) {
  const header =
    input.retryStrategy === "regenerate_stricter"
      ? `This is retry attempt ${input.attemptNumber}. The previous draft failed verification.`
      : `This is retry attempt ${input.attemptNumber}. The previous draft was incomplete or malformed.`;

  return [
    header,
    ...input.reasons.map((reason) => `Do not repeat this failure: ${reason}`),
    "Follow the structured cooking brief and recipe plan exactly.",
    "If the user locked an exact dish, keep that exact dish family and title direction.",
  ];
}
