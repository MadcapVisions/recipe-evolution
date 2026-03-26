import type { CulinaryViolation } from "../culinaryValidator";

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
  failure_stage?: "parse" | "schema" | "semantic" | "generation";
  failure_context?: Record<string, unknown> | null;
  checks: {
    dish_family_match: boolean;
    style_match: boolean;
    centerpiece_match: boolean;
    required_ingredients_present: boolean;
    forbidden_ingredients_avoided: boolean;
    title_quality_pass: boolean;
    recipe_completeness_pass: boolean;
    culinary_family_valid?: boolean;
  };
  culinary_violations?: CulinaryViolation[];
  retry_strategy: VerificationRetryStrategy;
};

export function createFailedVerificationResult(
  reason: string,
  retryStrategy: VerificationRetryStrategy = "ask_user",
  extra?: {
    failure_stage?: "parse" | "schema" | "semantic" | "generation";
    failure_context?: Record<string, unknown> | null;
  }
): VerificationResult {
  return {
    passes: false,
    confidence: 0,
    score: 0,
    reasons: [reason],
    failure_stage: extra?.failure_stage,
    failure_context: extra?.failure_context ?? null,
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
