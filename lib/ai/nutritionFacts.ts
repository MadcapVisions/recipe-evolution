import type { SupabaseClient } from "@supabase/supabase-js";
import { callAIForJson } from "./jsonResponse";
import { hashAiCacheInput, readAiCache, writeAiCache } from "./cache";

export type NutritionFacts = {
  calories: number;
  totalFat: number;     // grams
  saturatedFat: number; // grams
  cholesterol: number;  // mg
  sodium: number;       // mg
  totalCarbs: number;   // grams
  dietaryFiber: number; // grams
  sugars: number;       // grams
  protein: number;      // grams
};

type RecipeInput = {
  title: string;
  servings: number;
  ingredients: { name: string }[];
};

function parseNutritionFacts(value: unknown): NutritionFacts | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  const nums = ["calories", "totalFat", "saturatedFat", "cholesterol", "sodium", "totalCarbs", "dietaryFiber", "sugars", "protein"];
  for (const key of nums) {
    if (typeof raw[key] !== "number") return null;
  }
  return {
    calories: raw.calories as number,
    totalFat: raw.totalFat as number,
    saturatedFat: raw.saturatedFat as number,
    cholesterol: raw.cholesterol as number,
    sodium: raw.sodium as number,
    totalCarbs: raw.totalCarbs as number,
    dietaryFiber: raw.dietaryFiber as number,
    sugars: raw.sugars as number,
    protein: raw.protein as number,
  };
}

export async function estimateNutritionFacts(
  recipe: RecipeInput,
  options: { supabase: SupabaseClient; userId: string; force?: boolean }
): Promise<NutritionFacts> {
  const cacheInput = {
    title: recipe.title,
    servings: recipe.servings,
    ingredients: recipe.ingredients.map((i) => i.name).sort(),
  };
  const inputHash = hashAiCacheInput(cacheInput);

  if (!options.force) {
    const cached = await readAiCache<NutritionFacts>(options.supabase, options.userId, "nutrition", inputHash);
    if (cached) {
      const parsed = parseNutritionFacts(cached.response_json);
      if (parsed) return parsed;
    }
  }

  const ingredientList = recipe.ingredients.map((i) => `- ${i.name}`).join("\n");
  const prompt = `Estimate nutrition facts per serving for this recipe. Return ONLY a JSON object, no other text.

Recipe: ${recipe.title}
Servings: ${recipe.servings}
Ingredients:
${ingredientList}

Return this exact JSON shape (all values are numbers, no nulls):
{
  "calories": <kcal per serving>,
  "totalFat": <grams>,
  "saturatedFat": <grams>,
  "cholesterol": <mg>,
  "sodium": <mg>,
  "totalCarbs": <grams>,
  "dietaryFiber": <grams>,
  "sugars": <grams>,
  "protein": <grams>
}

Use realistic estimates based on typical ingredient quantities for this dish. Round to nearest whole number.`;

  const result = await callAIForJson(
    [{ role: "user", content: prompt }],
    { response_format: { type: "json_object" }, temperature: 0.1 }
  );

  const facts = parseNutritionFacts(result.parsed);
  if (!facts) {
    throw new Error("AI returned invalid nutrition facts shape");
  }

  await writeAiCache(options.supabase, options.userId, "nutrition", inputHash, result.model ?? "unknown", facts);

  return facts;
}
