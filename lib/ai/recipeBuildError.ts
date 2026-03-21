import { createFailedVerificationResult, type VerificationResult, type VerificationRetryStrategy } from "./contracts/verificationResult";

export const RECIPE_BUILD_FAILURE_KINDS = [
  "verification_failed",
  "invalid_payload",
  "generation_failed",
] as const;

export type RecipeBuildFailureKind = (typeof RECIPE_BUILD_FAILURE_KINDS)[number];

export class RecipeBuildError extends Error {
  readonly kind: RecipeBuildFailureKind;
  readonly verification: VerificationResult | null;
  readonly retryStrategy: VerificationRetryStrategy;
  readonly reasons: string[];

  constructor(input: {
    message: string;
    kind: RecipeBuildFailureKind;
    verification?: VerificationResult | null;
    retryStrategy?: VerificationRetryStrategy;
    reasons?: string[];
  }) {
    super(input.message);
    this.name = "RecipeBuildError";
    this.kind = input.kind;
    this.verification = input.verification ?? null;
    this.retryStrategy = input.retryStrategy ?? input.verification?.retry_strategy ?? "ask_user";
    this.reasons =
      input.reasons?.filter((reason) => reason.trim().length > 0) ??
      input.verification?.reasons ??
      [input.message];
  }
}

export function isRecipeBuildError(error: unknown): error is RecipeBuildError {
  return error instanceof RecipeBuildError;
}

export function getRecipeBuildFailureDetails(error: unknown, fallbackMessage = "Recipe generation failed.") {
  if (isRecipeBuildError(error)) {
    return {
      message: error.message,
      kind: error.kind,
      verification:
        error.verification ??
        createFailedVerificationResult(error.message, error.retryStrategy),
      retryStrategy: error.retryStrategy,
      reasons: error.reasons.length > 0 ? error.reasons : [error.message],
      outcome: error.kind === "verification_failed"
        ? "failed_verification"
        : error.kind === "invalid_payload"
        ? "parse_failed"
        : "generation_failed",
    } as const;
  }

  const message = error instanceof Error && error.message.trim().length > 0 ? error.message.trim() : fallbackMessage;
  const isMissingQuantityError = message.includes("Each ingredient needs a quantity");
  const retryStrategy = isMissingQuantityError ? ("regenerate_stricter" as const) : ("ask_user" as const);
  const reasons = isMissingQuantityError
    ? ["Some ingredients are missing explicit quantities. Every ingredient must include a quantity (e.g. '2 tbsp olive oil', '1 onion')."]
    : [message];
  return {
    message,
    kind: "generation_failed" as const,
    verification: createFailedVerificationResult(message, retryStrategy),
    retryStrategy,
    reasons,
    outcome: "generation_failed" as const,
  };
}
