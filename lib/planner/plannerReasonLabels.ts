import type { PlannerReasonCode } from "@/lib/planner/plannerEngine";
import type { PlanningEligibilityReason } from "@/lib/planner/versionPlanningEligibility";

const POSITIVE_REASON_LABELS: Partial<Record<PlannerReasonCode, string>> = {
  strong_repeat_candidate: "Strong repeat candidate",
  good_weeknight_fit: "Quick weeknight fit",
  good_easy_week_fit: "Easy weeknight pick",
  matches_learned_patterns: "Fits your usual style",
  reuses_ingredients: "Reuses ingredients this week",
  shares_prep: "Shares prep with another meal",
  balances_heavier_meal: "Balances a heavier meal",
  sparse_data_safe_choice: "Safe fallback choice",
  favorite_recipe: "Starts from favorites",
};

const ELIGIBILITY_LABELS: Partial<Record<PlanningEligibilityReason, string>> = {
  explicit_non_draft: "Trusted saved version",
  unknown_but_trusted: "Confident enough to try",
};

export function getPlannerReasonLabels(input: {
  reasonCodes: PlannerReasonCode[];
  planningEligibilityReason?: PlanningEligibilityReason | null;
  max?: number;
}): string[] {
  const labels: string[] = [];

  if (input.planningEligibilityReason) {
    const eligibilityLabel = ELIGIBILITY_LABELS[input.planningEligibilityReason];
    if (eligibilityLabel) {
      labels.push(eligibilityLabel);
    }
  }

  for (const reasonCode of input.reasonCodes) {
    const label = POSITIVE_REASON_LABELS[reasonCode];
    if (!label || labels.includes(label)) {
      continue;
    }
    labels.push(label);
    if (labels.length >= (input.max ?? 2)) {
      break;
    }
  }

  return labels.slice(0, input.max ?? 2);
}
