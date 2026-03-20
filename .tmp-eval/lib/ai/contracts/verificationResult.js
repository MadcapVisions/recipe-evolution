"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERIFICATION_RETRY_STRATEGIES = void 0;
exports.createFailedVerificationResult = createFailedVerificationResult;
exports.VERIFICATION_RETRY_STRATEGIES = [
    "none",
    "regenerate_same_model",
    "regenerate_stricter",
    "upgrade_model",
    "ask_user",
];
function createFailedVerificationResult(reason, retryStrategy = "ask_user") {
    return {
        passes: false,
        confidence: 0,
        score: 0,
        reasons: [reason],
        checks: {
            dish_family_match: false,
            style_match: false,
            centerpiece_match: false,
            required_ingredients_present: false,
            forbidden_ingredients_avoided: false,
            title_quality_pass: false,
            recipe_completeness_pass: false,
        },
        retry_strategy: retryStrategy,
    };
}
