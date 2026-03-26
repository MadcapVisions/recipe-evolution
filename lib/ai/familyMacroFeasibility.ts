/**
 * Family-level macro feasibility checker.
 *
 * Some macro target combinations are structurally incompatible with a dish
 * family regardless of ingredient choice. Detect these early — before entering
 * the planner loop — so the system can reject them cleanly rather than
 * burning retries on an impossible constraint.
 *
 * Examples:
 *   - cheesecake + caloriesMax 120  → impossible (cream cheese alone exceeds this)
 *   - brownie    + caloriesMax 100 + proteinMinG 20 → extremely unlikely
 */

import type { MacroTargets } from "./macroTargetValidator";

// ── Per-family thresholds ─────────────────────────────────────────────────────

/**
 * Minimum realistic calories per serving for each dish family.
 * A requested caloriesMax below this value cannot be achieved while
 * preserving dish identity.
 */
const FAMILY_MIN_CALORIES_PER_SERVING: Partial<Record<string, number>> = {
  cheesecake: 250,  // cream cheese base is inherently calorie-dense
  brownie: 150,     // dense butter/chocolate/sugar structure
  cake: 150,
  cookie: 100,
  muffin: 120,
  scone: 150,
};

/**
 * Maximum realistic protein (g/serving) achievable for a family without
 * specialized ingredients (protein powder, skyr, high-protein substitutes).
 * Applies when BOTH a protein floor AND a calorie ceiling are requested.
 */
const FAMILY_MAX_NATURAL_PROTEIN_WITH_CALORIE_CAP: Partial<Record<string, number>> = {
  cheesecake: 12,   // eggs + cream cheese top out ~8-12g; 15g is borderline; 20g+ impossible
  brownie: 10,      // eggs + nut butter give ~6-10g; higher requires protein powder
  smoothie: 25,     // standard dairy/legume sources top out ~20-25g within any reasonable calorie budget
};

/**
 * Minimum realistic carbs (g/serving) for families whose identity depends on
 * a starchy base. A carbsMaxG below this value cannot be achieved without
 * abandoning the dish family entirely.
 */
const FAMILY_MIN_CARBS_PER_SERVING: Partial<Record<string, number>> = {
  pasta: 20,          // noodle base is structurally carb-dense; even small portions exceed 20g
  fried_rice: 20,     // rice base requires significant carbs
  pizza_flatbread: 25, // dough base requires carbs
};

// ── Types ─────────────────────────────────────────────────────────────────────

export type FamilyFeasibilityResult = {
  feasible: boolean;
  code?: string;
  reason?: string;
};

// ── Main export ───────────────────────────────────────────────────────────────

export function checkFamilyMacroFeasibility(params: {
  dishFamilyKey: string;
  macroTargets: MacroTargets | null | undefined;
}): FamilyFeasibilityResult {
  const { dishFamilyKey, macroTargets } = params;

  if (!macroTargets) return { feasible: true };

  const caloriesMax = macroTargets.caloriesMax;
  const proteinMin = macroTargets.proteinMinG;

  // ── Calorie floor check ────────────────────────────────────────────────────

  const minCal = FAMILY_MIN_CALORIES_PER_SERVING[dishFamilyKey];
  if (minCal != null && caloriesMax != null && caloriesMax < minCal) {
    return {
      feasible: false,
      code: "FAMILY_CALORIE_CAP_INFEASIBLE",
      reason:
        `"${dishFamilyKey}" requires at least ~${minCal} cal/serving to maintain dish identity ` +
        `(requested max: ${caloriesMax}). This constraint cannot be satisfied.`,
    };
  }

  // ── Combined protein + calorie ceiling check ───────────────────────────────

  const maxNaturalProtein = FAMILY_MAX_NATURAL_PROTEIN_WITH_CALORIE_CAP[dishFamilyKey];
  if (
    maxNaturalProtein != null &&
    proteinMin != null &&
    proteinMin > maxNaturalProtein &&
    caloriesMax != null
  ) {
    return {
      feasible: false,
      code: "FAMILY_PROTEIN_CALORIE_INFEASIBLE",
      reason:
        `"${dishFamilyKey}" cannot provide ${proteinMin}g protein/serving within ${caloriesMax} cal ` +
        `using standard ingredients. Standard maximum is ~${maxNaturalProtein}g protein.`,
    };
  }

  // ── Carb floor check ──────────────────────────────────────────────────────

  const carbsMax = macroTargets.carbsMaxG;
  const minCarbs = FAMILY_MIN_CARBS_PER_SERVING[dishFamilyKey];
  if (minCarbs != null && carbsMax != null && carbsMax < minCarbs) {
    return {
      feasible: false,
      code: "FAMILY_CARB_CAP_INFEASIBLE",
      reason:
        `"${dishFamilyKey}" requires at least ~${minCarbs}g carbs/serving to maintain dish identity ` +
        `(requested max: ${carbsMax}g). This constraint cannot be satisfied.`,
    };
  }

  return { feasible: true };
}
