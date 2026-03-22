import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { callAIWithMeta } from "./aiClient";
import { parseJsonResponse } from "./jsonResponse";
import { createAiRecipeResult, type AiRecipeResult } from "./recipeResult";
import { formatIngredientLine } from "../recipes/recipeDraft";
import { resolveAiTaskSettings } from "./taskSettings";

type PreferredUnits = "metric" | "imperial";

type StructuredIngredient = {
  name: string;
  quantity: number;
  unit: string | null;
  prep: string | null;
  optional: boolean;
  group: string | null;
};

type StructuredStep = {
  text: string;
  timer_seconds: number | null;
  temperature_c: number | null;
  temperature_f: number | null;
  equipment: string[] | null;
};

type StructuredRecipe = {
  title: string;
  description: string | null;
  servings: number | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  difficulty: string | null;
  tags: string[];
  ingredients_json: StructuredIngredient[];
  steps_json: StructuredStep[];
};

export class StructureRecipeLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StructureRecipeLimitError";
  }
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function parseStructuredRecipe(value: unknown): StructuredRecipe | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  if (typeof raw.title !== "string") {
    return null;
  }

  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((item): item is string => typeof item === "string")
    : [];

  const sourceIngredients = Array.isArray(raw.ingredients_json)
    ? raw.ingredients_json
    : Array.isArray(raw.ingredients)
      ? raw.ingredients
      : null;

  const sourceSteps = Array.isArray(raw.steps_json)
    ? raw.steps_json
    : Array.isArray(raw.steps)
      ? raw.steps
      : null;

  if (!sourceIngredients || !sourceSteps) {
    return null;
  }

  const ingredients_json: StructuredIngredient[] = sourceIngredients
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }
      const ingredient = item as Record<string, unknown>;
      if (typeof ingredient.name !== "string") {
        return null;
      }
      const name = ingredient.name.trim();
      if (!name) {
        return null;
      }
      if (typeof ingredient.quantity !== "number" || !Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0) {
        return null;
      }
      return {
        name,
        quantity: ingredient.quantity,
        unit: typeof ingredient.unit === "string" ? ingredient.unit : null,
        prep: typeof ingredient.prep === "string" ? ingredient.prep : null,
        optional: typeof ingredient.optional === "boolean" ? ingredient.optional : false,
        group: typeof ingredient.group === "string" ? ingredient.group : null,
      };
    })
    .filter((item): item is StructuredIngredient => item !== null && item.name.length > 0);

  const steps_json: StructuredStep[] = sourceSteps
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }
      const step = item as Record<string, unknown>;
      if (typeof step.text !== "string" || step.text.trim().length === 0) {
        return null;
      }
      return {
        text: step.text.trim(),
        timer_seconds: typeof step.timer_seconds === "number" ? step.timer_seconds : null,
        temperature_c: typeof step.temperature_c === "number" ? step.temperature_c : null,
        temperature_f: typeof step.temperature_f === "number" ? step.temperature_f : null,
        equipment: Array.isArray(step.equipment)
          ? step.equipment.filter((item): item is string => typeof item === "string")
          : null,
      };
    })
    .filter((item): item is StructuredStep => item !== null);

  if (ingredients_json.length === 0 || steps_json.length === 0) {
    return null;
  }

  return {
    title: raw.title.trim(),
    description: typeof raw.description === "string" ? raw.description : null,
    servings: typeof raw.servings === "number" ? raw.servings : null,
    prep_time_min: typeof raw.prep_time_min === "number" ? raw.prep_time_min : null,
    cook_time_min: typeof raw.cook_time_min === "number" ? raw.cook_time_min : null,
    difficulty: typeof raw.difficulty === "string" ? raw.difficulty : null,
    tags,
    ingredients_json,
    steps_json,
  };
}

export async function structureRecipeFromRawText(input: {
  supabase: SupabaseClient;
  userId: string;
  rawText: string;
  preferredUnits?: PreferredUnits;
}): Promise<AiRecipeResult> {
  const rawText = input.rawText.trim();
  if (!rawText) {
    throw new Error("rawText is required.");
  }

  const preferredUnits: PreferredUnits = input.preferredUnits === "imperial" ? "imperial" : "metric";

  const inputHash = sha256(`${rawText}::${preferredUnits}`);
  let cacheAvailable = true;
  let cached: { response_json: unknown; created_at: string; model: string } | null = null;

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentCount, error: rateLimitError } = await input.supabase
    .from("ai_cache")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", input.userId)
    .eq("purpose", "structure")
    .gt("created_at", oneDayAgo);

  if (rateLimitError) {
    cacheAvailable = false;
    console.warn("Structure recipe daily limit query failed; continuing without cache:", rateLimitError.message);
  }

  if (cacheAvailable && (recentCount ?? 0) >= 10) {
    const { error: limitEventError } = await input.supabase.from("product_events").insert({
      owner_id: input.userId,
      event_name: "limit_hit",
      metadata_json: {
        limit: "ai_structure_per_day",
        max: 10,
      },
    });

    if (limitEventError) {
      console.warn("Could not log structure limit_hit event:", limitEventError.message);
    }

    throw new StructureRecipeLimitError("Daily limit reached: up to 10 AI structure calls per day.");
  }

  if (cacheAvailable) {
    const { data: cacheReadData, error: cacheReadError } = await input.supabase
      .from("ai_cache")
      .select("response_json, created_at, model")
      .eq("owner_id", input.userId)
      .eq("purpose", "structure")
      .eq("input_hash", inputHash)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cacheReadError) {
      cacheAvailable = false;
      console.warn("Structure recipe cache read failed; continuing uncached:", cacheReadError.message);
    } else {
      cached = cacheReadData;
    }
  }

  if (cached) {
    const cachedStructured = parseStructuredRecipe(cached.response_json);
    if (!cachedStructured) {
      throw new Error("Cached structure is invalid.");
    }

    return createAiRecipeResult({
      purpose: "structure",
      source: "cache",
      model: cached.model,
      cached: true,
      inputHash,
      createdAt: cached.created_at,
      recipe: {
        title: cachedStructured.title,
        description: cachedStructured.description,
        tags: cachedStructured.tags,
        servings: cachedStructured.servings,
        prep_time_min: cachedStructured.prep_time_min,
        cook_time_min: cachedStructured.cook_time_min,
        difficulty: cachedStructured.difficulty,
        ingredients: cachedStructured.ingredients_json.map((item) => ({
          name: formatIngredientLine(item),
        })),
        steps: cachedStructured.steps_json.map((item) => ({ text: item.text })),
      },
    });
  }

  const prompt = `Convert the following recipe text into structured JSON.

Return ONLY valid JSON.

Do not include markdown.
Do not include explanations.
Do not wrap JSON in code fences.

The JSON format must be exactly:
{
  "title": string,
  "description": string,
  "ingredients": [
    {
      "name": string,
      "quantity": number,
      "unit": string|null,
      "prep": string|null
    }
  ],
  "steps": [{ "text": string }]
}

Rules:
- Every ingredient must include an explicit quantity.
- Good: 2 onions, 1.5 lb chicken, 2 tbsp olive oil.
- Bad: onion, olive oil, broth.
- If the source is vague, infer the most reasonable home-cook quantity instead of omitting it.

Recipe text:
${rawText}`;

  const taskSetting = await resolveAiTaskSettings("recipe_structure");
  if (!taskSetting.enabled) {
    throw new Error("Recipe structuring AI task is disabled.");
  }

  const aiResult = await callAIWithMeta(
    [
      {
        role: "system",
        content:
          "You convert recipe text into structured JSON. Return only valid JSON with no markdown or explanation.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    {
      max_tokens: taskSetting.maxTokens,
      temperature: taskSetting.temperature,
      model: taskSetting.primaryModel,
      fallback_models: taskSetting.fallbackModel ? [taskSetting.fallbackModel] : [],
    }
  );

  const parsed = parseJsonResponse(aiResult.text);
  const structured = parseStructuredRecipe(parsed);
  if (!structured) {
    throw new Error("AI response must include a quantity for every ingredient.");
  }

  if (cacheAvailable) {
    const { error: cacheWriteError } = await input.supabase.from("ai_cache").upsert(
      {
        owner_id: input.userId,
        purpose: "structure",
        input_hash: inputHash,
        model: aiResult.model ?? aiResult.provider,
        response_json: structured,
      },
      { onConflict: "owner_id,purpose,input_hash,model" }
    );

    if (cacheWriteError) {
      console.warn("Structure recipe cache write failed; returning uncached result:", cacheWriteError.message);
    }
  }

  return createAiRecipeResult({
    purpose: "structure",
    source: "ai",
    provider: aiResult.provider,
    model: aiResult.model ?? aiResult.provider,
    cached: false,
    inputHash,
    createdAt: new Date().toISOString(),
    recipe: {
      title: structured.title,
      description: structured.description,
      tags: structured.tags,
      servings: structured.servings,
      prep_time_min: structured.prep_time_min,
      cook_time_min: structured.cook_time_min,
      difficulty: structured.difficulty,
      ingredients: structured.ingredients_json.map((item) => ({ name: formatIngredientLine(item) })),
      steps: structured.steps_json.map((item) => ({ text: item.text })),
    },
  });
}
