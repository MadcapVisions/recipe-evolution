export const VERIFICATION_RETRY_STRATEGIES = [
  "none",
  "regenerate_same_model",
  "regenerate_stricter",
  "upgrade_model",
  "try_fallback_model",
  "ask_user",
] as const;

export type VerificationRetryStrategy = (typeof VERIFICATION_RETRY_STRATEGIES)[number];

export type VerificationResult = {
  passes: boolean;
  confidence: number;
  score: number;
  reasons: string[];
  checks: {
    dish_family_match: boolean;
    style_match: boolean;
    centerpiece_match: boolean;
    required_ingredients_present: boolean;
    forbidden_ingredients_avoided: boolean;
    title_quality_pass: boolean;
    recipe_completeness_pass: boolean;
  };
  retry_strategy: VerificationRetryStrategy;
};

export function createFailedVerificationResult(reason: string, retryStrategy: VerificationRetryStrategy = "ask_user"): VerificationResult {
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
