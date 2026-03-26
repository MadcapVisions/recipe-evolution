import type { NutritionCalculationResult } from "./nutritionTypes";

export type MacroTargets = {
  caloriesMax?: number | null;
  caloriesMin?: number | null;
  proteinMinG?: number | null;
  proteinMaxG?: number | null;
  carbsMinG?: number | null;
  carbsMaxG?: number | null;
  fatMinG?: number | null;
  fatMaxG?: number | null;
  fiberMinG?: number | null;
  fiberMaxG?: number | null;
  sugarMaxG?: number | null;
  sodiumMaxMg?: number | null;
};

export type MacroTargetIssue = {
  code: string;
  severity: "warning" | "error";
  metric: string;
  actual?: number | null;
  expected?: {
    min?: number;
    max?: number;
  };
  message: string;
};

export type MacroTargetValidationResult = {
  passed: boolean;
  score: number;
  issues: MacroTargetIssue[];
  warnings: string[];
  usedPerServing: boolean;
  nutritionConfidenceScore: number;
};

function isPresent(value: number | null | undefined): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

function addMinCheck(params: {
  issues: MacroTargetIssue[];
  metric: string;
  actual?: number | null;
  min?: number | null;
  label: string;
}) {
  const { issues, metric, actual, min, label } = params;
  if (!isPresent(min) || !isPresent(actual)) return;

  if (actual < min) {
    issues.push({
      code: "MACRO_BELOW_MIN",
      severity: "error",
      metric,
      actual,
      expected: { min },
      message: `${label} is below target: ${actual} < ${min}`,
    });
  }
}

function addMaxCheck(params: {
  issues: MacroTargetIssue[];
  metric: string;
  actual?: number | null;
  max?: number | null;
  label: string;
}) {
  const { issues, metric, actual, max, label } = params;
  if (!isPresent(max) || !isPresent(actual)) return;

  if (actual > max) {
    issues.push({
      code: "MACRO_ABOVE_MAX",
      severity: "error",
      metric,
      actual,
      expected: { max },
      message: `${label} is above target: ${actual} > ${max}`,
    });
  }
}

/**
 * Relax hard target enforcement when nutrition confidence is weak.
 *
 * Two softening modes:
 *
 * 1. Zero-resolution (confidence ≤ 0.05): all matched ingredients had null
 *    grams, so every macro total is literally 0 — not a real measurement.
 *    Downgrade ALL macro errors to warnings, because the data is meaningless.
 *    Family-level infeasibility (e.g. cheesecake + 120 cal cap) must be caught
 *    earlier via familyMacroFeasibility, not here.
 *
 * 2. Low confidence (< 0.85): downgrade only borderline violations
 *    (actual within 30% of target bound). Wild violations remain hard errors.
 */
function softenIssuesForLowConfidence(
  issues: MacroTargetIssue[],
  confidenceScore: number
): MacroTargetIssue[] {
  if (confidenceScore >= 0.85) return issues;

  // Zero-resolution case: grams unresolvable, totals are all 0 → meaningless
  if (confidenceScore <= 0.05) {
    return issues.map((issue) => {
      if (issue.code !== "MACRO_BELOW_MIN" && issue.code !== "MACRO_ABOVE_MAX") return issue;
      return {
        ...issue,
        severity: "warning" as const,
        code: "LOW_CONFIDENCE_" + issue.code,
        message: `[Zero nutrition confidence] ${issue.message}`,
      };
    });
  }

  return issues.map((issue) => {
    if (issue.code !== "MACRO_BELOW_MIN" && issue.code !== "MACRO_ABOVE_MAX") {
      return issue;
    }

    const actual = issue.actual ?? 0;
    const bound =
      issue.code === "MACRO_BELOW_MIN"
        ? issue.expected?.min ?? 0
        : issue.expected?.max ?? 0;

    // Only soften when actual is within 30% of the target bound.
    const isBorderline =
      bound > 0 && Math.abs(actual - bound) / bound <= 0.3;

    if (!isBorderline) return issue;

    return {
      ...issue,
      severity: "warning" as const,
      code: "LOW_CONFIDENCE_" + issue.code,
      message: `[Low nutrition confidence] ${issue.message}`,
    };
  });
}

export function validateMacroTargets(params: {
  nutrition: NutritionCalculationResult;
  targets?: MacroTargets | null;
  preferPerServing?: boolean;
}): MacroTargetValidationResult {
  const { nutrition, targets, preferPerServing = true } = params;

  if (!targets) {
    return {
      passed: true,
      score: 1,
      issues: [],
      warnings: [],
      usedPerServing: false,
      nutritionConfidenceScore: nutrition.confidenceScore,
    };
  }

  const warnings: string[] = [];
  const issues: MacroTargetIssue[] = [];

  const usePerServing =
    preferPerServing &&
    !!nutrition.perServing &&
    !!nutrition.servingCount &&
    nutrition.servingCount > 0;

  const base = usePerServing ? nutrition.perServing! : nutrition.totals;

  if (!usePerServing) {
    warnings.push(
      "Per-serving nutrition unavailable. Macro targets validated against full recipe totals."
    );
  }

  if (nutrition.confidenceScore < 0.85) {
    warnings.push(
      `Nutrition confidence is low (${nutrition.confidenceScore}). Macro validation is less reliable.`
    );
  }

  addMaxCheck({ issues, metric: "calories", actual: base.calories, max: targets.caloriesMax, label: usePerServing ? "Calories per serving" : "Recipe calories" });
  addMinCheck({ issues, metric: "calories", actual: base.calories, min: targets.caloriesMin, label: usePerServing ? "Calories per serving" : "Recipe calories" });

  addMinCheck({ issues, metric: "protein_g", actual: base.protein_g, min: targets.proteinMinG, label: usePerServing ? "Protein per serving" : "Recipe protein" });
  addMaxCheck({ issues, metric: "protein_g", actual: base.protein_g, max: targets.proteinMaxG, label: usePerServing ? "Protein per serving" : "Recipe protein" });

  addMinCheck({ issues, metric: "carbs_g", actual: base.carbs_g, min: targets.carbsMinG, label: usePerServing ? "Carbs per serving" : "Recipe carbs" });
  addMaxCheck({ issues, metric: "carbs_g", actual: base.carbs_g, max: targets.carbsMaxG, label: usePerServing ? "Carbs per serving" : "Recipe carbs" });

  addMinCheck({ issues, metric: "fat_g", actual: base.fat_g, min: targets.fatMinG, label: usePerServing ? "Fat per serving" : "Recipe fat" });
  addMaxCheck({ issues, metric: "fat_g", actual: base.fat_g, max: targets.fatMaxG, label: usePerServing ? "Fat per serving" : "Recipe fat" });

  addMinCheck({ issues, metric: "fiber_g", actual: base.fiber_g, min: targets.fiberMinG, label: usePerServing ? "Fiber per serving" : "Recipe fiber" });
  addMaxCheck({ issues, metric: "fiber_g", actual: base.fiber_g, max: targets.fiberMaxG, label: usePerServing ? "Fiber per serving" : "Recipe fiber" });

  addMaxCheck({ issues, metric: "sugar_g", actual: base.sugar_g, max: targets.sugarMaxG, label: usePerServing ? "Sugar per serving" : "Recipe sugar" });
  addMaxCheck({ issues, metric: "sodium_mg", actual: base.sodium_mg, max: targets.sodiumMaxMg, label: usePerServing ? "Sodium per serving" : "Recipe sodium" });

  // When ingredients matched the DB but grams were unresolvable (e.g. planner
  // ingredients have no quantity info), all macro totals are 0 despite a
  // non-zero name-match confidence. Treat this as effectively 0 confidence so
  // macro issues are downgraded to warnings. Structurally impossible cases
  // (e.g. cheesecake + caloriesMax 120) must be caught by familyMacroFeasibility
  // before this point — not by keeping macro issues hard here.
  const resolvedWithGrams = nutrition.ingredientMatches.filter(
    (m) => m.matched && m.gramsUsed != null
  ).length;
  const effectiveConfidence =
    resolvedWithGrams === 0 && nutrition.mappedIngredientCount > 0
      ? 0
      : nutrition.confidenceScore;

  const adjustedIssues = softenIssuesForLowConfidence(issues, effectiveConfidence);

  const errorCount = adjustedIssues.filter((i) => i.severity === "error").length;
  const warningCount = adjustedIssues.filter((i) => i.severity === "warning").length;

  let score = 1;
  score -= errorCount * 0.2;
  score -= warningCount * 0.05;
  score = Math.max(0, Math.min(1, score));

  return {
    passed: errorCount === 0,
    score,
    issues: adjustedIssues,
    warnings,
    usedPerServing: usePerServing,
    nutritionConfidenceScore: nutrition.confidenceScore,
  };
}
