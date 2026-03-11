import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SimpleIngredient = {
  name: string;
};

type SimpleStep = {
  text: string;
};

type ImproveRequest = {
  recipe?: {
    title?: string;
    servings?: number;
    prep_time_min?: number;
    cook_time_min?: number;
    difficulty?: "Easy" | "Medium" | "Hard";
    ingredients?: SimpleIngredient[];
    steps?: SimpleStep[];
  };
  instruction?: string;
};

type ImproveResponse = {
  title: string;
  servings: number;
  prep_time_min: number;
  cook_time_min: number;
  difficulty: "Easy" | "Medium" | "Hard";
  ingredients: SimpleIngredient[];
  steps: SimpleStep[];
  explanation: string;
};

const parseImprovedRecipe = (value: unknown): ImproveResponse | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const raw = value as Record<string, unknown>;

  if (typeof raw.title !== "string") {
    return null;
  }

  if (!Array.isArray(raw.ingredients) || !Array.isArray(raw.steps)) {
    return null;
  }

  const ingredients = raw.ingredients
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }
      const name = (item as Record<string, unknown>).name;
      if (typeof name !== "string" || name.trim().length === 0) {
        return null;
      }
      return { name: name.trim() };
    })
    .filter((item): item is SimpleIngredient => item !== null);

  const steps = raw.steps
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }
      const text = (item as Record<string, unknown>).text;
      if (typeof text !== "string" || text.trim().length === 0) {
        return null;
      }
      return { text: text.trim() };
    })
    .filter((item): item is SimpleStep => item !== null);

  if (ingredients.length === 0 || steps.length === 0) {
    return null;
  }

  const explanation =
    typeof raw.explanation === "string" && raw.explanation.trim().length > 0
      ? raw.explanation.trim()
      : "Recipe adjusted based on the instruction.";

  const servings = typeof raw.servings === "number" && raw.servings > 0 ? Math.round(raw.servings) : 4;
  const prep_time_min =
    typeof raw.prep_time_min === "number" && raw.prep_time_min >= 0 ? Math.round(raw.prep_time_min) : 15;
  const cook_time_min =
    typeof raw.cook_time_min === "number" && raw.cook_time_min >= 0 ? Math.round(raw.cook_time_min) : 20;
  const difficulty =
    raw.difficulty === "Easy" || raw.difficulty === "Medium" || raw.difficulty === "Hard"
      ? raw.difficulty
      : prep_time_min + cook_time_min < 30
        ? "Easy"
        : prep_time_min + cook_time_min <= 60
          ? "Medium"
          : "Hard";

  return {
    title: raw.title.trim(),
    servings,
    prep_time_min,
    cook_time_min,
    difficulty,
    ingredients,
    steps,
    explanation,
  };
};

const extractJson = (responseText: string): { parsed: unknown } | { error: string } => {
  try {
    return { parsed: JSON.parse(responseText) };
  } catch {
    // continue
  }

  const withoutFences = responseText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return { parsed: JSON.parse(withoutFences) };
  } catch {
    // continue
  }

  const firstBrace = withoutFences.indexOf("{");
  const lastBrace = withoutFences.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = withoutFences.slice(firstBrace, lastBrace + 1);
    try {
      return { parsed: JSON.parse(candidate) };
    } catch {
      // continue
    }
  }

  return { error: `Gemini returned invalid JSON. Raw response: ${responseText}` };
};

Deno.serve(async (request) => {
  const jsonResponse = (status: number, payload: unknown) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return jsonResponse(405, { error: true, message: "Method not allowed" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse(500, { error: true, message: "Missing required environment variables." });
    }

    if (!apiKey) {
      return jsonResponse(500, { error: true, message: "Missing GEMINI_API_KEY secret" });
    }

    const authHeader = request.headers.get("Authorization") ?? request.headers.get("authorization");
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader ?? "",
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse(401, { error: true, message: "Unauthorized" });
    }

    let body: ImproveRequest;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { error: true, message: "Invalid JSON body." });
    }

    const recipeTitle = body.recipe?.title?.trim();
    const recipeServings = body.recipe?.servings;
    const recipePrepTime = body.recipe?.prep_time_min;
    const recipeCookTime = body.recipe?.cook_time_min;
    const recipeDifficulty = body.recipe?.difficulty;
    const ingredients = body.recipe?.ingredients ?? [];
    const steps = body.recipe?.steps ?? [];
    const instruction = body.instruction?.trim();

    if (!recipeTitle || !instruction || !Array.isArray(ingredients) || !Array.isArray(steps)) {
      return jsonResponse(400, { error: true, message: "recipe and instruction are required." });
    }

    const model = Deno.env.get("GEMINI_MODEL")?.trim() || "gemini-2.5-flash";

    const prompt = `You are a professional chef and recipe developer.

Your job is to MODIFY the recipe according to the instruction.

You MUST change the recipe.

Rules:

If the instruction is "Make Vegetarian":
- Remove meat and animal-based ingredients
- Replace them with vegetarian substitutes
- Adjust steps accordingly

If the instruction is "Reduce Calories":
- Reduce fats, oils, and sugars
- Adjust cooking methods if necessary

If the instruction is "Improve Flavor":
- Add spices, aromatics, or cooking techniques

If the instruction is "Make Faster":
- Simplify steps
- Reduce cook time

Return ONLY valid JSON.

Format:

{
  "title": string,
  "explanation": string,
  "servings": number,
  "prep_time_min": number,
  "cook_time_min": number,
  "difficulty": "Easy" | "Medium" | "Hard",
  "ingredients": [{ "name": string }],
  "steps": [{ "text": string }]
}

The explanation must describe the changes made.
Estimate realistic values for servings, prep_time_min, cook_time_min, and difficulty if not provided.

Difficulty rules:
- Easy = simple mixing or <30 minutes
- Medium = moderate cooking techniques
- Hard = complex or multi-step recipes

You must change at least TWO ingredients or steps.

Recipe:
${JSON.stringify(
  {
    title: recipeTitle,
    servings: typeof recipeServings === "number" ? recipeServings : null,
    prep_time_min: typeof recipePrepTime === "number" ? recipePrepTime : null,
    cook_time_min: typeof recipeCookTime === "number" ? recipeCookTime : null,
    difficulty: recipeDifficulty ?? null,
    ingredients,
    steps,
  },
  null,
  2
)}

Instruction:
${instruction}`;

    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Gemini improve request failed:", {
        status: aiResponse.status,
        statusText: aiResponse.statusText,
        body: errorText,
      });
      return jsonResponse(500, { error: true, message: `Gemini request failed (${aiResponse.status} ${aiResponse.statusText}).` });
    }

    const aiJson = await aiResponse.json();
    const content = aiJson?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof content !== "string") {
      return jsonResponse(500, { error: true, message: "Invalid AI response format." });
    }

    const extracted = extractJson(content);
    if ("error" in extracted) {
      console.error("Gemini improve JSON parsing failed. Raw text:", content);
      return jsonResponse(500, { error: true, message: extracted.error });
    }

    const improved = parseImprovedRecipe(extracted.parsed);
    if (!improved) {
      return jsonResponse(500, { error: true, message: "AI response missing required fields." });
    }

    return jsonResponse(200, {
      recipe: improved,
      model,
    });
  } catch (error) {
    console.error("Unhandled ai-improve-recipe error:", error);
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return jsonResponse(500, { error: true, message });
  }
});
