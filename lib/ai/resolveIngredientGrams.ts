/**
 * Bridges parsed ingredient data into grams for ratio validation.
 *
 * Uses:
 * - ingredientDensity.ts for name-based density lookup
 * - unitConversion.ts for unit → grams conversion
 * - canonicalEnrichment.ts to parse quantity/unit from ingredient name strings
 * - ingredientClassifier.ts to classify ingredients
 */

import { INGREDIENT_DENSITY_G_PER_ML } from "./ingredientDensity";
import { getIngredientGrams } from "./unitConversion";
import { deriveIngredientDetails } from "../recipes/canonicalEnrichment";
import { classifyIngredient } from "./ingredientClassifier";

export type ResolvedIngredientForRatio = {
  ingredientName: string;
  normalizedName: string | null;
  quantity: number | null;
  unit: string | null;
  grams: number | null;
  densityGPerMl: number | null;
  classes: string[];
};

function lookupDensity(name: string | null | undefined): number | null {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  return INGREDIENT_DENSITY_G_PER_ML[key] ?? null;
}

/**
 * Resolve the best available density for an ingredient.
 * Tries normalized name first, then raw ingredient name.
 */
export function resolveIngredientDensity(
  normalizedName: string | null,
  ingredientName: string
): number | null {
  return lookupDensity(normalizedName) ?? lookupDensity(ingredientName) ?? null;
}

/**
 * Resolve grams for a single ingredient given its parsed fields.
 */
export function resolveIngredientGrams(ingredient: {
  ingredientName: string;
  normalizedName?: string | null;
  quantity?: number | null;
  unit?: string | null;
  grams?: number | null;
  densityGPerMl?: number | null;
}): number | null {
  const density =
    ingredient.densityGPerMl ??
    resolveIngredientDensity(ingredient.normalizedName ?? null, ingredient.ingredientName);

  return getIngredientGrams({
    ingredientName: ingredient.normalizedName || ingredient.ingredientName,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    grams: ingredient.grams ?? null,
    densityGPerMl: density,
  });
}

/**
 * Parse a raw ingredient name string ("2 cups all-purpose flour") into a
 * fully resolved ingredient suitable for ratio validation.
 */
export function resolveIngredientFromName(
  rawName: string
): ResolvedIngredientForRatio {
  const parsed = deriveIngredientDetails(rawName);
  const classes = classifyIngredient(rawName);
  const normalizedName = parsed.name ?? null;
  const density = resolveIngredientDensity(normalizedName, rawName);

  const grams = getIngredientGrams({
    ingredientName: normalizedName || rawName,
    quantity: parsed.quantity,
    unit: parsed.unit,
    grams: null,
    densityGPerMl: density,
  });

  return {
    ingredientName: rawName,
    normalizedName,
    quantity: parsed.quantity,
    unit: parsed.unit,
    grams,
    densityGPerMl: density,
    classes,
  };
}

/**
 * Resolve a full ingredient list from raw `{ name: string }[]` objects.
 */
export function resolveIngredientListForRatio(
  ingredients: Array<{ name: string }>
): ResolvedIngredientForRatio[] {
  return ingredients.map((ing) => resolveIngredientFromName(ing.name));
}
