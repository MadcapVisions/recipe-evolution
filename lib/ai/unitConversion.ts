/**
 * Unit conversion helpers
 *
 * Goal:
 * - Convert common recipe units into grams when possible
 * - Use ingredient density when volume → grams conversion is needed
 * - Fail safely when conversion is not trustworthy
 */

export type SupportedUnit =
  | "g"
  | "kg"
  | "mg"
  | "ml"
  | "l"
  | "tsp"
  | "tbsp"
  | "cup"
  | "oz"
  | "lb"
  | "count";

export type IngredientForConversion = {
  ingredientName: string;
  quantity?: number | null;
  unit?: string | null;
  grams?: number | null;
  densityGPerMl?: number | null;
};

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 4.92892,
  tbsp: 14.7868,
  cup: 240,
};

const MASS_TO_G: Record<string, number> = {
  g: 1,
  kg: 1000,
  mg: 0.001,
  oz: 28.3495,
  lb: 453.592,
};

const UNIT_ALIASES: Record<string, SupportedUnit> = {
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  mg: "mg",
  milligram: "mg",
  milligrams: "mg",

  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",

  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  cup: "cup",
  cups: "cup",

  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",

  count: "count",
  whole: "count",
  piece: "count",
  pieces: "count",
  item: "count",
  items: "count",
};

export function normalizeUnit(unit?: string | null): SupportedUnit | null {
  if (!unit) return null;
  const normalized = unit.trim().toLowerCase();
  return UNIT_ALIASES[normalized] ?? null;
}

export function convertMassToGrams(
  quantity?: number | null,
  unit?: string | null
): number | null {
  if (quantity == null) return null;
  const normalizedUnit = normalizeUnit(unit);
  if (!normalizedUnit) return null;
  if (normalizedUnit in MASS_TO_G) {
    return quantity * MASS_TO_G[normalizedUnit];
  }
  return null;
}

export function convertVolumeToMl(
  quantity?: number | null,
  unit?: string | null
): number | null {
  if (quantity == null) return null;
  const normalizedUnit = normalizeUnit(unit);
  if (!normalizedUnit) return null;
  if (normalizedUnit in VOLUME_TO_ML) {
    return quantity * VOLUME_TO_ML[normalizedUnit];
  }
  return null;
}

export function convertVolumeToGrams(params: {
  quantity?: number | null;
  unit?: string | null;
  densityGPerMl?: number | null;
}): number | null {
  const { quantity, unit, densityGPerMl } = params;
  if (densityGPerMl == null) return null;
  const ml = convertVolumeToMl(quantity, unit);
  if (ml == null) return null;
  return ml * densityGPerMl;
}

/**
 * Main helper.
 *
 * Priority:
 * 1. explicit grams field
 * 2. direct mass conversion
 * 3. volume conversion using density
 * 4. otherwise null
 */
export function getIngredientGrams(
  ingredient: IngredientForConversion
): number | null {
  if (ingredient.grams != null) return ingredient.grams;

  const directMass = convertMassToGrams(ingredient.quantity, ingredient.unit);
  if (directMass != null) return directMass;

  const fromVolume = convertVolumeToGrams({
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    densityGPerMl: ingredient.densityGPerMl,
  });
  if (fromVolume != null) return fromVolume;

  return null;
}
