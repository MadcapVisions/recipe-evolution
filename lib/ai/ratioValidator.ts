/**
 * Ratio Validator
 *
 * Validates ingredient proportions based on dish family rules.
 *
 * IMPORTANT:
 * - Works best when ingredients have gram values
 * - Falls back to heuristics if grams missing
 * - Only validates ratios that can be computed safely
 * - Returns RATIO_NOT_COMPUTABLE (warning) when data is insufficient,
 *   never a false hard-fail
 */

import type { DishFamilyRule } from "./dishFamilyRules";
import { resolveIngredientGrams } from "./resolveIngredientGrams";

export type RatioValidationIssue = {
  code: "RATIO_NOT_COMPUTABLE" | "RATIO_OUT_OF_RANGE";
  severity: "warning" | "error";
  message: string;
  ratioKey: string;
  actual?: number;
  expectedMin: number;
  expectedMax: number;
};

export type RatioValidationResult = {
  passed: boolean;
  score: number;
  issues: RatioValidationIssue[];
};

type Ingredient = {
  ingredientName: string;
  normalizedName?: string | null;
  quantity?: number | null;
  unit?: string | null;
  grams?: number | null;
  densityGPerMl?: number | null;
  classes?: string[];
};

// ── Internal helpers ────────────────────────────────────────────────────────

function sumGramsByClass(
  ingredients: Ingredient[],
  targetClasses: string[]
): number | null {
  let total = 0;
  let found = false;
  for (const ing of ingredients) {
    if (!ing.classes) continue;
    if (!ing.classes.some((c) => targetClasses.includes(c))) continue;
    const grams = resolveIngredientGrams(ing);
    if (grams == null) continue;
    total += grams;
    found = true;
  }
  return found ? total : null;
}

/**
 * Like sumGramsByClass, but skips ingredients that ALSO belong to any of
 * the excludeIfHasClasses set. Used to avoid double-counting dual-class
 * ingredients (e.g. sweetened condensed milk is both sweetener AND dairy —
 * it should count as liquid, not as sweetener, in sweetener_to_liquid).
 */
function sumGramsByClassExcluding(
  ingredients: Ingredient[],
  targetClasses: string[],
  excludeIfHasClasses: string[]
): number | null {
  let total = 0;
  let found = false;
  for (const ing of ingredients) {
    if (!ing.classes) continue;
    if (!ing.classes.some((c) => targetClasses.includes(c))) continue;
    if (ing.classes.some((c) => excludeIfHasClasses.includes(c))) continue;
    const grams = resolveIngredientGrams(ing);
    if (grams == null) continue;
    total += grams;
    found = true;
  }
  return found ? total : null;
}

function sumCountUnitsByClass(
  ingredients: Ingredient[],
  targetClasses: string[]
): number | null {
  let total = 0;
  let found = false;
  for (const ing of ingredients) {
    if (!ing.classes) continue;
    if (!ing.classes.some((c) => targetClasses.includes(c))) continue;
    found = true;
    total += ing.unit === "count" && ing.quantity != null ? ing.quantity : 1;
  }
  return found ? total : null;
}

function computeRatio(
  numerator: number | null,
  denominator: number | null
): number | null {
  if (numerator == null || denominator == null) return null;
  if (denominator === 0) return null;
  return numerator / denominator;
}

function validateSingleRatio(params: {
  key: string;
  numerator: number | null;
  denominator: number | null;
  rule: { min: number; max: number };
}): RatioValidationIssue | null {
  const { key, numerator, denominator, rule } = params;
  const ratio = computeRatio(numerator, denominator);

  if (ratio == null) {
    return {
      code: "RATIO_NOT_COMPUTABLE",
      severity: "warning",
      message: `Could not compute ratio "${key}" — ingredient quantities may be missing or in unsupported units.`,
      ratioKey: key,
      expectedMin: rule.min,
      expectedMax: rule.max,
    };
  }

  if (ratio < rule.min || ratio > rule.max) {
    return {
      code: "RATIO_OUT_OF_RANGE",
      severity: "error",
      message: `Ratio "${key}" out of range: ${ratio.toFixed(2)} (expected ${rule.min}–${rule.max}).`,
      ratioKey: key,
      actual: ratio,
      expectedMin: rule.min,
      expectedMax: rule.max,
    };
  }

  return null;
}

// ── Main validator ──────────────────────────────────────────────────────────

export function validateRatios(params: {
  dishFamily: DishFamilyRule;
  ingredients: Ingredient[];
}): RatioValidationResult {
  const { dishFamily, ingredients } = params;

  if (!dishFamily.ratioRules) {
    return { passed: true, score: 1, issues: [] };
  }

  const issues: RatioValidationIssue[] = [];

  for (const [key, rule] of Object.entries(dishFamily.ratioRules)) {
    let numerator: number | null = null;
    let denominator: number | null = null;

    switch (key) {
      case "egg_to_liquid":
        numerator = sumGramsByClass(ingredients, ["egg"]);
        denominator = sumGramsByClass(ingredients, ["liquid_base", "dairy"]);
        break;

      case "sweetener_to_liquid":
        // Exclude dual-class ingredients (e.g. sweetened condensed milk = sweetener+dairy)
        // from the numerator — they belong in the liquid denominator, not both sides.
        numerator = sumGramsByClassExcluding(ingredients, ["sweetener"], ["liquid_base", "dairy"]);
        denominator = sumGramsByClass(ingredients, ["liquid_base", "dairy"]);
        break;

      case "flour_to_fat":
        numerator = sumGramsByClass(ingredients, ["flour_grain"]);
        denominator = sumGramsByClass(ingredients, ["fat_oil"]);
        break;

      case "sugar_to_flour":
        numerator = sumGramsByClass(ingredients, ["sweetener"]);
        denominator = sumGramsByClass(ingredients, ["flour_grain"]);
        break;

      case "flour_to_liquid":
        numerator = sumGramsByClass(ingredients, ["flour_grain"]);
        denominator = sumGramsByClass(ingredients, ["liquid_base", "dairy"]);
        break;

      case "egg_per_cup_flour": {
        // count-based: eggs per cup of flour (1 cup all-purpose ≈ 120g)
        numerator = sumCountUnitsByClass(ingredients, ["egg"]);
        const flourGrams = sumGramsByClass(ingredients, ["flour_grain"]);
        denominator = flourGrams != null ? flourGrams / 120 : null;
        break;
      }

      case "liquid_to_rice":
        numerator = sumGramsByClass(ingredients, ["liquid_base", "broth"]);
        denominator = sumGramsByClass(ingredients, ["starch"]);
        break;

      case "sauce_to_pasta":
        numerator = sumGramsByClass(ingredients, ["fat_oil", "dairy", "tomato_product", "sauce_base"]);
        denominator = sumGramsByClass(ingredients, ["starch"]);
        break;

      case "liquid_to_solids":
        numerator = sumGramsByClass(ingredients, ["liquid_base", "broth", "dairy"]);
        denominator = sumGramsByClass(ingredients, [
          "protein_meat", "protein_fish", "protein_plant",
          "vegetable", "leafy_green", "starch", "legume",
        ]);
        break;

      case "liquid_to_solid":
        numerator = sumGramsByClass(ingredients, ["liquid_base", "dairy"]);
        denominator = sumGramsByClass(ingredients, [
          "fruit", "protein_plant", "nut", "seed", "leafy_green",
        ]);
        break;

      case "dressing_to_salad":
        numerator = sumGramsByClass(ingredients, ["fat_oil", "acid"]);
        denominator = sumGramsByClass(ingredients, [
          "leafy_green", "vegetable", "starch", "fruit", "legume",
        ]);
        break;

      case "sweetener_to_dairy":
        numerator = sumGramsByClass(ingredients, ["sweetener"]);
        denominator = sumGramsByClass(ingredients, ["dairy"]);
        break;

      case "liquid_to_primary":
        numerator = sumGramsByClass(ingredients, ["liquid_base", "dairy", "tomato_product"]);
        denominator = sumGramsByClass(ingredients, [
          "protein_meat", "protein_fish", "protein_plant", "vegetable", "legume",
        ]);
        break;

      case "rice_to_mixins":
        numerator = sumGramsByClass(ingredients, ["starch"]);
        denominator = sumGramsByClass(ingredients, [
          "egg", "vegetable", "protein_meat", "protein_fish", "protein_plant",
        ]);
        break;

      case "sauce_to_dough":
        numerator = sumGramsByClass(ingredients, [
          "fat_oil", "dairy", "tomato_product", "sauce_base",
        ]);
        denominator = sumGramsByClass(ingredients, ["flour_grain"]);
        break;

      default:
        continue;
    }

    const issue = validateSingleRatio({ key, numerator, denominator, rule });
    if (issue) issues.push(issue);
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  let score = 1;
  score -= errorCount * 0.2;
  score -= warningCount * 0.05;
  score = Math.max(0, Math.min(1, score));

  return {
    passed: errorCount === 0,
    score,
    issues,
  };
}
