import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Mode = "mood_recipe" | "mood_ideas" | "ingredients_ideas" | "filtered_ideas" | "idea_recipe" | "chef_chat";

type RequestBody = {
  mode?: Mode;
  prompt?: string;
  ingredients?: string[];
  exclude_titles?: string[];
  batch_index?: number;
  filters?: {
    cuisine?: string;
    protein?: string;
    mealType?: string;
    cookingTime?: string;
  };
  ideaTitle?: string;
};

type ChefChatReply = {
  reply: string;
};

type IdeaOption = {
  title: string;
  description: string;
  cook_time_min: number | null;
};

const STOP_WORDS = new Set([
  "i",
  "a",
  "an",
  "the",
  "and",
  "or",
  "with",
  "without",
  "for",
  "to",
  "of",
  "in",
  "on",
  "at",
  "my",
  "want",
  "something",
  "dish",
  "meal",
  "make",
  "using",
  "from",
  "that",
  "this",
  "it",
  "is",
  "are",
  "be",
  "have",
  "like",
  "use",
  "chef",
  "conversation",
  "generate",
  "ideas",
  "recipe",
  "recipes",
  "apply",
  "suggestions",
  "suggestion",
  "about",
  "anything",
]);

const toTitleCase = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const extractSeedLabel = (body: RequestBody): string => {
  const ingredientSeed = (body.ingredients ?? [])
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 3)
    .join(" ");
  if (ingredientSeed) {
    return toTitleCase(ingredientSeed.replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim());
  }

  const prompt = (body.prompt ?? body.ideaTitle ?? "").toLowerCase();
  const tokens = prompt
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
    .slice(0, 3);

  if (tokens.length === 0) {
    return "Chef Special";
  }

  return toTitleCase(tokens.join(" "));
};

const normalizeIdea = (value: unknown): IdeaOption | null => {
  if (typeof value === "string") {
    const title = value.trim();
    if (!title) {
      return null;
    }
    return {
      title,
      description: "AI-generated recipe idea.",
      cook_time_min: 30,
    };
  }

  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "";
  if (!title) {
    return null;
  }

  return {
    title,
    description:
      typeof record.description === "string" && record.description.trim().length > 0
        ? record.description.trim()
        : "AI-generated recipe idea.",
    cook_time_min: typeof record.cook_time_min === "number" ? Math.round(record.cook_time_min) : 30,
  };
};

const ensureIdeaCount = (
  ideas: IdeaOption[],
  desiredCount: number,
  contextLabel: string,
  excludedTitles: string[] = []
): IdeaOption[] => {
  const unique = new Map<string, IdeaOption>();
  const excluded = new Set(excludedTitles.map((title) => title.toLowerCase()));
  for (const idea of ideas) {
    const key = idea.title.toLowerCase();
    if (!unique.has(key) && !excluded.has(key)) {
      unique.set(key, idea);
    }
  }

  const fallbackPool: IdeaOption[] = [
    {
      title: `${contextLabel} Bowl`,
      description: "Balanced one-bowl meal with bold flavor and easy prep.",
      cook_time_min: 25,
    },
    {
      title: `${contextLabel} Skillet`,
      description: "One-pan recipe with quick sear and savory finish.",
      cook_time_min: 30,
    },
    {
      title: `${contextLabel} Stir-Fry`,
      description: "Fast wok-style recipe with fresh aromatics.",
      cook_time_min: 20,
    },
    {
      title: `${contextLabel} Pasta`,
      description: "Comforting sauce-forward meal with simple pantry ingredients.",
      cook_time_min: 28,
    },
    {
      title: `${contextLabel} Soup`,
      description: "Warm and hearty option with layered flavor.",
      cook_time_min: 35,
    },
    {
      title: `${contextLabel} Tacos`,
      description: "Flexible, weeknight-friendly recipe with bright toppings.",
      cook_time_min: 22,
    },
    {
      title: `${contextLabel} Rice Plate`,
      description: "Simple rice-based meal with protein and vegetables.",
      cook_time_min: 32,
    },
    {
      title: `${contextLabel} Wrap`,
      description: "Portable and quick recipe with crisp texture and sauce.",
      cook_time_min: 18,
    },
  ];

  for (const fallback of fallbackPool) {
    if (unique.size >= desiredCount) {
      break;
    }
    const key = fallback.title.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, fallback);
    }
  }

  return Array.from(unique.values()).slice(0, desiredCount);
};

type GeneratedRecipe = {
  title: string;
  description: string | null;
  servings: number | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  difficulty: string | null;
  ingredients: Array<{ name: string }>;
  steps: Array<{ text: string }>;
};

const buildFallbackRecipe = (body: RequestBody): GeneratedRecipe => {
  const titleBase =
    body.ideaTitle?.trim() || body.prompt?.trim().slice(0, 48) || body.ingredients?.join(" ").slice(0, 48) || "Chef's Recipe";
  const cleanTitle = titleBase.replace(/\s+/g, " ").trim();
  const ingredientSeed = (body.ingredients ?? [])
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 6);

  const fallbackIngredients =
    ingredientSeed.length > 0
      ? ingredientSeed.map((item) => ({ name: item }))
      : [
          { name: "1 tbsp olive oil" },
          { name: "2 cloves garlic, minced" },
          { name: "1 onion, diced" },
          { name: "2 cups main ingredient of choice" },
          { name: "Salt and black pepper to taste" },
          { name: "Fresh herbs or citrus for finish" },
        ];

  return {
    title: cleanTitle,
    description: "A quick AI-generated fallback recipe while the full model response is unavailable.",
    servings: 4,
    prep_time_min: 15,
    cook_time_min: 25,
    difficulty: "Easy",
    ingredients: fallbackIngredients,
    steps: [
      { text: "Prep all ingredients and season to taste." },
      { text: "Heat oil in a pan over medium heat, then sauté aromatics until fragrant." },
      { text: "Add main ingredients, cook until tender, and adjust seasoning." },
      { text: "Finish with herbs or citrus and serve warm." },
    ],
  };
};

const buildFallbackIdeas = (body: RequestBody, count = 6): IdeaOption[] => {
  const seed = extractSeedLabel(body).slice(0, 40);
  const excluded = new Set((body.exclude_titles ?? []).map((title) => title.toLowerCase()));
  const batch = Math.max(body.batch_index ?? 1, 1);

  const styles = [
    "Smoky",
    "Zesty",
    "Herby",
    "Garlic-Butter",
    "Crispy",
    "Creamy",
    "Spicy",
    "Roasted",
    "Caramelized",
    "Tangy",
    "Fiery",
    "Savory",
  ];
  const formats = ["Skillet", "Rice Bowl", "Stir-Fry", "Pasta", "Soup", "Tacos", "Sheet-Pan Bake", "Wrap", "Casserole", "Noodles"];
  const descriptions = [
    "This dish builds bold flavor from layered aromatics and a balanced sauce. Expect a satisfying texture with a warm, savory finish that feels restaurant-worthy but weeknight practical.",
    "A comforting, flavor-forward recipe with bright notes and rich depth. Each bite combines tenderness, gentle spice, and a clean finish that keeps it from feeling heavy.",
    "This option leans into hearty, cozy flavors with a polished texture. It starts aromatic and finishes with a vivid pop from herbs or citrus for extra freshness.",
    "A high-impact recipe that balances richness with freshness. The flavor profile is savory first, then gently spicy, with enough complexity to feel intentional.",
    "This version focuses on deep roasted notes and silky texture. It tastes bold and comforting while staying approachable with straightforward prep.",
    "A vibrant recipe with layered seasoning and lively aromatics. It delivers comforting depth plus a bright finish that makes every bite feel complete.",
  ];
  const times = [18, 20, 22, 24, 26, 28, 30, 32, 35];

  const out: IdeaOption[] = [];
  let cursor = (batch - 1) * 7;
  while (out.length < count && cursor < 200) {
    const style = styles[cursor % styles.length];
    const format = formats[cursor % formats.length];
    const title = `${style} ${seed} ${format}`.replace(/\s+/g, " ").trim();
    const key = title.toLowerCase();
    if (!excluded.has(key) && !out.some((item) => item.title.toLowerCase() === key)) {
      out.push({
        title,
        description: descriptions[cursor % descriptions.length],
        cook_time_min: times[cursor % times.length],
      });
    }
    cursor += 1;
  }

  return out.slice(0, count);
};

const parseRecipe = (value: unknown): GeneratedRecipe | null => {
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
      return typeof name === "string" && name.trim().length > 0 ? { name: name.trim() } : null;
    })
    .filter((item): item is { name: string } => item !== null);

  const steps = raw.steps
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }
      const text = (item as Record<string, unknown>).text;
      return typeof text === "string" && text.trim().length > 0 ? { text: text.trim() } : null;
    })
    .filter((item): item is { text: string } => item !== null);

  if (ingredients.length === 0 || steps.length === 0) {
    return null;
  }

  return {
    title: raw.title.trim(),
    description: typeof raw.description === "string" ? raw.description : null,
    servings: typeof raw.servings === "number" ? Math.round(raw.servings) : null,
    prep_time_min: typeof raw.prep_time_min === "number" ? Math.round(raw.prep_time_min) : null,
    cook_time_min: typeof raw.cook_time_min === "number" ? Math.round(raw.cook_time_min) : null,
    difficulty: typeof raw.difficulty === "string" ? raw.difficulty : null,
    ingredients,
    steps,
  };
};

const parseIdeas = (value: unknown): IdeaOption[] => {
  if (typeof value !== "object" || value === null) {
    return [];
  }
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.ideas)) {
    return [];
  }
  return raw.ideas
    .map((item) => normalizeIdea(item))
    .filter((item): item is IdeaOption => item !== null);
};

const parseChefReply = (value: unknown): ChefChatReply | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const reply = typeof raw.reply === "string" ? raw.reply.trim() : "";
  if (!reply) {
    return null;
  }
  return { reply };
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

const getPrompt = (body: RequestBody): string => {
  if (body.mode === "mood_recipe") {
    return `You are a professional recipe developer.
Generate a full recipe from this user craving prompt:
"${body.prompt}"

Return ONLY valid JSON:
{
  "title": string,
  "description": string|null,
  "servings": number|null,
  "prep_time_min": number|null,
  "cook_time_min": number|null,
  "difficulty": string|null,
  "ingredients": [{ "name": string }],
  "steps": [{ "text": string }]
}`;
  }

  if (body.mode === "mood_ideas") {
    return `User craving prompt: ${body.prompt ?? ""}
Already shown idea titles (must NOT repeat any): ${JSON.stringify(body.exclude_titles ?? [])}
Current batch index: ${body.batch_index ?? 1}
Generate exactly 6 recipe ideas.
Rules:
- All titles must be unique and appealing.
- Title must be 3-7 words, natural, and never copy the full user prompt.
- Do not reuse or slightly tweak any already shown title.
- Vary cooking style across the 6 ideas (for example: skillet, soup, tacos, noodles, roast, bowl).
- Each description must be 2-3 full sentences explaining flavor profile, texture, and overall style.
Return ONLY valid JSON:
{
  "ideas": [
    {
      "title": string,
      "description": string,
      "cook_time_min": number
    },
    { "title": string, "description": string, "cook_time_min": number },
    { "title": string, "description": string, "cook_time_min": number },
    { "title": string, "description": string, "cook_time_min": number },
    { "title": string, "description": string, "cook_time_min": number },
    { "title": string, "description": string, "cook_time_min": number }
  ]
}`;
  }

  if (body.mode === "ingredients_ideas") {
    return `User ingredients: ${JSON.stringify(body.ingredients ?? [])}
Already shown idea titles (must NOT repeat any): ${JSON.stringify(body.exclude_titles ?? [])}
Current batch index: ${body.batch_index ?? 1}
Generate exactly 6 recipe ideas the user can cook with these ingredients.
Rules:
- All titles must be unique and appealing.
- Title must be 3-7 words, natural, and never copy the full user prompt.
- Do not reuse or slightly tweak any already shown title.
- Vary cooking style across the 6 ideas (for example: skillet, soup, tacos, noodles, roast, bowl).
- Each description must be 2-3 full sentences explaining flavor profile, texture, and overall style.
Return ONLY valid JSON:
{
  "ideas": [
    {
      "title": string,
      "description": string,
      "cook_time_min": number
    },
    { "title": string, "description": string, "cook_time_min": number },
    { "title": string, "description": string, "cook_time_min": number },
    { "title": string, "description": string, "cook_time_min": number },
    { "title": string, "description": string, "cook_time_min": number },
    { "title": string, "description": string, "cook_time_min": number }
  ]
}`;
  }

  if (body.mode === "filtered_ideas") {
    return `Generate exactly 5 recipe ideas from filters:
${JSON.stringify(body.filters ?? {}, null, 2)}
Return ONLY valid JSON:
{
  "ideas": [string, string, string, string, string]
}`;
  }

  if (body.mode === "chef_chat") {
    return `You are a friendly professional chef having a natural conversation with a home cook.
Reply conversationally to the user's question with concrete recommendations.
Do NOT list recipe options yet.
Do NOT be generic.
Include:
1) Whether the concept will taste good and why
2) 2-4 specific ingredient recommendations for optimal flavor/texture
3) 1-2 cooking technique tips
4) One optional upgrade (sauce, garnish, acid, or spice)
Keep it practical and concise (5-8 sentences).

User message:
${body.prompt ?? ""}

Return ONLY valid JSON:
{
  "reply": string
}`;
  }

  return `Generate a full recipe for this selected idea:
Idea: ${body.ideaTitle ?? ""}
Prompt context: ${body.prompt ?? ""}
Ingredients context: ${JSON.stringify(body.ingredients ?? [])}
Filter context: ${JSON.stringify(body.filters ?? {})}

Return ONLY valid JSON:
{
  "title": string,
  "description": string|null,
  "servings": number|null,
  "prep_time_min": number|null,
  "cook_time_min": number|null,
  "difficulty": string|null,
  "ingredients": [{ "name": string }],
  "steps": [{ "text": string }]
}`;
};

Deno.serve(async (request) => {
  const response = (status: number, payload: unknown) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return response(405, { error: true, message: "Method not allowed" });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!apiKey) {
      return response(500, { error: true, message: "Missing GEMINI_API_KEY secret" });
    }
    if (!supabaseUrl || !supabaseAnonKey) {
      return response(500, { error: true, message: "Missing Supabase env variables" });
    }

    const authHeader = request.headers.get("Authorization") ?? request.headers.get("authorization");
    const accessToken = authHeader?.replace(/^Bearer\s+/i, "").trim();
    const jwtUserId = decodeJwtSub(accessToken);
    if (!jwtUserId) {
      return response(401, { error: true, message: "Unauthorized" });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader ?? "" } },
    });
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return response(401, { error: true, message: "Unauthorized" });
    }

    const body = (await request.json()) as RequestBody;
    if (!body.mode) {
      return response(400, { error: true, message: "mode is required" });
    }

    const prompt = getPrompt(body);
    const model = Deno.env.get("GEMINI_MODEL")?.trim() || "gemini-2.5-flash";

    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Gemini request failed:", {
        status: aiResponse.status,
        statusText: aiResponse.statusText,
        body: errorText,
      });
      if (body.mode === "mood_ideas" || body.mode === "ingredients_ideas" || body.mode === "filtered_ideas") {
        return response(200, { ideas: buildFallbackIdeas(body, 6), fallback: true });
      }
      if (body.mode === "idea_recipe") {
        return response(200, { recipe: buildFallbackRecipe(body), fallback: true });
      }
      if (body.mode === "chef_chat") {
        return response(200, {
          reply:
            "That will taste great if you balance richness with acidity. Add a quick pickled red onion or a squeeze of lemon to cut through the gorgonzola, and season the chicken with garlic powder, paprika, salt, and black pepper before coating. Use cornstarch plus panko for extra crunch, and rest the fried cutlet on a rack so it stays crisp. A light mayo-mustard spread with a touch of honey is an easy flavor upgrade. If you want more depth, add a few drops of hot sauce or chili flakes to the spread.",
          fallback: true,
        });
      }
      return response(500, { error: true, message: "AI generation failed." });
    }

    const aiJson = await aiResponse.json();
    const content = aiJson?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof content !== "string") {
      if (body.mode === "mood_ideas" || body.mode === "ingredients_ideas" || body.mode === "filtered_ideas") {
        return response(200, { ideas: buildFallbackIdeas(body, 6), fallback: true });
      }
      if (body.mode === "idea_recipe") {
        return response(200, { recipe: buildFallbackRecipe(body), fallback: true });
      }
      if (body.mode === "chef_chat") {
        return response(200, {
          reply:
            "You’re on a strong path. For better flavor, balance salty cheese with brightness and crunch: add lemon or vinegar, keep onion crisp, and season the chicken aggressively before breading. For texture, use a dry-wet-dry station and press panko firmly so it adheres. Finish with a small herb element like parsley or chives for freshness.",
          fallback: true,
        });
      }
      return response(500, { error: true, message: "AI returned empty content." });
    }

    const extracted = extractJson(content);
    if ("error" in extracted) {
      console.error("Gemini JSON extraction failed:", extracted.error);
      if (body.mode === "mood_ideas" || body.mode === "ingredients_ideas" || body.mode === "filtered_ideas") {
        return response(200, { ideas: buildFallbackIdeas(body, 6), fallback: true });
      }
      if (body.mode === "idea_recipe") {
        return response(200, { recipe: buildFallbackRecipe(body), fallback: true });
      }
      if (body.mode === "chef_chat") {
        return response(200, {
          reply:
            "Good idea overall. To improve flavor, add one acidic component, one aromatic, and one textural contrast: for example lemon, garlic, and crisp onion. Keep gorgonzola in moderation so it complements rather than dominates. Cook the chicken until deeply golden, then rest it before assembling to keep the crust crisp.",
          fallback: true,
        });
      }
      return response(500, { error: true, message: extracted.error });
    }

    if (body.mode === "mood_ideas" || body.mode === "ingredients_ideas" || body.mode === "filtered_ideas") {
      const ideas = parseIdeas(extracted.parsed);
      if (ideas.length === 0) {
        return response(200, { ideas: buildFallbackIdeas(body, 6), fallback: true });
      }
      const contextLabel =
        body.mode === "ingredients_ideas"
          ? (body.ingredients?.[0]?.trim() || "Chef")
          : (body.prompt?.trim().split(" ").slice(0, 2).join(" ") || "Chef");
      return response(200, {
        ideas: ensureIdeaCount(ideas, 6, contextLabel, body.exclude_titles ?? []),
      });
    }

    if (body.mode === "chef_chat") {
      const chat = parseChefReply(extracted.parsed);
      if (!chat) {
        return response(200, {
          reply:
            "Yes, that can work very well. I’d optimize flavor by balancing richness, acid, and crunch: season the chicken assertively, add brightness with lemon or quick-pickled onion, and use a light sauce so the gorgonzola stays in balance. Keep the cutlet crisp by resting it on a rack before building the sandwich.",
          fallback: true,
        });
      }
      return response(200, chat);
    }

    const recipe = parseRecipe(extracted.parsed);
    if (!recipe) {
      if (body.mode === "idea_recipe") {
        return response(200, { recipe: buildFallbackRecipe(body), fallback: true });
      }
      return response(500, { error: true, message: "AI returned invalid recipe format." });
    }

    return response(200, { recipe });
  } catch (error) {
    console.error("ai-generate-recipe fatal error:", error);
    return response(500, {
      error: true,
      message: error instanceof Error ? error.message : "Unexpected server error",
    });
  }
});
