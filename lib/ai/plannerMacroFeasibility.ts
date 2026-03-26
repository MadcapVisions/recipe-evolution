/**
 * Planner-stage macro feasibility checker.
 *
 * When ingredient quantities are missing or unresolvable, the exact nutrition
 * calculator returns zero totals — making exact macro validation unreliable.
 * This module evaluates macro feasibility by ingredient class instead:
 *
 *   - Does the plan have protein-dense classes for a protein target? → feasible
 *   - Does it contain calorie-bomb classes under a very tight calorie cap? → weak
 *   - Does it contain high-carb classes for a low-carb request? → conflict
 *
 * Issues are emitted as WARNINGS (not errors) except when a structural source
 * is completely absent — e.g. no protein class at all for a protein target.
 * Hard macro rejection belongs at the final recipe validation stage where
 * exact grams are available.
 */

import type { PlannerIngredient } from "./ingredientPlanner";
import type { MacroTargets } from "./macroTargetValidator";

// ── Class sets ────────────────────────────────────────────────────────────────

/** Classes that supply meaningful protein. */
const PROTEIN_DENSE_CLASSES = new Set([
  "protein_meat",
  "protein_fish",
  "protein_plant",
  "egg",
  "dairy",
  "nut",
  "legume",
]);

/** Classes that are calorie-dense (flag when caloriesMax is very tight). */
const HIGH_CALORIE_CLASSES = new Set([
  "fat_oil",
  "sweetener",
  "nut",
  "cocoa_or_chocolate",
  "icing",
  "dairy",
]);

/** Classes that are carb-dense (flag for low_carb requests). */
const HIGH_CARB_CLASSES = new Set([
  "starch",
  "flour_grain",
  "sweetener",
  "fruit",
]);

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlannerMacroFeasibilityIssue = {
  code: string;
  severity: "warning" | "error";
  message: string;
};

export type PlannerMacroFeasibilityResult = {
  /** false only when a protein source is structurally absent */
  feasible: boolean;
  issues: PlannerMacroFeasibilityIssue[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasAnyClass(
  ingredients: Array<{ classes?: string[] }>,
  classSet: Set<string>
): boolean {
  return ingredients.some((ing) => (ing.classes ?? []).some((cls) => classSet.has(cls)));
}

function countIngredientsWithClass(
  ingredients: Array<{ classes?: string[] }>,
  classSet: Set<string>
): number {
  return ingredients.filter((ing) => (ing.classes ?? []).some((cls) => classSet.has(cls))).length;
}

// ── Main export ───────────────────────────────────────────────────────────────

export type PlannerMacroFeasibilityParams = {
  ingredients: PlannerIngredient[];
  macroTargets: MacroTargets | null | undefined;
  hasLowCarbConstraint?: boolean;
  hasHighProteinConstraint?: boolean;
};

export function checkPlannerMacroFeasibility(
  params: PlannerMacroFeasibilityParams
): PlannerMacroFeasibilityResult {
  const { ingredients, macroTargets, hasLowCarbConstraint, hasHighProteinConstraint } = params;

  const issues: PlannerMacroFeasibilityIssue[] = [];

  if (!macroTargets && !hasLowCarbConstraint && !hasHighProteinConstraint) {
    return { feasible: true, issues: [] };
  }

  // ── Protein ──────────────────────────────────────────────────────────────

  const proteinMin = macroTargets?.proteinMinG;
  const wantsProtein =
    (proteinMin != null && proteinMin > 0) || hasHighProteinConstraint === true;

  if (wantsProtein) {
    const hasProteinSource = hasAnyClass(ingredients, PROTEIN_DENSE_CLASSES);

    if (!hasProteinSource) {
      // Hard error: plan has a protein target but zero protein-class ingredients
      issues.push({
        code: "FEASIBILITY_NO_PROTEIN_SOURCE",
        severity: "error",
        message:
          `Plan has a protein target (${proteinMin ?? "high_protein"}) but contains no ` +
          `protein-dense ingredients (protein_meat, protein_fish, protein_plant, egg, dairy, nut).`,
      });
    } else if (proteinMin != null && proteinMin >= 30) {
      // High target: soft warning — encourage multiple protein sources
      issues.push({
        code: "FEASIBILITY_HIGH_PROTEIN_CHALLENGING",
        severity: "warning",
        message:
          `Protein target ${proteinMin}g/serving is high. Plan should include multiple ` +
          `protein-dense ingredients to have a realistic chance of meeting it.`,
      });
    }
  }

  // ── Calorie cap ───────────────────────────────────────────────────────────

  const caloriesMax = macroTargets?.caloriesMax;
  if (caloriesMax != null && caloriesMax <= 300 && ingredients.length > 0) {
    const highCalCount = countIngredientsWithClass(ingredients, HIGH_CALORIE_CLASSES);
    const ratio = highCalCount / ingredients.length;

    if (ratio >= 0.5) {
      issues.push({
        code: "FEASIBILITY_CALORIE_CAP_WEAK",
        severity: "warning",
        message:
          `Calorie cap is ${caloriesMax} but ${Math.round(ratio * 100)}% of ingredients are ` +
          `calorie-dense (fat_oil, sweetener, dairy, nut, chocolate). Plan may struggle to stay under cap.`,
      });
    }
  }

  // ── Low-carb ─────────────────────────────────────────────────────────────

  if (hasLowCarbConstraint) {
    const hasHighCarb = hasAnyClass(ingredients, HIGH_CARB_CLASSES);
    if (hasHighCarb) {
      issues.push({
        code: "FEASIBILITY_LOW_CARB_CONFLICT",
        severity: "warning",
        message:
          "Low-carb request but plan includes high-carb classes (starch, flour_grain, sweetener, fruit).",
      });
    }
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  return { feasible: errorCount === 0, issues };
}
