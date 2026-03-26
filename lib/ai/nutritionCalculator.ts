/**
 * Nutrition calculator
 *
 * Computes recipe-level nutrition totals from a list of ingredients,
 * using the nutrition mapper to match each ingredient to catalog data
 * and resolveIngredientGrams to convert quantities to grams.
 */

import { findNutritionMatch } from "./nutritionMapper";
import { resolveIngredientGrams, resolveIngredientDensity } from "./resolveIngredientGrams";
import { deriveIngredientDetails } from "../recipes/canonicalEnrichment";
import type {
  IngredientForNutrition,
  IngredientNutritionMatch,
  NutritionCalculationResult,
  NutritionPer100g,
  RecipeNutritionTotals,
} from "./nutritionTypes";

// ── Internal helpers ─────────────────────────────────────────────────────────

function zeroTotals(): RecipeNutritionTotals {
  return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0 };
}

function scalePer100g(per100g: NutritionPer100g, grams: number): RecipeNutritionTotals {
  const scale = grams / 100;
  return {
    calories: per100g.calories * scale,
    protein_g: per100g.protein_g * scale,
    carbs_g: per100g.carbs_g * scale,
    fat_g: per100g.fat_g * scale,
    fiber_g: (per100g.fiber_g ?? 0) * scale,
    sugar_g: (per100g.sugar_g ?? 0) * scale,
    sodium_mg: (per100g.sodium_mg ?? 0) * scale,
  };
}

function addTotals(a: RecipeNutritionTotals, b: RecipeNutritionTotals): RecipeNutritionTotals {
  return {
    calories: a.calories + b.calories,
    protein_g: a.protein_g + b.protein_g,
    carbs_g: a.carbs_g + b.carbs_g,
    fat_g: a.fat_g + b.fat_g,
    fiber_g: a.fiber_g + b.fiber_g,
    sugar_g: a.sugar_g + b.sugar_g,
    sodium_mg: a.sodium_mg + b.sodium_mg,
  };
}

function divideTotals(totals: RecipeNutritionTotals, n: number): RecipeNutritionTotals {
  return {
    calories: totals.calories / n,
    protein_g: totals.protein_g / n,
    carbs_g: totals.carbs_g / n,
    fat_g: totals.fat_g / n,
    fiber_g: totals.fiber_g / n,
    sugar_g: totals.sugar_g / n,
    sodium_mg: totals.sodium_mg / n,
  };
}

function roundTotals(totals: RecipeNutritionTotals): RecipeNutritionTotals {
  return {
    calories: Math.round(totals.calories),
    protein_g: Math.round(totals.protein_g * 10) / 10,
    carbs_g: Math.round(totals.carbs_g * 10) / 10,
    fat_g: Math.round(totals.fat_g * 10) / 10,
    fiber_g: Math.round(totals.fiber_g * 10) / 10,
    sugar_g: Math.round(totals.sugar_g * 10) / 10,
    sodium_mg: Math.round(totals.sodium_mg),
  };
}

// ── Per-ingredient matching ──────────────────────────────────────────────────

function matchIngredient(ing: IngredientForNutrition): IngredientNutritionMatch {
  const warnings: string[] = [];

  // Resolve grams
  const density =
    ing.densityGPerMl ??
    resolveIngredientDensity(ing.normalizedName ?? null, ing.ingredientName);

  let gramsUsed = resolveIngredientGrams({
    ingredientName: ing.ingredientName,
    normalizedName: ing.normalizedName,
    quantity: ing.quantity,
    unit: ing.unit,
    grams: ing.grams,
    densityGPerMl: density,
  });

  // Egg count fallback: 1 large egg ≈ 50g
  if (gramsUsed == null && ing.unit === "count" && ing.quantity != null) {
    gramsUsed = ing.quantity * 50;
  }

  const { entry, confidence } = findNutritionMatch(ing.ingredientName);

  if (!entry) {
    return {
      ingredientName: ing.ingredientName,
      normalizedName: ing.normalizedName,
      matched: false,
      confidence,
      gramsUsed,
      warnings: [`No nutrition data found for "${ing.ingredientName}"`],
    };
  }

  if (gramsUsed == null) {
    warnings.push(
      `Could not resolve grams for "${ing.ingredientName}" — nutrition contribution excluded`
    );
    return {
      ingredientName: ing.ingredientName,
      normalizedName: ing.normalizedName,
      matched: true,
      confidence,
      nutritionKey: entry.key,
      gramsUsed: null,
      nutritionPer100g: entry.per100g,
      warnings,
    };
  }

  const totals = scalePer100g(entry.per100g, gramsUsed);

  return {
    ingredientName: ing.ingredientName,
    normalizedName: ing.normalizedName,
    matched: true,
    confidence,
    nutritionKey: entry.key,
    gramsUsed,
    nutritionPer100g: entry.per100g,
    totals,
    warnings,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Calculate nutrition for a recipe given a list of raw ingredient name strings.
 *
 * @param ingredients - array of `{ name: string }` (canonical DB shape)
 * @param servings    - optional serving count for per-serving breakdown
 */
export function calculateRecipeNutrition(
  ingredients: Array<{ name: string }>,
  servings?: number | null
): NutritionCalculationResult {
  const warnings: string[] = [];

  // Parse each ingredient name into structured fields
  const enriched: IngredientForNutrition[] = ingredients.map((ing) => {
    const parsed = deriveIngredientDetails(ing.name);
    return {
      ingredientName: ing.name,
      normalizedName: parsed.name ?? null,
      quantity: parsed.quantity ?? null,
      unit: parsed.unit ?? null,
      grams: null,
      densityGPerMl: null,
    };
  });

  // Match each ingredient
  const ingredientMatches = enriched.map(matchIngredient);

  // Aggregate totals — only include ingredients with both a match AND resolved grams
  let totals = zeroTotals();
  let mappedCount = 0;
  let unmappedCount = 0;
  let totalConfidence = 0;

  for (const match of ingredientMatches) {
    if (!match.matched) {
      unmappedCount++;
      continue;
    }
    mappedCount++;
    totalConfidence += match.confidence;

    if (match.totals) {
      totals = addTotals(totals, match.totals);
    }
    if (match.warnings.length > 0) {
      warnings.push(...match.warnings);
    }
  }

  const confidenceScore =
    mappedCount + unmappedCount > 0
      ? totalConfidence / (mappedCount + unmappedCount)
      : 0;

  const roundedTotals = roundTotals(totals);

  const servingCount =
    servings != null && servings > 0 ? servings : null;

  const perServing =
    servingCount != null
      ? roundTotals(divideTotals(totals, servingCount))
      : null;

  return {
    totals: roundedTotals,
    perServing,
    servingCount,
    ingredientMatches,
    mappedIngredientCount: mappedCount,
    unmappedIngredientCount: unmappedCount,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    warnings,
  };
}
