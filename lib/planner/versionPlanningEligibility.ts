export type ExplicitDraftState = "draft" | "non_draft" | "unknown";
export type PlanningEligibilityState = "eligible" | "cautionary" | "excluded";

export type PlanningEligibilityReason =
  | "explicit_draft"
  | "explicit_non_draft"
  | "unknown_but_trusted"
  | "unknown_low_trust"
  | "superseded_by_stronger_version"
  | "negative_outcome_caution"
  | "insufficient_evidence";

export type PlanningEligibilityResult = {
  state: PlanningEligibilityState;
  reason: PlanningEligibilityReason;
};

export function getVersionPlanningEligibility(input: {
  explicitDraftState: ExplicitDraftState;
  isBestVersion: boolean;
  trustScore?: number | null;
  hasStrongNegativeOutcome?: boolean;
  hasStrongerOlderViableVersion?: boolean;
  isFreshUnstableBranch?: boolean;
}): PlanningEligibilityResult {
  const trustScore = typeof input.trustScore === "number" ? input.trustScore : null;
  const strongTrust = trustScore != null && trustScore >= 0.6;
  const weakTrust = trustScore == null || trustScore < 0.35;

  if (input.explicitDraftState === "draft") {
    return { state: "excluded", reason: "explicit_draft" };
  }

  if (input.explicitDraftState === "non_draft") {
    return { state: "eligible", reason: "explicit_non_draft" };
  }

  if (input.hasStrongNegativeOutcome) {
    return { state: "excluded", reason: "negative_outcome_caution" };
  }

  if (input.hasStrongerOlderViableVersion) {
    return { state: "excluded", reason: "superseded_by_stronger_version" };
  }

  if (input.isFreshUnstableBranch && !strongTrust) {
    return { state: "excluded", reason: "insufficient_evidence" };
  }

  if (strongTrust && (input.isBestVersion || !input.isFreshUnstableBranch)) {
    return { state: "cautionary", reason: "unknown_but_trusted" };
  }

  if (weakTrust) {
    return { state: "excluded", reason: "unknown_low_trust" };
  }

  return { state: "excluded", reason: "insufficient_evidence" };
}
