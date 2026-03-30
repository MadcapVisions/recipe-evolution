// lib/ai/intent/constraintScoping.ts
import type {
  ResolvedConstraint,
  ConstraintScope,
  PivotType,
} from "./intentTypes";
import type { CanonicalRecipeSessionState } from "../contracts/sessionState";

// Types that are inherently tied to a particular dish technique/equipment
const DISH_SPECIFIC_TYPES = new Set(["technique", "equipment", "required_technique", "equipment_limit"]);

export type ScopeConstraintsInput = {
  constraints: Omit<ResolvedConstraint, "scope">[];
  userMessage: string;
  sessionState?: CanonicalRecipeSessionState | null;
};

export type PivotInvalidationResult = {
  pivotType: PivotType;
  keptConstraints: ResolvedConstraint[];
  invalidatedConstraints: ResolvedConstraint[];
};

function assignScope(c: Omit<ResolvedConstraint, "scope">): ConstraintScope {
  // retry_local is set explicitly by the caller — preserve it
  if ((c as ResolvedConstraint).scope === "retry_local") return "retry_local";

  // Dietary restrictions and user-owned equipment are always user_persistent
  if (c.type === "dietary") return "user_persistent";
  if (c.source === "user_settings") return "user_persistent";

  // Equipment/technique from non-settings source — user_settings already handled above
  if (DISH_SPECIFIC_TYPES.has(c.type)) {
    return c.source === "session_lock" ? "session_active" : "dish_specific";
  }

  // Session-locked constraints are session_active
  if (c.source === "session_lock") return "session_active";

  return "session_active";
}

/**
 * Assigns a ConstraintScope to each constraint.
 * Uses sessionContradictions for conflict detection if sessionState is provided
 * (contradiction detection is a separate concern — this function scopes, not validates).
 */
export function scopeConstraints(input: ScopeConstraintsInput): ResolvedConstraint[] {
  return input.constraints.map((c): ResolvedConstraint => ({
    ...c,
    scope: assignScope(c),
  }));
}

function detectPivotType(
  previousFamily: string | null,
  newFamily: string | null
): PivotType {
  if (!previousFamily || !newFamily) return "no_pivot";
  if (previousFamily === newFamily) return "no_pivot";

  // Same root word (e.g. soup → noodle_soup) is a style pivot
  const prevRoot = previousFamily.split("_")[0];
  const newRoot = newFamily.split("_")[0];
  if (prevRoot === newRoot) return "style_pivot";

  return "dish_pivot";
}

/**
 * Detects pivot type and returns constraints split into kept vs invalidated.
 *
 * Rules:
 * - dish_pivot → invalidate all dish_specific constraints; keep user_persistent and session_active
 * - style_pivot / no_pivot → keep all (retry_local still dropped)
 * - retry_local → always invalidated regardless of pivot type
 */
export function detectPivotAndInvalidate(input: {
  constraints: ResolvedConstraint[];
  previousFamily: string | null;
  newFamily: string | null;
  userMessage: string;
  sessionState?: CanonicalRecipeSessionState | null;
}): PivotInvalidationResult {
  const pivotType = detectPivotType(input.previousFamily, input.newFamily);

  const keptConstraints: ResolvedConstraint[] = [];
  const invalidatedConstraints: ResolvedConstraint[] = [];

  for (const constraint of input.constraints) {
    // retry_local never survives any call
    if (constraint.scope === "retry_local") {
      invalidatedConstraints.push(constraint);
      continue;
    }

    // user_persistent always survives
    if (constraint.scope === "user_persistent") {
      keptConstraints.push(constraint);
      continue;
    }

    // On dish pivot: drop dish_specific constraints
    if (pivotType === "dish_pivot" && constraint.scope === "dish_specific") {
      invalidatedConstraints.push(constraint);
      continue;
    }

    keptConstraints.push(constraint);
  }

  return { pivotType, keptConstraints, invalidatedConstraints };
}
