export type RunIssueCollector = {
  codes: string[];
  plannerRetries: number;
  repairAttempts: number;
  usedFallback: boolean;
  requiredNamedIngredientNames: string[];
  reasons: string[];
};

export function createRunIssueCollector(): RunIssueCollector {
  return {
    codes: [],
    plannerRetries: 0,
    repairAttempts: 0,
    usedFallback: false,
    requiredNamedIngredientNames: [],
    reasons: [],
  };
}

export function collectIssueCodes(collector: RunIssueCollector, codes: string[]): void {
  for (const code of codes) {
    if (!collector.codes.includes(code)) {
      collector.codes.push(code);
    }
  }
}

export function collectReasons(collector: RunIssueCollector, reasons: string[]): void {
  for (const reason of reasons) {
    if (reason && !collector.reasons.includes(reason)) {
      collector.reasons.push(reason);
    }
  }
}
