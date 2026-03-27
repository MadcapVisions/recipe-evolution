import type { DishFamilyRule } from "./dishFamilyRules";
import { stepSatisfiesMethod } from "./methodRegistry";

export type DiffStep = {
  text: string;
  methodTag?: string | null;
  estimatedMinutes?: number | null;
  temperatureC?: number | null;
};

export type StepDiffIssue = {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  metadata?: Record<string, unknown>;
};

export type StepDiffEvaluationResult = {
  passed: boolean;
  score: number;
  issues: StepDiffIssue[];
  summary: {
    originalStepCount: number;
    repairedStepCount: number;
    addedSteps: number;
    removedSteps: number;
    changedSteps: number;
    methodChanges: number;
    driftRatio: number;
  };
};

type EvaluateStepDiffParams = {
  originalSteps: DiffStep[];
  repairedSteps: DiffStep[];
  dishFamily: DishFamilyRule;
};

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textSimilarity(a: string, b: string): number {
  const aTokens = new Set(normalizeText(a).split(" "));
  const bTokens = new Set(normalizeText(b).split(" "));

  let overlap = 0;
  for (const t of aTokens) {
    if (bTokens.has(t)) overlap++;
  }

  const union = new Set([...aTokens, ...bTokens]).size;
  return union > 0 ? overlap / union : 0;
}

function matchSteps(
  original: DiffStep[],
  repaired: DiffStep[]
): Array<{ original?: DiffStep; repaired?: DiffStep; similarity: number }> {
  const matches: Array<{ original?: DiffStep; repaired?: DiffStep; similarity: number }> = [];
  const used = new Set<number>();

  for (const o of original) {
    let bestIndex = -1;
    let bestScore = 0;

    for (let i = 0; i < repaired.length; i++) {
      if (used.has(i)) continue;
      const score = textSimilarity(o.text, repaired[i].text);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0 && bestScore > 0.3) {
      used.add(bestIndex);
      matches.push({ original: o, repaired: repaired[bestIndex], similarity: bestScore });
    } else {
      matches.push({ original: o, similarity: 0 });
    }
  }

  for (let i = 0; i < repaired.length; i++) {
    if (!used.has(i)) {
      matches.push({ repaired: repaired[i], similarity: 0 });
    }
  }

  return matches;
}

export function evaluateStepDiff(params: EvaluateStepDiffParams): StepDiffEvaluationResult {
  const { originalSteps, repairedSteps, dishFamily } = params;

  const issues: StepDiffIssue[] = [];
  const matches = matchSteps(originalSteps, repairedSteps);

  let addedSteps = 0;
  let removedSteps = 0;
  let changedSteps = 0;
  let methodChanges = 0;

  for (const match of matches) {
    if (match.original && !match.repaired) {
      removedSteps++;
    } else if (!match.original && match.repaired) {
      addedSteps++;
    } else if (match.original && match.repaired) {
      if (match.similarity < 0.5) changedSteps++;

      const oMethod = normalizeText(match.original.methodTag ?? "");
      const rMethod = normalizeText(match.repaired.methodTag ?? "");
      if (oMethod !== rMethod) methodChanges++;
    }
  }

  const total = originalSteps.length + repairedSteps.length + changedSteps;
  const driftRatio =
    total === 0 ? 0 : (addedSteps + removedSteps + changedSteps) / total;

  // 1. Excessive drift
  if (driftRatio > 0.6) {
    issues.push({
      code: "STEP_DIFF_EXCESSIVE_DRIFT",
      severity: "error",
      message: `Step repair drift too high (${driftRatio.toFixed(2)}).`,
      metadata: { driftRatio },
    });
  } else if (driftRatio > 0.35) {
    issues.push({
      code: "STEP_DIFF_HIGH_DRIFT",
      severity: "warning",
      message: `Step repair drift is high (${driftRatio.toFixed(2)}).`,
      metadata: { driftRatio },
    });
  }

  // 2. Too many removed steps
  if (removedSteps >= 2) {
    issues.push({
      code: "STEP_DIFF_REMOVED_STEPS",
      severity: "warning",
      message: `Multiple steps were removed (${removedSteps}).`,
      metadata: { removedSteps },
    });
  }

  // 3. Too many added steps
  if (addedSteps >= 3) {
    issues.push({
      code: "STEP_DIFF_ADDED_STEPS",
      severity: "warning",
      message: `Too many new steps added (${addedSteps}).`,
      metadata: { addedSteps },
    });
  }

  // 4. Method drift
  if (methodChanges >= 3) {
    issues.push({
      code: "STEP_DIFF_METHOD_DRIFT",
      severity: "warning",
      message: `Multiple method changes detected (${methodChanges}).`,
      metadata: { methodChanges },
    });
  }

  // 5. Required method lost
  if (dishFamily.requiredMethods?.length) {
    for (const method of dishFamily.requiredMethods) {
      const found = repairedSteps.some((step) => stepSatisfiesMethod(step, method));
      if (!found) {
        issues.push({
          code: "STEP_DIFF_MISSING_REQUIRED_METHOD",
          severity: "error",
          message: `Required method "${method}" missing after repair.`,
          metadata: { method },
        });
      }
    }
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  let score = 1;
  score -= errorCount * 0.3;
  score -= warningCount * 0.08;
  score = Math.max(0, Math.min(1, score));

  return {
    passed: errorCount === 0,
    score,
    issues,
    summary: {
      originalStepCount: originalSteps.length,
      repairedStepCount: repairedSteps.length,
      addedSteps,
      removedSteps,
      changedSteps,
      methodChanges,
      driftRatio: Number(driftRatio.toFixed(2)),
    },
  };
}
