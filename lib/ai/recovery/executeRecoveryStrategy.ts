import type { RecoveryStrategy } from "./classifyGenerationFailure";
import type { ResolvedCookingIntent, ResolvedConstraint } from "../intent/intentTypes";

export type RecoveryExecutionResult = {
  strategy: RecoveryStrategy;
  outcome:
    | "rebuilt_intent"
    | "cleared_state"
    | "structural_repair"
    | "clarification_required"
    | "stopped";
  sanitizedIntent?: Partial<ResolvedCookingIntent> | null;
  clarificationMessage?: string | null;
  conflictDetails?: string | null;
};

/**
 * Executes a typed recovery strategy.
 *
 * Key invariant: never appends contradictory notes to the existing prompt or brief.
 * Each strategy either rebuilds from sanitized intent, clears state, or stops.
 */
export async function executeRecoveryStrategy(input: {
  strategy: RecoveryStrategy;
  resolvedIntent: ResolvedCookingIntent;
  rawFailureReason?: string | null;
}): Promise<RecoveryExecutionResult> {
  const { strategy, resolvedIntent } = input;

  switch (strategy) {
    case "ASK_CLARIFY": {
      return {
        strategy,
        outcome: "clarification_required",
        clarificationMessage:
          resolvedIntent.clarificationReason ??
          "Your request needs a bit more detail. Try naming a specific dish or ingredient.",
      };
    }

    case "CLEAR_DISH_STATE_AND_REBUILD": {
      // Drop all dish_specific and retry_local constraints; keep user_persistent and session_active
      const cleanedConstraints: ResolvedConstraint[] = resolvedIntent.constraints.filter(
        (c) => c.scope === "user_persistent" || c.scope === "session_active"
      );
      return {
        strategy,
        outcome: "cleared_state",
        sanitizedIntent: {
          ...resolvedIntent,
          constraints: cleanedConstraints,
          invalidatedConstraints: [
            ...resolvedIntent.invalidatedConstraints,
            ...resolvedIntent.constraints.filter(
              (c) => c.scope === "dish_specific" || c.scope === "retry_local"
            ),
          ],
          pivotDetected: "dish_pivot",
        },
      };
    }

    case "REGENERATE_FROM_INTENT": {
      return {
        strategy,
        outcome: "rebuilt_intent",
        sanitizedIntent: resolvedIntent,
      };
    }

    case "REPAIR_STRUCTURE_ONLY": {
      return {
        strategy,
        outcome: "structural_repair",
        sanitizedIntent: resolvedIntent,
      };
    }

    case "NO_RETRY": {
      return {
        strategy,
        outcome: "stopped",
        conflictDetails:
          input.rawFailureReason ??
          "This request cannot be retried — the constraints or premise cannot be resolved.",
      };
    }
  }
}
