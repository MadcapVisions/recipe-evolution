import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const parseStructuredRecipe = (value: unknown): StructuredRecipe | null => {
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
};

const extractJsonFromGeminiText = (responseText: string): { parsed: unknown } | { error: string } => {
  // 1) Direct parse attempt.
  try {
    return { parsed: JSON.parse(responseText) };
  } catch {
    // continue
  }

  // 2) Strip markdown code fences and try again.
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

  // 3) Parse between the first "{" and last "}".
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
};

const decodeJwtSub = (token: string | undefined): string | null => {
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payloadBase64 + "=".repeat((4 - (payloadBase64.length % 4)) % 4);
    const payloadText = atob(padded);
    const payload = JSON.parse(payloadText) as { sub?: unknown };
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
};

Deno.serve(async (request) => {
  const errorResponse = (status: number, message: string) =>
    new Response(JSON.stringify({ error: true, message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return errorResponse(405, "Method not allowed");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      return errorResponse(500, "Missing GEMINI_API_KEY secret");
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      return errorResponse(500, "Missing required environment variables.");
    }

    const authHeader = request.headers.get("Authorization") ?? request.headers.get("authorization");
    const accessToken = authHeader?.replace(/^Bearer\s+/i, "").trim();

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader ?? "",
        },
      },
    });

    const jwtUserId = decodeJwtSub(accessToken);
    const gatewayUserId =
      request.headers.get("x-supabase-auth-user") ??
      request.headers.get("x-jwt-claim-sub") ??
      request.headers.get("x-jwt-sub");
    const effectiveUserId = jwtUserId ?? gatewayUserId;
    const isUuid = typeof effectiveUserId === "string" && /^[0-9a-fA-F-]{36}$/.test(effectiveUserId);

    if (!isUuid) {
      console.error("User resolution failed:", {
        authHeaderPresent: Boolean(authHeader),
        jwtUserIdPresent: Boolean(jwtUserId),
        gatewayUserIdPresent: Boolean(gatewayUserId),
      });
      return errorResponse(401, "Unauthorized");
    }

    let body: { rawText?: string; preferredUnits?: PreferredUnits };

    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "Invalid JSON body.");
    }

    const rawText = body.rawText?.trim();
    const preferredUnits: PreferredUnits = body.preferredUnits === "imperial" ? "imperial" : "metric";

    if (!rawText) {
      return errorResponse(400, "rawText is required.");
    }

    const preferredModel = Deno.env.get("GEMINI_MODEL")?.trim() || "gemini-2.5-flash";
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
    const input_hash = await sha256(`${rawText}::${preferredUnits}`);
    let cacheAvailable = true;
    let cached: { response_json: unknown; created_at: string; model: string } | null = null;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount, error: rateLimitError } = await supabase
      .from("ai_cache")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", effectiveUserId)
      .eq("purpose", "structure")
      .gt("created_at", oneDayAgo);

    if (rateLimitError) {
      cacheAvailable = false;
      console.warn("Rate limit query failed; continuing without cache/rate-limit:", rateLimitError.message);
    }

    if (cacheAvailable && (recentCount ?? 0) >= 10) {
      const { error: limitEventError } = await supabase.from("product_events").insert({
        owner_id: effectiveUserId,
        event_name: "limit_hit",
        metadata_json: {
          limit: "ai_structure_per_day",
          max: 10,
        },
      });
      if (limitEventError) {
        console.warn("Could not log limit_hit event:", limitEventError.message);
      }
      return errorResponse(429, "Daily limit reached: up to 10 AI structure calls per day.");
    }

    if (cacheAvailable) {
      const { data: cacheReadData, error: cacheReadError } = await supabase
        .from("ai_cache")
        .select("response_json, created_at, model")
        .eq("owner_id", effectiveUserId)
        .eq("purpose", "structure")
        .eq("input_hash", input_hash)
        .in("model", modelCandidates)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cacheReadError) {
        cacheAvailable = false;
        console.warn("Cache read failed; continuing without cache:", cacheReadError.message);
      } else {
        cached = cacheReadData;
      }
    }

    if (cached) {
      const cachedStructured = parseStructuredRecipe(cached.response_json);
      if (!cachedStructured) {
        return errorResponse(500, "Cached structure is invalid.");
      }

      return new Response(
        JSON.stringify({
          title: cachedStructured.title,
          description: cachedStructured.description ?? "",
          ingredients: cachedStructured.ingredients_json.map((item) => ({ name: item.name })),
          steps: cachedStructured.steps_json.map((item) => ({ text: item.text })),
          data: cachedStructured,
          meta: {
            purpose: "structure",
            model: cached.model,
            cached: true,
            input_hash,
            created_at: cached.created_at,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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
      const response = await fetch(
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
        }
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

      console.error("Gemini request failed:", lastGeminiError);

      if (response.status !== 404) {
        break;
      }
    }

    if (!aiResponse || !resolvedModel) {
      const suffix = lastGeminiError
        ? ` (${lastGeminiError.status} ${lastGeminiError.statusText}) model=${lastGeminiError.model}`
        : "";
      return errorResponse(500, `Gemini request failed${suffix}.`);
    }

    const aiJson = await aiResponse.json();
    const content = aiJson?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof content !== "string") {
      return errorResponse(500, "Invalid AI response format.");
    }

    const extracted = extractJsonFromGeminiText(content);
    if ("error" in extracted) {
      console.error("Gemini JSON parsing failed. Raw text:", content);
      return errorResponse(500, extracted.error);
    }
    const parsed = extracted.parsed;

    const structured = parseStructuredRecipe(parsed);
    if (!structured) {
      return errorResponse(500, "AI response missing required fields.");
    }

    const cachePayload = {
      owner_id: effectiveUserId,
      purpose: "structure",
      input_hash,
      model: resolvedModel,
      response_json: structured,
    };

    if (cacheAvailable) {
      const { error: cacheWriteError } = await supabase
        .from("ai_cache")
        .upsert(cachePayload, { onConflict: "owner_id,purpose,input_hash,model" });

      if (cacheWriteError) {
        console.warn("Cache write failed; returning uncached result:", cacheWriteError.message);
      }
    }

    return new Response(
      JSON.stringify({
        title: structured.title,
        description: structured.description ?? "",
        ingredients: structured.ingredients_json.map((item) => ({ name: item.name })),
        steps: structured.steps_json.map((item) => ({ text: item.text })),
        data: structured,
        meta: {
          purpose: "structure",
          model: resolvedModel,
          cached: false,
          input_hash,
          created_at: new Date().toISOString(),
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unhandled ai-structure-recipe error:", error);
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return errorResponse(500, message);
  }
});
