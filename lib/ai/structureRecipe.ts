import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type PreferredUnits = "metric" | "imperial";

type StructuredIngredient = {
  name: string;
  quantity: number | null;
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

type StructuredRecipeMeta = {
  purpose: "structure";
  model: string;
  cached: boolean;
  input_hash: string;
  created_at: string;
};

type StructuredRecipeResult = {
  title: string;
  description: string;
  ingredients: Array<{ name: string }>;
  steps: Array<{ text: string }>;
  data: StructuredRecipe;
  meta: StructuredRecipeMeta;
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
      return {
        name: ingredient.name.trim(),
        quantity: typeof ingredient.quantity === "number" ? ingredient.quantity : null,
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

function extractJsonFromGeminiText(responseText: string): { parsed: unknown } | { error: string } {
  try {
    return { parsed: JSON.parse(responseText) };
  } catch {
    // continue
  }

  const noFences = responseText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return { parsed: JSON.parse(noFences) };
  } catch {
    // continue
  }

  const firstBrace = noFences.indexOf("{");
  const lastBrace = noFences.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = noFences.slice(firstBrace, lastBrace + 1);
    try {
      return { parsed: JSON.parse(candidate) };
    } catch {
      // continue
    }
  }

  return { error: `Gemini returned invalid JSON. Raw response: ${responseText}` };
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function structureRecipeFromRawText(input: {
  supabase: SupabaseClient;
  userId: string;
  rawText: string;
  preferredUnits?: PreferredUnits;
}): Promise<StructuredRecipeResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const rawText = input.rawText.trim();
  if (!rawText) {
    throw new Error("rawText is required.");
  }

  const preferredUnits: PreferredUnits = input.preferredUnits === "imperial" ? "imperial" : "metric";
  const preferredModel = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const modelCandidates = Array.from(
    new Set(
      [
        preferredModel,
        "gemini-2.5-flash",
        "gemini-2.5-flash-latest",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash",
      ].filter((value) => value.length > 0)
    )
  );

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
      .in("model", modelCandidates)
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

    return {
      title: cachedStructured.title,
      description: cachedStructured.description ?? "",
      ingredients: cachedStructured.ingredients_json.map((item) => ({ name: item.name })),
      steps: cachedStructured.steps_json.map((item) => ({ text: item.text })),
      data: cachedStructured,
      meta: {
        purpose: "structure",
        model: cached.model,
        cached: true,
        input_hash: inputHash,
        created_at: cached.created_at,
      },
    };
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
  "ingredients": [{ "name": string }],
  "steps": [{ "text": string }]
}

Recipe text:
${rawText}`;

  let aiResponse: Response | null = null;
  let resolvedModel: string | null = null;
  let lastGeminiError: { status: number; statusText: string; body: string; model: string } | null = null;

  for (const candidateModel of modelCandidates) {
    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${candidateModel}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
          },
        }),
      },
      20_000
    );

    if (response.ok) {
      aiResponse = response;
      resolvedModel = candidateModel;
      break;
    }

    const errorText = await response.text();
    lastGeminiError = {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
      model: candidateModel,
    };

    console.error("Structure recipe Gemini request failed:", lastGeminiError);

    if (response.status !== 404) {
      break;
    }
  }

  if (!aiResponse || !resolvedModel) {
    const suffix = lastGeminiError
      ? ` (${lastGeminiError.status} ${lastGeminiError.statusText}) model=${lastGeminiError.model}`
      : "";
    throw new Error(`Gemini request failed${suffix}.`);
  }

  const aiJson = (await aiResponse.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = aiJson?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof content !== "string") {
    throw new Error("Invalid AI response format.");
  }

  const extracted = extractJsonFromGeminiText(content);
  if ("error" in extracted) {
    console.error("Structure recipe JSON parse failed. Raw text:", content);
    throw new Error(extracted.error);
  }

  const structured = parseStructuredRecipe(extracted.parsed);
  if (!structured) {
    throw new Error("AI response missing required fields.");
  }

  if (cacheAvailable) {
    const { error: cacheWriteError } = await input.supabase.from("ai_cache").upsert(
      {
        owner_id: input.userId,
        purpose: "structure",
        input_hash: inputHash,
        model: resolvedModel,
        response_json: structured,
      },
      { onConflict: "owner_id,purpose,input_hash,model" }
    );

    if (cacheWriteError) {
      console.warn("Structure recipe cache write failed; returning uncached result:", cacheWriteError.message);
    }
  }

  return {
    title: structured.title,
    description: structured.description ?? "",
    ingredients: structured.ingredients_json.map((item) => ({ name: item.name })),
    steps: structured.steps_json.map((item) => ({ text: item.text })),
    data: structured,
    meta: {
      purpose: "structure",
      model: resolvedModel,
      cached: false,
      input_hash: inputHash,
      created_at: new Date().toISOString(),
    },
  };
}
