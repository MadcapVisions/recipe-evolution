"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecipeBuildError = exports.RECIPE_BUILD_FAILURE_KINDS = void 0;
exports.isRecipeBuildError = isRecipeBuildError;
exports.getRecipeBuildFailureDetails = getRecipeBuildFailureDetails;
const verificationResult_1 = require("./contracts/verificationResult");
exports.RECIPE_BUILD_FAILURE_KINDS = [
    "verification_failed",
    "invalid_payload",
    "generation_failed",
];
class RecipeBuildError extends Error {
    kind;
    verification;
    retryStrategy;
    reasons;
    constructor(input) {
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
exports.RecipeBuildError = RecipeBuildError;
function isRecipeBuildError(error) {
    return error instanceof RecipeBuildError;
}
function getRecipeBuildFailureDetails(error, fallbackMessage = "Recipe generation failed.") {
    if (isRecipeBuildError(error)) {
        return {
            message: error.message,
            kind: error.kind,
            verification: error.verification ??
                (0, verificationResult_1.createFailedVerificationResult)(error.message, error.retryStrategy),
            retryStrategy: error.retryStrategy,
            reasons: error.reasons.length > 0 ? error.reasons : [error.message],
            outcome: error.kind === "verification_failed"
                ? "failed_verification"
                : error.kind === "invalid_payload"
                    ? "parse_failed"
                    : "generation_failed",
        };
    }
    const message = error instanceof Error && error.message.trim().length > 0 ? error.message.trim() : fallbackMessage;
    return {
        message,
        kind: "generation_failed",
        verification: (0, verificationResult_1.createFailedVerificationResult)(message, "ask_user"),
        retryStrategy: "ask_user",
        reasons: [message],
        outcome: "generation_failed",
    };
}
