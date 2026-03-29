import type { VerificationResult } from "./contracts/verificationResult";

export const LAUNCH_MODES = [
  "SHOW_RECIPE",
  "SHOW_RECIPE_WITH_WARNING",
  "CLARIFY_INTENT",
  "CONSTRAINT_CONFLICT",
  "MISSING_REQUIRED_INGREDIENT",
  "GENERATION_RECOVERY",
  "HARD_FAIL",
] as const;

export type LaunchMode = (typeof LAUNCH_MODES)[number];

export type SuggestedAction = {
  label: string;
  retryMode: "prioritize_required_ingredients" | "simplify" | "relax_required" | "clarify";
  retryParams?: {
    relaxRequiredNamedIngredients?: string[];
    simplifyRequest?: boolean;
    clarificationChoice?: string;
  };
};

export type LaunchDecision = {
  mode: LaunchMode;
  confidence: number;
  primaryMessage: string;
  warningLabel?: string;
  suggestedActions: SuggestedAction[];
  issueCodes: string[];
};

// ── Issue code buckets ──────────────────────────────────────────────────────

const INTENT_FAILURE_CODES = new Set([
  "DISH_FAMILY_MISMATCH",
  "CENTERPIECE_MISMATCH",
  "SPECIFIC_DISH_MISMATCH",
  "STYLE_MISMATCH",
]);

const GENERATION_FAILURE_CODES = new Set([
  "TITLE_QUALITY_FAIL",
  "RECIPE_INCOMPLETE",
  "PARSE_FAILED",
  "SCHEMA_FAILED",
  "GENERATION_FAILED",
]);

/** Map VerificationResult.checks → normalized issue codes. */
export function extractVerifierIssueCodes(
  checks: VerificationResult["checks"] | Record<string, boolean | undefined>
): string[] {
  const codes: string[] = [];
  if (checks.dish_family_match === false) codes.push("DISH_FAMILY_MISMATCH");
  if (checks.centerpiece_match === false) codes.push("CENTERPIECE_MISMATCH");
  if (checks.style_match === false) codes.push("STYLE_MISMATCH");
  if (checks.selected_direction_match === false) codes.push("SPECIFIC_DISH_MISMATCH");
  if (checks.required_ingredients_present === false) codes.push("REQUIRED_INGREDIENT_MISSING");
  if (checks.forbidden_ingredients_avoided === false) codes.push("FORBIDDEN_INGREDIENT_PRESENT");
  if (checks.title_quality_pass === false) codes.push("TITLE_QUALITY_FAIL");
  if (checks.recipe_completeness_pass === false) codes.push("RECIPE_INCOMPLETE");
  if (checks.culinary_family_valid === false) codes.push("CULINARY_FAMILY_INVALID");
  if (checks.required_named_ingredients_present === false) codes.push("REQUIRED_NAMED_INGREDIENT_MISSING");
  if (checks.required_named_ingredients_used_in_steps === false) codes.push("REQUIRED_NAMED_INGREDIENT_NOT_IN_STEPS");
  return codes;
}

/** Map a terminal failure kind → structural issue code. */
export function extractFailureKindCode(failureKind: string | null | undefined): string | null {
  if (failureKind === "invalid_payload" || failureKind === "structural_validation_failed") return "PARSE_FAILED";
  if (failureKind === "generation_failed") return "GENERATION_FAILED";
  if (failureKind === "input_conflict") return "INPUT_CONFLICT";
  return null;
}

function computeConfidence(input: {
  plannerRetries: number;
  repairAttempts: number;
  usedFallback: boolean;
}): number {
  return Math.max(0.1, 1.0 - 0.2 * input.plannerRetries - 0.2 * input.repairAttempts - (input.usedFallback ? 0.2 : 0));
}

export function mapToLaunchDecision(input: {
  issueCodes: string[];
  plannerRetries: number;
  repairAttempts: number;
  usedFallback: boolean;
  reasons: string[];
  requiredNamedIngredientNames?: string[];
}): LaunchDecision {
  const { issueCodes, plannerRetries, repairAttempts, usedFallback, reasons } = input;
  const codeSet = new Set(issueCodes);
  const confidence = computeConfidence({ plannerRetries, repairAttempts, usedFallback });

  // No issues → clean success (or low-confidence warning)
  if (issueCodes.length === 0) {
    if (confidence < 0.6) {
      return {
        mode: "SHOW_RECIPE_WITH_WARNING",
        confidence,
        primaryMessage: "Recipe built, though multiple retries were needed.",
        warningLabel: "Built with retries",
        suggestedActions: [],
        issueCodes: [],
      };
    }
    return {
      mode: "SHOW_RECIPE",
      confidence,
      primaryMessage: "",
      suggestedActions: [],
      issueCodes: [],
    };
  }

  // Hard-required named ingredient missing (user's explicit "use X" request)
  if (codeSet.has("REQUIRED_NAMED_INGREDIENT_MISSING") || codeSet.has("REQUIRED_NAMED_INGREDIENT_NOT_IN_STEPS")) {
    return {
      mode: "MISSING_REQUIRED_INGREDIENT",
      confidence,
      primaryMessage:
        reasons.find((r) => r.includes("required ingredient")) ??
        "Chef couldn't include an ingredient you requested.",
      suggestedActions: [
        { label: "Try again with that ingredient", retryMode: "prioritize_required_ingredients" },
        ...(input.requiredNamedIngredientNames?.length
          ? [
              {
                label: "Build without that requirement",
                retryMode: "relax_required" as const,
                retryParams: { relaxRequiredNamedIngredients: input.requiredNamedIngredientNames },
              },
            ]
          : []),
      ],
      issueCodes,
    };
  }

  // Constraint conflict (forbidden ingredient present or culinary structure invalid)
  if (codeSet.has("FORBIDDEN_INGREDIENT_PRESENT") || codeSet.has("CULINARY_FAMILY_INVALID") || codeSet.has("INPUT_CONFLICT")) {
    return {
      mode: "CONSTRAINT_CONFLICT",
      confidence,
      primaryMessage: reasons[0] ?? "Your constraints may conflict with this dish style.",
      suggestedActions: [
        { label: "Clarify the change", retryMode: "clarify" },
        { label: "Simplify and retry", retryMode: "simplify", retryParams: { simplifyRequest: true } },
      ],
      issueCodes,
    };
  }

  // Intent failure (dish drifted, centerpiece lost, style mismatch)
  if (issueCodes.some((c) => INTENT_FAILURE_CODES.has(c))) {
    return {
      mode: "CLARIFY_INTENT",
      confidence,
      primaryMessage: "Chef kept drifting from your direction. Could you clarify what you're going for?",
      suggestedActions: [
        { label: "Try again", retryMode: "prioritize_required_ingredients" },
        { label: "Simplify the request", retryMode: "simplify", retryParams: { simplifyRequest: true } },
      ],
      issueCodes,
    };
  }

  // Required ingredient missing from brief (non-named)
  if (codeSet.has("REQUIRED_INGREDIENT_MISSING")) {
    return {
      mode: "MISSING_REQUIRED_INGREDIENT",
      confidence,
      primaryMessage:
        reasons.find((r) => r.toLowerCase().includes("required")) ??
        "Chef couldn't include all required ingredients.",
      suggestedActions: [
        { label: "Try again", retryMode: "prioritize_required_ingredients" },
        { label: "Simplify the request", retryMode: "simplify", retryParams: { simplifyRequest: true } },
      ],
      issueCodes,
    };
  }

  // Structural / generation failure
  if (issueCodes.some((c) => GENERATION_FAILURE_CODES.has(c))) {
    if (confidence < 0.4) {
      return {
        mode: "HARD_FAIL",
        confidence,
        primaryMessage: "Chef couldn't produce a complete recipe for this request. Try simplifying your direction.",
        suggestedActions: [
          { label: "Try a simpler version", retryMode: "simplify", retryParams: { simplifyRequest: true } },
        ],
        issueCodes,
      };
    }
    return {
      mode: "GENERATION_RECOVERY",
      confidence,
      primaryMessage: "Chef had trouble building this recipe. One more try might work.",
      suggestedActions: [{ label: "Try again", retryMode: "prioritize_required_ingredients" }],
      issueCodes,
    };
  }

  // Catch-all
  return {
    mode: confidence < 0.5 ? "GENERATION_RECOVERY" : "HARD_FAIL",
    confidence,
    primaryMessage: "Chef couldn't build a reliable recipe from this conversation.",
    suggestedActions: [
      { label: "Try again", retryMode: "prioritize_required_ingredients" },
      { label: "Simplify the request", retryMode: "simplify", retryParams: { simplifyRequest: true } },
    ],
    issueCodes,
  };
}
