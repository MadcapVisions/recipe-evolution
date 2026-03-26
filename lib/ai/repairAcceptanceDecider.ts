export type Severity = "info" | "warning" | "error";

export type GenericIssue = {
  code: string;
  severity: Severity;
  message: string;
  metadata?: Record<string, unknown>;
};

export type ValidationLikeResult = {
  passed: boolean;
  score: number;
  issues?: GenericIssue[];
};

export type MacroTargetValidationLikeResult = {
  passed: boolean;
  score: number;
  issues?: GenericIssue[];
  warnings?: string[];
  nutritionConfidenceScore?: number;
};

export type RepairDiffEvaluationLikeResult = {
  passed: boolean;
  score: number;
  issues?: GenericIssue[];
  summary?: {
    driftRatio?: number;
  };
};

export type RepairAcceptanceDecision =
  | "accept_repair"
  | "retry_repair"
  | "regenerate_from_ingredients"
  | "keep_original";

export type RepairAcceptanceResult = {
  decision: RepairAcceptanceDecision;
  accepted: boolean;
  confidence: number;
  reasons: string[];
  issues: GenericIssue[];
  metrics: {
    repairedValidationPassed: boolean;
    repairedValidationScore: number;
    macroValidationPassed: boolean;
    macroValidationScore: number;
    diffPassed: boolean;
    diffScore: number;
    driftRatio: number | null;
    errorCount: number;
    warningCount: number;
  };
};

type DecideRepairAcceptanceParams = {
  repairedValidation: ValidationLikeResult;
  macroTargetValidation?: MacroTargetValidationLikeResult | null;
  repairDiff: RepairDiffEvaluationLikeResult;
  originalValidationScore?: number | null;
  retryCount?: number;
  maxRepairRetries?: number;
};

function collectIssues(
  ...sources: Array<{ issues?: GenericIssue[] } | null | undefined>
): GenericIssue[] {
  return sources.flatMap((source) => source?.issues ?? []);
}

function countBySeverity(issues: GenericIssue[], severity: Severity): number {
  return issues.filter((issue) => issue.severity === severity).length;
}

function hasIssueCodePrefix(issues: GenericIssue[], prefix: string): boolean {
  return issues.some((issue) => issue.code.startsWith(prefix));
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

export function decideRepairAcceptance(
  params: DecideRepairAcceptanceParams
): RepairAcceptanceResult {
  const {
    repairedValidation,
    macroTargetValidation = null,
    repairDiff,
    originalValidationScore = null,
    retryCount = 0,
    maxRepairRetries = 2,
  } = params;

  const reasons: string[] = [];
  const issues = collectIssues(repairedValidation, macroTargetValidation, repairDiff);

  const errorCount = countBySeverity(issues, "error");
  const warningCount = countBySeverity(issues, "warning");

  const driftRatio =
    typeof repairDiff.summary?.driftRatio === "number"
      ? repairDiff.summary.driftRatio
      : null;

  const macroPassed = macroTargetValidation ? macroTargetValidation.passed : true;
  const macroScore = macroTargetValidation ? macroTargetValidation.score : 1;

  const repairedValidationPassed = repairedValidation.passed;
  const diffPassed = repairDiff.passed;

  const buildMetrics = () => ({
    repairedValidationPassed,
    repairedValidationScore: round(repairedValidation.score),
    macroValidationPassed: macroPassed,
    macroValidationScore: round(macroScore),
    diffPassed,
    diffScore: round(repairDiff.score),
    driftRatio,
    errorCount,
    warningCount,
  });

  // Hard rejection checks
  if (!repairedValidationPassed) {
    reasons.push("Repaired recipe failed core structural or culinary validation.");
  }
  if (!diffPassed) {
    reasons.push("Repair drift evaluation failed.");
  }
  if (hasIssueCodePrefix(issues, "REPAIR_INTRODUCED_FORBIDDEN_CLASS")) {
    reasons.push("Repair introduced forbidden ingredient classes.");
  }
  if (hasIssueCodePrefix(issues, "REPAIR_BROKE_REQUIRED_CLASS_GROUP")) {
    reasons.push("Repair broke required ingredient class groups.");
  }
  if (hasIssueCodePrefix(issues, "REPAIR_MISSING_REQUIRED_METHOD")) {
    reasons.push("Repair removed or failed to preserve required methods.");
  }

  const structuralBreak =
    !repairedValidationPassed ||
    !diffPassed ||
    hasIssueCodePrefix(issues, "REPAIR_INTRODUCED_FORBIDDEN_CLASS") ||
    hasIssueCodePrefix(issues, "REPAIR_BROKE_REQUIRED_CLASS_GROUP") ||
    hasIssueCodePrefix(issues, "REPAIR_MISSING_REQUIRED_METHOD");

  if (structuralBreak) {
    const decision: RepairAcceptanceDecision =
      retryCount < maxRepairRetries ? "retry_repair" : "regenerate_from_ingredients";

    reasons.push(
      decision === "retry_repair"
        ? "Attempt a tighter repair pass before regenerating."
        : "Repair is too broken. Regenerate from the ingredient stage."
    );

    return { decision, accepted: false, confidence: 0.2, reasons, issues, metrics: buildMetrics() };
  }

  // Drift too high
  if (driftRatio != null && driftRatio > 0.6) {
    reasons.push(`Repair drift is too high (${driftRatio}).`);
    const decision: RepairAcceptanceDecision =
      retryCount < maxRepairRetries ? "retry_repair" : "regenerate_from_ingredients";
    return { decision, accepted: false, confidence: 0.3, reasons, issues, metrics: buildMetrics() };
  }

  // Structurally valid but macro targets still failing
  if (!macroPassed) {
    reasons.push("Repair is structurally valid but still misses macro targets.");

    const strongRecipeOtherwise =
      repairedValidation.score >= 0.85 && repairDiff.score >= 0.8 && errorCount === 0;

    if (strongRecipeOtherwise && retryCount >= maxRepairRetries) {
      reasons.push(
        "Macro miss remains after retries. Keep original repair if it is otherwise strong."
      );
      return {
        decision: "keep_original",
        accepted: false,
        confidence: 0.45,
        reasons,
        issues,
        metrics: buildMetrics(),
      };
    }

    const decision: RepairAcceptanceDecision =
      retryCount < maxRepairRetries ? "retry_repair" : "regenerate_from_ingredients";
    return { decision, accepted: false, confidence: 0.4, reasons, issues, metrics: buildMetrics() };
  }

  // Repair worse than original
  if (
    originalValidationScore != null &&
    repairedValidation.score < originalValidationScore &&
    repairDiff.score < 0.8
  ) {
    reasons.push("Repair did not outperform the original enough to justify replacing it.");
    return {
      decision: "keep_original",
      accepted: false,
      confidence: 0.55,
      reasons,
      issues,
      metrics: buildMetrics(),
    };
  }

  // Warning-heavy but acceptable
  if (errorCount === 0 && warningCount > 4) {
    reasons.push("Repair passed, but warning volume is high.");
    reasons.push("Accept with caution.");
    return {
      decision: "accept_repair",
      accepted: true,
      confidence: 0.65,
      reasons,
      issues,
      metrics: buildMetrics(),
    };
  }

  // Clean acceptance
  reasons.push("Repair passed structural, macro, and drift checks.");
  return {
    decision: "accept_repair",
    accepted: true,
    confidence: round(
      Math.min(
        0.98,
        repairedValidation.score * 0.45 + macroScore * 0.25 + repairDiff.score * 0.3
      )
    ),
    reasons,
    issues,
    metrics: buildMetrics(),
  };
}
