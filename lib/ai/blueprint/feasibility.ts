import type { ResolvedCookingIntent } from "../intent/intentTypes";
import type { FeasibilityFlags } from "./blueprintTypes";
import { getFamilyBlueprintRule } from "./familyBlueprintRules";

const TIME_BUDGET_PATTERN = /(\d+)\s*min/i;
const IMPOSSIBLY_SHORT_MINUTES = 10;

/**
 * Blueprint-stage feasibility check.
 * Called before the expensive LLM drafting step.
 * Feasibility failures are logged as telemetry category "blueprint_feasibility"
 * and are distinct from post-draft structural/culinary validation failures.
 */
export function checkBlueprintFeasibility(
  intent: ResolvedCookingIntent,
  isFamilyKnown?: boolean
): FeasibilityFlags {
  const issues: string[] = [];
  const family = intent.dishFamily;
  const rule = family !== null ? getFamilyBlueprintRule(family) : null;

  // Family fit
  const familyFit = isFamilyKnown !== undefined ? isFamilyKnown : rule !== null;
  if (!familyFit) {
    issues.push(
      `Dish family "${family ?? "unknown"}" is not in the launch family set. Generation will use conservative fallback rules.`
    );
  }

  // Ingredient fit — hard-forbidden ingredients mentioned by user
  const forbiddenConstraints = intent.constraints.filter(
    (c) => c.type === "forbidden_ingredient" && c.strength === "hard"
  );
  const conflictingIngredients = intent.ingredientMentions.filter((ing) =>
    forbiddenConstraints.some(
      (fc) =>
        ing.toLowerCase().includes(fc.value.toLowerCase()) ||
        fc.value.toLowerCase().includes(ing.toLowerCase())
    )
  );
  const ingredientFit = conflictingIngredients.length === 0;
  if (!ingredientFit) {
    issues.push(
      `Ingredient conflict: user mentioned [${conflictingIngredients.join(", ")}] but these overlap with hard forbidden constraints.`
    );
  }

  // Equipment fit — placeholder; extended in future
  const equipmentFit = true;

  // Time budget plausibility
  const timeConstraints = intent.constraints.filter((c) => c.type === "technique");
  let timeBudgetPlausible = true;
  for (const tc of timeConstraints) {
    const match = TIME_BUDGET_PATTERN.exec(tc.value);
    if (match) {
      const requestedMinutes = parseInt(match[1], 10);
      const minimumForFamily =
        rule !== null
          ? rule.defaultDifficultyMinutes.prep + rule.defaultDifficultyMinutes.cook
          : IMPOSSIBLY_SHORT_MINUTES;
      if (requestedMinutes < IMPOSSIBLY_SHORT_MINUTES) {
        timeBudgetPlausible = false;
        issues.push(
          `Time budget "${tc.value}" is implausibly short. Minimum realistic time is ${IMPOSSIBLY_SHORT_MINUTES} minutes.`
        );
      } else if (requestedMinutes < minimumForFamily) {
        timeBudgetPlausible = false;
        issues.push(
          `Time budget "${tc.value}" is shorter than the typical ${minimumForFamily} minutes needed for ${family}.`
        );
      }
    }
  }

  const difficultyPlausible = true;

  return {
    familyFit,
    ingredientFit,
    equipmentFit,
    timeBudgetPlausible,
    difficultyPlausible,
    issues,
  };
}
