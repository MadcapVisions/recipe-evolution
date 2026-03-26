export type NutritionPer100g = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
};

export type NutritionCatalogEntry = {
  key: string;
  displayName: string;
  aliases: string[];
  per100g: NutritionPer100g;
};

export type IngredientForNutrition = {
  ingredientName: string;
  normalizedName?: string | null;
  quantity?: number | null;
  unit?: string | null;
  grams?: number | null;
  densityGPerMl?: number | null;
  classes?: string[];
};

export type IngredientNutritionMatch = {
  ingredientName: string;
  normalizedName?: string | null;
  matched: boolean;
  confidence: number;
  nutritionKey?: string;
  gramsUsed?: number | null;
  nutritionPer100g?: NutritionPer100g;
  totals?: RecipeNutritionTotals;
  warnings: string[];
};

export type RecipeNutritionTotals = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
};

export type NutritionCalculationResult = {
  totals: RecipeNutritionTotals;
  perServing: RecipeNutritionTotals | null;
  servingCount: number | null;
  ingredientMatches: IngredientNutritionMatch[];
  mappedIngredientCount: number;
  unmappedIngredientCount: number;
  confidenceScore: number;
  warnings: string[];
};
