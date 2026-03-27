import type { DishFamilyRule } from "./dishFamilyRules";
import { stepSatisfiesMethod } from "./methodRegistry";

export type DiffIngredient = {
  ingredientName: string;
  normalizedName?: string | null;
  quantity?: number | null;
  unit?: string | null;
  grams?: number | null;
  classes?: string[];
};

export type DiffStep = {
  text: string;
  methodTag?: string | null;
  estimatedMinutes?: number | null;
  temperatureC?: number | null;
};

export type RepairDiffIssue = {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  metadata?: Record<string, unknown>;
};

export type RepairDiffEvaluationResult = {
  passed: boolean;
  score: number;
  issues: RepairDiffIssue[];
  summary: {
    originalIngredientCount: number;
    repairedIngredientCount: number;
    addedIngredients: string[];
    removedIngredients: string[];
    changedIngredientCount: number;
    originalStepCount: number;
    repairedStepCount: number;
    addedMethods: string[];
    removedMethods: string[];
    driftRatio: number;
  };
};

type EvaluateRepairDiffParams = {
  originalIngredients: DiffIngredient[];
  repairedIngredients: DiffIngredient[];
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

function ingredientKey(ingredient: DiffIngredient): string {
  return normalizeText(ingredient.normalizedName || ingredient.ingredientName || "");
}

function methodKey(step: DiffStep): string | null {
  if (!step.methodTag) return null;
  return normalizeText(step.methodTag);
}

function getIngredientMap(ingredients: DiffIngredient[]): Map<string, DiffIngredient> {
  const map = new Map<string, DiffIngredient>();
  for (const ingredient of ingredients) {
    const key = ingredientKey(ingredient);
    if (!key) continue;
    map.set(key, ingredient);
  }
  return map;
}

function getMethodSet(steps: DiffStep[]): Set<string> {
  const methods = new Set<string>();
  for (const step of steps) {
    const key = methodKey(step);
    if (key) methods.add(key);
  }
  return methods;
}

function numericRatioDelta(a?: number | null, b?: number | null): number | null {
  if (a == null || b == null) return null;
  if (a === 0 && b === 0) return 0;
  if (a === 0) return 1;
  return Math.abs(b - a) / Math.abs(a);
}

function groupStillSatisfied(ingredients: DiffIngredient[], classGroup: string[]): boolean {
  return ingredients.some((ingredient) =>
    ingredient.classes?.some((cls) => classGroup.includes(cls))
  );
}

function hasAnyClass(ingredients: DiffIngredient[], targetClasses: string[]): boolean {
  return ingredients.some((ingredient) =>
    ingredient.classes?.some((cls) => targetClasses.includes(cls))
  );
}

export function evaluateRepairDiff(
  params: EvaluateRepairDiffParams
): RepairDiffEvaluationResult {
  const { originalIngredients, repairedIngredients, originalSteps, repairedSteps, dishFamily } =
    params;

  const issues: RepairDiffIssue[] = [];

  const originalIngredientMap = getIngredientMap(originalIngredients);
  const repairedIngredientMap = getIngredientMap(repairedIngredients);

  const originalKeys = new Set(originalIngredientMap.keys());
  const repairedKeys = new Set(repairedIngredientMap.keys());

  const addedIngredients = [...repairedKeys].filter((k) => !originalKeys.has(k));
  const removedIngredients = [...originalKeys].filter((k) => !repairedKeys.has(k));

  let changedIngredientCount = 0;

  for (const key of [...originalKeys].filter((k) => repairedKeys.has(k))) {
    const original = originalIngredientMap.get(key);
    const repaired = repairedIngredientMap.get(key);
    if (!original || !repaired) continue;

    const qtyDelta = numericRatioDelta(original.quantity, repaired.quantity);
    const gramDelta = numericRatioDelta(original.grams, repaired.grams);

    const quantityChanged =
      (qtyDelta != null && qtyDelta > 0.25) ||
      (gramDelta != null && gramDelta > 0.25) ||
      normalizeText(original.unit || "") !== normalizeText(repaired.unit || "");

    if (quantityChanged) changedIngredientCount += 1;
  }

  const originalMethods = getMethodSet(originalSteps);
  const repairedMethods = getMethodSet(repairedSteps);

  const addedMethods = [...repairedMethods].filter((m) => !originalMethods.has(m));
  const removedMethods = [...originalMethods].filter((m) => !repairedMethods.has(m));

  const ingredientUniverseSize = Math.max(
    1,
    new Set([...originalKeys, ...repairedKeys]).size
  );

  const driftRatio =
    (addedIngredients.length + removedIngredients.length + changedIngredientCount) /
    ingredientUniverseSize;

  // 1. Forbidden classes introduced
  for (const key of addedIngredients) {
    const ingredient = repairedIngredientMap.get(key);
    if (!ingredient) continue;

    const forbiddenFound =
      ingredient.classes?.filter((cls) => dishFamily.forbiddenClasses.includes(cls)) ?? [];

    if (forbiddenFound.length > 0) {
      issues.push({
        code: "REPAIR_INTRODUCED_FORBIDDEN_CLASS",
        severity: "error",
        message: `Repair introduced forbidden ingredient "${ingredient.ingredientName}" with forbidden class(es): ${forbiddenFound.join(", ")}.`,
        metadata: { ingredient: ingredient.ingredientName, forbiddenClasses: forbiddenFound },
      });
    }
  }

  // 2. Required class groups broken
  for (const classGroup of dishFamily.requiredClassGroups) {
    if (!groupStillSatisfied(repairedIngredients, classGroup)) {
      issues.push({
        code: "REPAIR_BROKE_REQUIRED_CLASS_GROUP",
        severity: "error",
        message: `Repair removed or failed to preserve a required class group: [${classGroup.join(", ")}].`,
        metadata: { classGroup },
      });
    }
  }

  // 3. Removed common/core ingredients
  for (const key of removedIngredients) {
    const ingredient = originalIngredientMap.get(key);
    if (!ingredient) continue;

    const removedCommonClasses =
      ingredient.classes?.filter((cls) => dishFamily.commonClasses.includes(cls)) ?? [];

    if (removedCommonClasses.length > 0) {
      issues.push({
        code: "REPAIR_REMOVED_COMMON_INGREDIENT",
        severity: "warning",
        message: `Repair removed a common ingredient "${ingredient.ingredientName}" used by this dish family.`,
        metadata: { ingredient: ingredient.ingredientName, commonClasses: removedCommonClasses },
      });
    }
  }

  // 4. Suspicious new ingredients
  for (const key of addedIngredients) {
    const ingredient = repairedIngredientMap.get(key);
    if (!ingredient) continue;

    const suspiciousFound =
      ingredient.classes?.filter((cls) => dishFamily.suspiciousClasses.includes(cls)) ?? [];

    if (suspiciousFound.length > 0) {
      issues.push({
        code: "REPAIR_INTRODUCED_SUSPICIOUS_INGREDIENT",
        severity: "warning",
        message: `Repair introduced suspicious ingredient "${ingredient.ingredientName}" for this dish family.`,
        metadata: {
          ingredient: ingredient.ingredientName,
          suspiciousClasses: suspiciousFound,
        },
      });
    }
  }

  // 5. Excessive ingredient churn
  if (addedIngredients.length + removedIngredients.length >= 4) {
    issues.push({
      code: "REPAIR_EXCESSIVE_INGREDIENT_CHURN",
      severity: "warning",
      message: `Repair changed too many ingredients (${addedIngredients.length} added, ${removedIngredients.length} removed).`,
      metadata: { addedIngredients, removedIngredients },
    });
  }

  // 6. Global drift
  if (driftRatio > 0.6) {
    issues.push({
      code: "REPAIR_EXCESSIVE_DRIFT",
      severity: "error",
      message: `Repair drift is too high (${driftRatio.toFixed(2)}). This no longer looks like a minimal repair.`,
      metadata: { driftRatio },
    });
  } else if (driftRatio > 0.35) {
    issues.push({
      code: "REPAIR_HIGH_DRIFT",
      severity: "warning",
      message: `Repair drift is high (${driftRatio.toFixed(2)}). Review whether this is still the same recipe.`,
      metadata: { driftRatio },
    });
  }

  // 7. Required method drift
  if (dishFamily.requiredMethods?.length) {
    for (const method of dishFamily.requiredMethods) {
      if (!repairedSteps.some((step) => stepSatisfiesMethod(step, method))) {
        issues.push({
          code: "REPAIR_MISSING_REQUIRED_METHOD",
          severity: "error",
          message: `Repair removed or failed to preserve required method "${method}".`,
          metadata: { method },
        });
      }
    }
  }

  if (removedMethods.length >= 2) {
    issues.push({
      code: "REPAIR_REMOVED_TOO_MANY_METHODS",
      severity: "warning",
      message: `Repair removed multiple method tags (${removedMethods.join(", ")}).`,
      metadata: { removedMethods },
    });
  }

  // 8. Step count drift
  const originalStepCount = originalSteps.length;
  const repairedStepCount = repairedSteps.length;

  const stepCountDelta =
    originalStepCount === 0
      ? 0
      : Math.abs(repairedStepCount - originalStepCount) / originalStepCount;

  if (stepCountDelta > 0.75) {
    issues.push({
      code: "REPAIR_STEP_COUNT_DRIFT_HIGH",
      severity: "warning",
      message: `Repair changed step count too aggressively (${originalStepCount} -> ${repairedStepCount}).`,
      metadata: { originalStepCount, repairedStepCount },
    });
  }

  // 9. Removed all protein structure
  const originalHadProtein = hasAnyClass(originalIngredients, [
    "protein_meat", "protein_fish", "protein_plant", "egg",
  ]);
  const repairedHasProtein = hasAnyClass(repairedIngredients, [
    "protein_meat", "protein_fish", "protein_plant", "egg",
  ]);

  if (originalHadProtein && !repairedHasProtein) {
    issues.push({
      code: "REPAIR_REMOVED_ALL_PROTEIN_STRUCTURE",
      severity: "warning",
      message: "Repair removed all major protein structure from the recipe.",
    });
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  let score = 1;
  score -= errorCount * 0.25;
  score -= warningCount * 0.08;
  score = Math.max(0, Math.min(1, score));

  return {
    passed: errorCount === 0,
    score,
    issues,
    summary: {
      originalIngredientCount: originalIngredients.length,
      repairedIngredientCount: repairedIngredients.length,
      addedIngredients,
      removedIngredients,
      changedIngredientCount,
      originalStepCount,
      repairedStepCount,
      addedMethods,
      removedMethods,
      driftRatio: Number(driftRatio.toFixed(2)),
    },
  };
}
