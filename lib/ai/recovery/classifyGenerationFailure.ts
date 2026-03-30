export type GenerationFailureType =
  | "PREMISE_UNCERTAIN"
  | "STATE_CONTAMINATION"
  | "STRUCTURE_INVALID"
  | "CULINARY_INCOHERENT"
  | "CONSTRAINT_IMPOSSIBLE"
  | "LOW_CONFIDENCE_QUALITY"
  | "MODEL_FAILURE"
  | "HARD_FAIL";

export type RecoveryStrategy =
  | "ASK_CLARIFY"
  | "CLEAR_DISH_STATE_AND_REBUILD"
  | "REGENERATE_FROM_INTENT"
  | "REPAIR_STRUCTURE_ONLY"
  | "NO_RETRY";

export type GenerationFailureClassification = {
  failureType: GenerationFailureType;
  recoveryStrategy: RecoveryStrategy;
  confidence: number;
  reasoning: string;
};

export type ClassifyGenerationFailureInput = {
  failureKind: string;
  premiseTrust?: "high" | "medium" | "low" | "none" | null;
  resolvedFamily?: string | null;
  verifiedFamily?: string | null;
  pivotDetected?: "dish_pivot" | "style_pivot" | "constraint_pivot" | "no_pivot" | null;
  hadDishSpecificConstraints?: boolean;
  constraintConflicts?: string[] | null;
  hasStructuredOutput?: boolean;
  attemptNumber?: number;
};

export function classifyGenerationFailure(
  input: ClassifyGenerationFailureInput
): GenerationFailureClassification {
  // 1. Impossible constraints — stop immediately
  if (input.constraintConflicts && input.constraintConflicts.length > 0) {
    return {
      failureType: "CONSTRAINT_IMPOSSIBLE",
      recoveryStrategy: "NO_RETRY",
      confidence: 0.95,
      reasoning: `Constraint conflicts detected: ${input.constraintConflicts.join("; ")}`,
    };
  }

  // 2. Parse / structure failure
  if (
    input.failureKind === "parse_failed" ||
    input.hasStructuredOutput === false
  ) {
    return {
      failureType: "STRUCTURE_INVALID",
      recoveryStrategy: "REPAIR_STRUCTURE_ONLY",
      confidence: 0.9,
      reasoning: "Generation output could not be parsed or was missing required structure.",
    };
  }

  // 3. Model error
  if (input.failureKind === "model_error" || input.failureKind === "generation_failed") {
    return {
      failureType: "MODEL_FAILURE",
      recoveryStrategy: "REGENERATE_FROM_INTENT",
      confidence: 0.85,
      reasoning: `Model-level failure: ${input.failureKind}`,
    };
  }

  // 4. State contamination — dish pivot with dish-specific constraints
  if (
    input.pivotDetected === "dish_pivot" &&
    input.hadDishSpecificConstraints === true
  ) {
    return {
      failureType: "STATE_CONTAMINATION",
      recoveryStrategy: "CLEAR_DISH_STATE_AND_REBUILD",
      confidence: 0.85,
      reasoning:
        "Dish pivot detected and dish-specific constraints were present — likely contamination from prior session state.",
    };
  }

  // 5. Premise uncertain — no trust or family mismatch
  const premiseMismatch =
    input.resolvedFamily &&
    input.verifiedFamily &&
    input.resolvedFamily !== input.verifiedFamily;

  if (
    input.premiseTrust === "none" ||
    input.premiseTrust === "low" ||
    premiseMismatch
  ) {
    return {
      failureType: "PREMISE_UNCERTAIN",
      recoveryStrategy: "ASK_CLARIFY",
      confidence: 0.8,
      reasoning: premiseMismatch
        ? `Family mismatch: resolved "${input.resolvedFamily}" but verifier found "${input.verifiedFamily}".`
        : `Premise trust is "${input.premiseTrust ?? "unknown"}" — dish identity is ambiguous.`,
    };
  }

  // 6. Default — low confidence quality failure
  return {
    failureType: "LOW_CONFIDENCE_QUALITY",
    recoveryStrategy: "REGENERATE_FROM_INTENT",
    confidence: 0.6,
    reasoning: `Generation failed with kind "${input.failureKind}" — treating as quality failure.`,
  };
}
