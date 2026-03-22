import { callAIForJson } from "./jsonResponse";
import { CHEF_SYSTEM_PROMPT } from "./chefSystemPrompt";
import { validateRecipe } from "./schema/recipeValidator";
import { hashAiCacheInput, readAiCache, writeAiCache } from "./cache";
import { createAiRecipeResult, parseAiRecipeResult, type AiRecipeResult } from "./recipeResult";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatIngredientLine } from "../recipes/recipeDraft";
import { resolveAiTaskSettings } from "./taskSettings";

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
  "version_label": string,
  "explanation": string,
  "servings": number|null,
  "prep_time_min": number|null,
  "cook_time_min": number|null,
  "difficulty": string|null,
  "ingredients": [{ "name": string, "quantity": number, "unit": string|null, "prep": string|null }],
  "steps": [{ "text": string }]
}

Rules:
- version_label: 2-4 words describing what changed, suitable for a version badge. Examples: "With Potatoes", "Dairy-Free", "Spicier Version", "Faster Cook", "Added Lemon". Use title case. Do not include the word "recipe".
- Always make changes that directly and visibly address the instruction. Vague rewrites are not acceptable.
- For "spicier" or "more heat": increase or add chili, cayenne, jalapeño, gochujang, or hot sauce — make at least 2 ingredient-level changes.
- For "simpler" or "fewer ingredients": reduce the ingredient count by at least 2-3 items and combine or cut steps.
- For "faster" or "quicker": lower cook_time_min meaningfully, prefer high-heat techniques over braises, and cut prep steps.
- For "healthier" or "lighter": reduce butter, oil, cream, and cheese; add vegetables or lean protein; lower calorie density.
- For "richer" or "creamier": add cream, butter, or cheese; deepen the sauce base; use fond or stock reduction.
- For "more flavor" or "bolder": amplify aromatics (garlic, onion, shallot), add acid (lemon, vinegar), or add umami (parmesan, soy, miso, fish sauce).
- For "vegetarian" or "vegan": swap meat proteins for legumes, tofu, or tempeh; ensure the swap preserves texture and flavor weight.
- Preserve the core dish identity and format unless the instruction explicitly says to change it.
- Every ingredient must include an explicit quantity. Good: 2 onions, 1.5 lb chicken, 2 tbsp olive oil. Bad: onion, chicken, olive oil.
- Keep steps practical and home-cook friendly.
- Each step must contain an actionable cooking verb and enough detail to be unambiguous — include timing, temperature, or doneness cues where relevant. Never write vague steps like "Cook until done" or "Add ingredients."
- Produce a complete recipe, not notes. Every step should be executable without guessing.
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

  const taskSetting = await resolveAiTaskSettings("recipe_improvement");
  if (!taskSetting.enabled) {
    throw new Error("Recipe improvement AI task is disabled.");
  }
  const result = await callAIForJson(messages, {
    max_tokens: taskSetting.maxTokens,
    temperature: taskSetting.temperature,
    model: taskSetting.primaryModel,
    fallback_models: taskSetting.fallbackModel ? [taskSetting.fallbackModel] : [],
  });
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
  const version_label =
    typeof obj.version_label === "string" && obj.version_label.trim().length > 0 ? obj.version_label.trim() : null;

  const improved = createAiRecipeResult({
    purpose: "refine",
    source: "ai",
    provider: result.provider,
    model: result.model ?? result.provider,
    cached: false,
    inputHash,
    createdAt: new Date().toISOString(),
    explanation,
    version_label,
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
