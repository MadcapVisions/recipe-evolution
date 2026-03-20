"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldAutoRetryRecipeBuild = shouldAutoRetryRecipeBuild;
exports.buildRetryRecipePlan = buildRetryRecipePlan;
exports.buildRetryInstructions = buildRetryInstructions;
function unique(values) {
    return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}
function shouldAutoRetryRecipeBuild(retryStrategy, attemptNumber) {
    if (attemptNumber >= 2) {
        return false;
    }
    return retryStrategy === "regenerate_same_model" || retryStrategy === "regenerate_stricter";
}
function buildRetryRecipePlan(recipePlan, input) {
    const strictnessNote = input.retryStrategy === "regenerate_stricter"
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
function buildRetryInstructions(input) {
    const header = input.retryStrategy === "regenerate_stricter"
        ? `This is retry attempt ${input.attemptNumber}. The previous draft failed verification.`
        : `This is retry attempt ${input.attemptNumber}. The previous draft was incomplete or malformed.`;
    return [
        header,
        ...input.reasons.map((reason) => `Do not repeat this failure: ${reason}`),
        "Follow the structured cooking brief and recipe plan exactly.",
        "If the user locked an exact dish, keep that exact dish family and title direction.",
    ];
}
