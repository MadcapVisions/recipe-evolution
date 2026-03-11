import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PreferredUnits = "metric" | "imperial";

type RefinedRecipe = {
  servings: number | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  difficulty: string | null;
  ingredients_json: Array<Record<string, unknown>>;
  steps_json: Array<Record<string, unknown>>;
  change_log: string | null;
};

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const parseRefined = (value: unknown): RefinedRecipe | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const raw = value as Record<string, unknown>;

  if (!Array.isArray(raw.ingredients_json) || !Array.isArray(raw.steps_json)) {
    return null;
  }

  const ingredients_json = raw.ingredients_json.filter(
    (item): item is Record<string, unknown> => typeof item === "object" && item !== null
  );
  const steps_json = raw.steps_json.filter(
    (item): item is Record<string, unknown> => typeof item === "object" && item !== null
  );

  if (ingredients_json.length === 0 || steps_json.length === 0) {
    return null;
  }

  return {
    servings: typeof raw.servings === "number" ? raw.servings : null,
    prep_time_min: typeof raw.prep_time_min === "number" ? raw.prep_time_min : null,
    cook_time_min: typeof raw.cook_time_min === "number" ? raw.cook_time_min : null,
    difficulty: typeof raw.difficulty === "string" ? raw.difficulty : null,
    ingredients_json,
    steps_json,
    change_log: typeof raw.change_log === "string" ? raw.change_log : null,
  };
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !openAiApiKey) {
    return new Response(JSON.stringify({ error: "Missing required environment variables." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return new Response(JSON.stringify({ error: "Missing Authorization header." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: {
    recipeId?: string;
    baseVersionId?: string;
    instruction?: string;
    preferredUnits?: PreferredUnits;
  };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const recipeId = body.recipeId?.trim();
  const baseVersionId = body.baseVersionId?.trim();
  const instruction = body.instruction?.trim();
  const preferredUnits: PreferredUnits = body.preferredUnits === "imperial" ? "imperial" : "metric";

  if (!recipeId || !baseVersionId || !instruction) {
    return new Response(JSON.stringify({ error: "recipeId, baseVersionId, and instruction are required." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("id")
    .eq("id", recipeId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (recipeError || !recipe) {
    return new Response(JSON.stringify({ error: "Recipe not found or not owned by user." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: baseVersion, error: versionError } = await supabase
    .from("recipe_versions")
    .select("id, servings, prep_time_min, cook_time_min, difficulty, ingredients_json, steps_json")
    .eq("id", baseVersionId)
    .eq("recipe_id", recipeId)
    .maybeSingle();

  if (versionError || !baseVersion) {
    return new Response(JSON.stringify({ error: "Base version not found." }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const model = Deno.env.get("OPENAI_MODEL_REFINE") ?? Deno.env.get("OPENAI_MODEL_STRUCTURE") ?? "gpt-4.1-mini";

  const input_hash = await sha256(
    `${JSON.stringify(baseVersion.ingredients_json)}::${JSON.stringify(baseVersion.steps_json)}::${instruction}::${preferredUnits}`
  );

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentCount, error: rateLimitError } = await supabase
    .from("ai_cache")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .eq("purpose", "refine")
    .gt("created_at", oneDayAgo);

  if (rateLimitError) {
    return new Response(JSON.stringify({ error: rateLimitError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if ((recentCount ?? 0) >= 5) {
    await supabase.from("product_events").insert({
      owner_id: user.id,
      event_name: "limit_hit",
      metadata_json: {
        limit: "ai_refine_per_day",
        max: 5,
      },
    });

    return new Response(JSON.stringify({ error: "Daily limit reached: up to 5 AI refinements per day." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: cached, error: cacheReadError } = await supabase
    .from("ai_cache")
    .select("response_json, created_at")
    .eq("owner_id", user.id)
    .eq("purpose", "refine")
    .eq("input_hash", input_hash)
    .eq("model", model)
    .maybeSingle();

  if (cacheReadError) {
    return new Response(JSON.stringify({ error: cacheReadError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (cached) {
    return new Response(
      JSON.stringify({
        data: cached.response_json,
        meta: {
          purpose: "refine",
          model,
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

  const systemPrompt =
    "You refine recipe JSON under strict safety rules. Return ONLY valid JSON object. No markdown, no prose. Never remove critical food safety steps (for example safe chicken temperature). If instruction conflicts with feasibility, do best effort and explain in change_log.";

  const userPrompt = `Preferred units: ${preferredUnits}.\nInstruction: ${instruction}\n\nBase recipe version:\n${JSON.stringify(
    {
      servings: baseVersion.servings,
      prep_time_min: baseVersion.prep_time_min,
      cook_time_min: baseVersion.cook_time_min,
      difficulty: baseVersion.difficulty,
      ingredients_json: baseVersion.ingredients_json,
      steps_json: baseVersion.steps_json,
    },
    null,
    2
  )}\n\nReturn this schema:\n{\n  "servings": number|null,\n  "prep_time_min": number|null,\n  "cook_time_min": number|null,\n  "difficulty": string|null,\n  "ingredients_json": [{"name": string, "quantity": number|null, "unit": string|null, "prep": string|null, "optional": boolean, "group": string|null}],\n  "steps_json": [{"text": string, "timer_seconds": number|null, "temperature_c": number|null, "temperature_f": number|null, "equipment": string[]|null}],\n  "change_log": string|null\n}`;

  const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text();
    return new Response(JSON.stringify({ error: errorText }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const aiJson = await aiResponse.json();
  const content = aiJson?.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    return new Response(JSON.stringify({ error: "Invalid AI response format." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return new Response(JSON.stringify({ error: "AI did not return valid JSON." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const refined = parseRefined(parsed);
  if (!refined) {
    return new Response(JSON.stringify({ error: "AI response missing required fields." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: cacheWriteError } = await supabase.from("ai_cache").upsert(
    {
      owner_id: user.id,
      purpose: "refine",
      input_hash,
      model,
      response_json: refined,
    },
    { onConflict: "owner_id,purpose,input_hash,model" }
  );

  if (cacheWriteError) {
    return new Response(JSON.stringify({ error: cacheWriteError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      data: refined,
      meta: {
        purpose: "refine",
        model,
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
});
