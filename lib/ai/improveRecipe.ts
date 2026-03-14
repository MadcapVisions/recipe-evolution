import { callAIForJson } from "./jsonResponse";
import { CHEF_SYSTEM_PROMPT } from "./chefSystemPrompt";
import { TOKEN_LIMITS } from "./config/tokenLimits";
import { validateRecipe } from "./schema/recipeValidator";
import { hashAiCacheInput, readAiCache, writeAiCache } from "./cache";
import { createAiRecipeResult, parseAiRecipeResult, type AiRecipeResult } from "./recipeResult";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatIngredientLine } from "../recipes/recipeDraft";

type ImproveRecipeInput = {
  instruction: string;
  userTasteSummary?: string;
  recipe: {
    title: string;
    servings: number | null;
    prep_time_min: number | null;
    cook_time_min: number | null;
    difficulty: string | null;
    ingredients: Array<{ name: string }>;
    steps: Array<{ text: string }>;
  };
};

type ImproveRecipeCacheContext = {
  supabase: SupabaseClient;
  userId: string;
};

function normalizeIngredients(value: unknown): Array<{ name: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const raw = item as Record<string, unknown>;
      const name = raw.name;
      if (typeof name !== "string" || !name.trim()) {
        return null;
      }
      return {
        name:
          formatIngredientLine({
            name,
            quantity: typeof raw.quantity === "number" ? raw.quantity : null,
            unit: typeof raw.unit === "string" ? raw.unit : null,
            prep: typeof raw.prep === "string" ? raw.prep : null,
          }) || name.trim(),
      };
    })
    .filter((item): item is { name: string } => item !== null);
}

function normalizeSteps(value: unknown): Array<{ text: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const text = (item as Record<string, unknown>).text;
      if (typeof text !== "string" || !text.trim()) {
        return null;
      }
      return { text: text.trim() };
    })
    .filter((item): item is { text: string } => item !== null);
}

export async function improveRecipe(
  input: ImproveRecipeInput,
  cacheContext?: ImproveRecipeCacheContext
): Promise<AiRecipeResult> {
  const inputHash = cacheContext
    ? hashAiCacheInput({
        instruction: input.instruction,
        userTasteSummary: input.userTasteSummary?.trim() || null,
        recipe: input.recipe,
      })
    : null;

  if (cacheContext && inputHash) {
    const cached = await readAiCache<unknown>(cacheContext.supabase, cacheContext.userId, "refine", inputHash);
    if (cached) {
      const parsedCached = parseAiRecipeResult(cached.response_json);
      if (parsedCached) {
        return parsedCached;
      }
    }
  }

  const messages = [
    {
      role: "system" as const,
      content: `${CHEF_SYSTEM_PROMPT}

User taste summary: ${input.userTasteSummary?.trim() || "No user taste summary available."}

When asked to improve a recipe, you must return ONLY valid JSON with no markdown:
{
  "title": string,
  "explanation": string,
  "servings": number|null,
  "prep_time_min": number|null,
  "cook_time_min": number|null,
  "difficulty": string|null,
  "ingredients": [{ "name": string, "quantity": number, "unit": string|null, "prep": string|null }],
  "steps": [{ "text": string }]
}

Rules:
- Always make meaningful changes for the instruction.
- Every ingredient must include an explicit quantity. Good: 2 onions, 1.5 lb chicken, 2 tbsp olive oil. Bad: onion, chicken, olive oil.
- Keep steps practical and home-cook friendly.
- Do not include any text outside the JSON object.`,
    },
    {
      role: "user" as const,
      content: `Instruction:
${input.instruction}

Current recipe:
${JSON.stringify(input.recipe, null, 2)}`,
    },
  ];

  const result = await callAIForJson(messages, TOKEN_LIMITS.recipeVariation);
  const { parsed } = result;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI returned invalid recipe payload.");
  }

  const obj = parsed as Record<string, unknown>;
  const ingredients = normalizeIngredients(obj.ingredients);
  const steps = normalizeSteps(obj.steps);
  const title = typeof obj.title === "string" && obj.title.trim() ? obj.title.trim() : input.recipe.title;
  const normalizedRecipeForValidation = {
    title,
    ingredients: ingredients.map((item) => item.name),
    steps: steps.map((item) => item.text),
    chefTips: Array.isArray(obj.chefTips)
      ? obj.chefTips
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .map((item) => item.trim())
      : [],
  };

  if (!validateRecipe(normalizedRecipeForValidation)) {
    throw new Error("Invalid recipe format returned by AI");
  }

  const explanation =
    typeof obj.explanation === "string" && obj.explanation.trim().length > 0 ? obj.explanation.trim() : null;

  const improved = createAiRecipeResult({
    purpose: "refine",
    source: "ai",
    provider: result.provider,
    model: result.model ?? result.provider,
    cached: false,
    inputHash,
    createdAt: new Date().toISOString(),
    explanation,
    recipe: {
      title,
      description: null,
      tags: null,
      servings: typeof obj.servings === "number" ? obj.servings : input.recipe.servings,
      prep_time_min: typeof obj.prep_time_min === "number" ? obj.prep_time_min : input.recipe.prep_time_min,
      cook_time_min: typeof obj.cook_time_min === "number" ? obj.cook_time_min : input.recipe.cook_time_min,
      difficulty:
        typeof obj.difficulty === "string" && obj.difficulty.trim().length > 0
          ? obj.difficulty.trim()
          : input.recipe.difficulty,
      ingredients,
      steps,
    },
  });

  if (cacheContext && inputHash) {
    await writeAiCache(
      cacheContext.supabase,
      cacheContext.userId,
      "refine",
      inputHash,
      result.model ?? result.provider,
      improved
    );
  }

  return improved;
}
