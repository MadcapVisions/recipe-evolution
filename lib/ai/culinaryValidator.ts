/**
 * Culinary validation layer.
 *
 * Checks a recipe's ingredients and steps against the dish family rules
 * defined in dishFamilyRules.ts, using the pattern-based ingredient
 * classifier (ingredientClassifier.ts).
 *
 * Returns typed violations — each with a repairHint so the repair
 * planner can generate targeted fix instructions.
 */

import { findDishFamilyRule } from "./dishFamilyRules";
import {
  hasIngredientClass,
  hasAnyClassInGroup,
  getIngredientsByClass,
  classifyIngredient,
} from "./ingredientClassifier";
import { validateRatios } from "./ratioValidator";
import { resolveIngredientListForRatio } from "./resolveIngredientGrams";
import { stepSatisfiesMethod } from "./methodRegistry";

export type ViolationSeverity = "error" | "warning" | "info";

export type CulinaryViolation = {
  code: string;
  severity: ViolationSeverity;
  message: string;
  /** Plain-English instruction to feed into the repair prompt. */
  repairHint: string;
};

export type CulinaryValidationResult = {
  /** null when no known dish family was detected */
  family: string | null;
  valid: boolean;
  violations: CulinaryViolation[];
};

type EnrichedStep = {
  text: string;
  methodTag?: string | null;
};

/**
 * Returns true if any step matches the given method tag or contains the
 * method string as a substring.
 */
function hasMethod(steps: EnrichedStep[], method: string): boolean {
  return steps.some((step) => stepSatisfiesMethod(step, method));
}

/**
 * Validate a recipe's ingredient list and step text against culinary rules
 * for the given dish family hint.
 *
 * @param dishFamilyHint - from RecipePlan.dish_family or CookingBrief
 * @param ingredients    - array of { name: string } objects
 * @param steps          - enriched step objects with text and optional methodTag
 */
export function validateCulinaryFit(
  dishFamilyHint: string | null | undefined,
  ingredients: Array<{ name: string }>,
  steps: EnrichedStep[]
): CulinaryValidationResult {
  if (!dishFamilyHint) {
    return { family: null, valid: true, violations: [] };
  }

  const rule = findDishFamilyRule(dishFamilyHint);
  if (!rule) {
    return { family: dishFamilyHint, valid: true, violations: [] };
  }

  const violations: CulinaryViolation[] = [];

  // ── Required class groups (hard fail) ────────────────────────────────────
  for (const group of rule.requiredClassGroups) {
    if (!hasAnyClassInGroup(ingredients, group)) {
      const groupLabel = group.join(" or ");
      violations.push({
        code: `missing_required_class:${group[0]}`,
        severity: "error",
        message: `${rule.displayName} requires ${groupLabel} but none found.`,
        repairHint: `Add at least one ingredient from the ${groupLabel} category — this is essential for a ${rule.displayName}.`,
      });
    }
  }

  // ── Forbidden classes (hard fail) ─────────────────────────────────────────
  for (const cls of rule.forbiddenClasses) {
    if (hasIngredientClass(ingredients, cls)) {
      const offenders = getIngredientsByClass(ingredients, cls);
      violations.push({
        code: `forbidden_class:${cls}`,
        severity: "error",
        message: `${rule.displayName} should not contain ${cls} ingredients: ${offenders.join(", ")}.`,
        repairHint: `Remove ${offenders.join(", ")} — ${cls} ingredients do not belong in a ${rule.displayName}.`,
      });
    }
  }

  // ── Suspicious classes (warning or error depending on strictness) ─────────
  for (const cls of rule.suspiciousClasses) {
    if (hasIngredientClass(ingredients, cls)) {
      const offenders = getIngredientsByClass(ingredients, cls);
      const severity = rule.strictness === "high" ? "warning" : "info";
      violations.push({
        code: `suspicious_class:${cls}`,
        severity,
        message: `${cls} ingredients (${offenders.join(", ")}) are unusual in a ${rule.displayName}.`,
        repairHint: `Double-check whether ${offenders.join(", ")} belongs in this ${rule.displayName}; remove it if not intentional.`,
      });
    }
  }

  // ── Common classes (missing = confidence penalty, not a fail) ────────────
  for (const cls of rule.commonClasses) {
    if (!hasIngredientClass(ingredients, cls)) {
      violations.push({
        code: `missing_common_class:${cls}`,
        severity: "info",
        message: `${rule.displayName} typically includes ${cls} but none found.`,
        repairHint: `Consider adding a ${cls} ingredient — it is commonly expected in a ${rule.displayName}.`,
      });
    }
  }

  // ── maxUncommonIngredients ─────────────────────────────────────────────────
  const allKnownClasses = new Set([
    ...rule.requiredClassGroups.flat(),
    ...rule.commonClasses,
    ...rule.optionalClasses,
    ...rule.forbiddenClasses,
    ...rule.suspiciousClasses,
  ]);

  const uncommonIngredients = ingredients.filter((ing) => {
    const classes = classifyIngredient(ing.name);
    return classes.length === 0 || !classes.some((c) => allKnownClasses.has(c));
  });

  if (uncommonIngredients.length > rule.maxUncommonIngredients) {
    const names = uncommonIngredients.map((i) => i.name).slice(0, 5).join(", ");
    violations.push({
      code: "too_many_uncommon_ingredients",
      severity: rule.strictness === "high" ? "warning" : "info",
      message: `${rule.displayName} has ${uncommonIngredients.length} unexpected ingredients (limit ${rule.maxUncommonIngredients}): ${names}.`,
      repairHint: `Review these ingredients — they are unusual for a ${rule.displayName}: ${names}.`,
    });
  }

  // ── Required methods (warning — not hard fail until methodTag is stable) ──
  for (const method of rule.requiredMethods) {
    if (!hasMethod(steps, method)) {
      violations.push({
        code: `missing_required_method:${method}`,
        severity: "warning",
        message: `${rule.displayName} steps do not include the "${method}" technique.`,
        repairHint: `Rewrite the steps to include a "${method}" step — this technique is expected in a ${rule.displayName}.`,
      });
    }
  }

  // ── Expected method keywords (soft signal only) ───────────────────────────
  if (rule.expectedMethodKeywords.length > 0) {
    const hasAnyExpected = rule.expectedMethodKeywords.some((kw) =>
      steps.some((step) => step.text.toLowerCase().includes(kw.toLowerCase()))
    );
    if (!hasAnyExpected) {
      const kwList = rule.expectedMethodKeywords.slice(0, 4).join(", ");
      violations.push({
        code: "missing_expected_keywords",
        severity: "info",
        message: `${rule.displayName} steps don't mention expected keywords (${kwList}…).`,
        repairHint: `Consider using language like: ${rule.expectedMethodKeywords.join(", ")}.`,
      });
    }
  }

  // ── Ratio validation ──────────────────────────────────────────────────────
  if (rule.ratioRules) {
    const resolved = resolveIngredientListForRatio(ingredients);
    const ratioResult = validateRatios({ dishFamily: rule, ingredients: resolved });
    for (const issue of ratioResult.issues) {
      if (issue.code === "RATIO_NOT_COMPUTABLE") {
        // Skip — missing quantities are expected; don't penalise
        continue;
      }
      violations.push({
        code: `ratio:${issue.ratioKey}`,
        severity: issue.severity,
        message: issue.message,
        repairHint: `Fix the ${issue.ratioKey.replace(/_/g, "/")} ratio — actual: ${
          issue.actual != null ? issue.actual.toFixed(2) : "unknown"
        }, expected ${issue.expectedMin}–${issue.expectedMax}.`,
      });
    }
  }

  const hasErrors = violations.some((v) => v.severity === "error");

  return {
    family: rule.key,
    valid: !hasErrors,
    violations,
  };
}
