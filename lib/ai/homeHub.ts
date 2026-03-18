import { callAIForJson } from "./jsonResponse";
import { createAiRecipeResult, parseAiRecipeResult, type AiRecipeResult } from "./recipeResult";
import type { AIMessage } from "./chatPromptBuilder";
import { hashAiCacheInput, readAiCache, writeAiCache } from "./cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatIngredientLine } from "../recipes/recipeDraft";
import { resolveAiTaskSettings } from "./taskSettings";
import { recipeMatchesRequestedDirection } from "./homeRecipeAlignment";

type HomeIdea = {
  title: string;
  description: string;
  cook_time_min: number | null;
};

type HomeGeneratedRecipe = {
  title: string;
  description: string | null;
  servings: number | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  difficulty: string | null;
  ingredients: Array<{ name: string }>;
  steps: Array<{ text: string }>;
};

type IdeaMode = "mood_ideas" | "ingredients_ideas" | "filtered_ideas";

type IdeaInput = {
  mode: IdeaMode;
  prompt?: string;
  ingredients?: string[];
  excludeTitles?: string[];
  batchIndex?: number;
  conversationHistory?: AIMessage[];
  requestedCount?: number;
  filters?: {
    cuisine?: string;
    protein?: string;
    mealType?: string;
    cookingTime?: string;
  };
};

type AiCacheContext = {
  supabase: SupabaseClient;
  userId: string;
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
  "interested",
  "build",
  "built",
  "user",
  "users",
  "version",
  "versions",
  "special",
  "create",
  "created",
  "give",
  "some",
  "can",
  "you",
  "me",
]);

const toTitleCase = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const FORBIDDEN_TITLE_TERMS = new Set(["build", "built", "user", "interested", "idea", "recipe", "version", "special", "chef"]);

function formatConversation(conversationHistory: AIMessage[] | undefined) {
  return (conversationHistory ?? [])
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => `${message.role === "user" ? "User" : "Chef"}: ${message.content.trim()}`)
    .join("\n");
}

function extractSeedLabel(input: { prompt?: string; ingredients?: string[]; ideaTitle?: string }): string {
  const ingredientSeed = (input.ingredients ?? [])
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 3)
    .join(" ");

  if (ingredientSeed) {
    return toTitleCase(ingredientSeed.replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim());
  }

  const prompt = (input.prompt ?? input.ideaTitle ?? "").toLowerCase();
  const tokens = prompt
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .map((token: string) => token.trim())
    .filter((token: string) => token.length > 2 && !STOP_WORDS.has(token))
    .slice(0, 3);

  if (tokens.length === 0) {
    return "Chef Special";
  }

  return toTitleCase(tokens.join(" "));
}

function sanitizeIdeaTitle(rawTitle: string) {
  return toTitleCase(
    rawTitle
      .replace(/[^\w\s&/-]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .filter((word) => !FORBIDDEN_TITLE_TERMS.has(word.toLowerCase()))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function deriveIdeaTitle(rawTitle: string, description: string, input: IdeaInput) {
  const sanitized = sanitizeIdeaTitle(rawTitle);
  if (sanitized && sanitized.split(/\s+/).length >= 2) {
    return sanitized;
  }

  const combined = `${description} ${input.prompt ?? ""} ${formatConversation(input.conversationHistory)}`.toLowerCase();
  const titlePatterns = [
    { tokens: ["eggplant", "aubergine", "vinete"], title: "Roasted Eggplant Dip" },
    { tokens: ["baba ghanoush"], title: "Baba Ghanoush" },
    { tokens: ["dip"], title: "Smoky Roasted Dip" },
    { tokens: ["pasta", "linguine", "fettuccine", "noodle"], title: "Savory Pasta" },
    { tokens: ["rice bowl", "bowl"], title: "Flavorful Rice Bowl" },
    { tokens: ["soup", "stew"], title: "Hearty Soup" },
    { tokens: ["taco", "tacos"], title: "Bright Tacos" },
    { tokens: ["salad"], title: "Fresh Salad" },
    { tokens: ["skillet"], title: "Weeknight Skillet" },
  ];

  for (const pattern of titlePatterns) {
    if (pattern.tokens.some((token) => combined.includes(token))) {
      return pattern.title;
    }
  }

  return extractSeedLabel({
    prompt: input.prompt || formatConversation(input.conversationHistory),
    ingredients: input.ingredients,
    ideaTitle: rawTitle || description,
  });
}

function buildFallbackIdeas(input: IdeaInput, count = 6): HomeIdea[] {
  const seed = extractSeedLabel({
    prompt: input.prompt || formatConversation(input.conversationHistory),
    ingredients: input.ingredients,
  }).slice(0, 40);
  const excluded = new Set((input.excludeTitles ?? []).map((title) => title.toLowerCase()));
  const batch = Math.max(input.batchIndex ?? 1, 1);
  const styles = ["Smoky", "Zesty", "Herby", "Garlic Butter", "Crispy", "Creamy", "Spicy", "Roasted"];
  const formats = ["Skillet", "Rice Bowl", "Pasta", "Soup", "Tacos", "Sheet Pan", "Wrap", "Noodles"];
  const descriptions = [
    "Layered aromatics and a balanced sauce keep this idea bold but practical for a weeknight cook.",
    "Comforting, savory flavor with enough brightness to keep every bite from feeling heavy.",
    "Texture contrast and clean finishing notes make this feel polished without adding complexity.",
    "A flavor-forward idea that stays approachable, fast, and dinner-table friendly.",
  ];
  const times = [18, 22, 25, 28, 30, 35, 40];
  const out: HomeIdea[] = [];
  let cursor = (batch - 1) * 5;

  while (out.length < count && cursor < 200) {
    const title = `${styles[cursor % styles.length]} ${seed} ${formats[cursor % formats.length]}`.replace(/\s+/g, " ").trim();
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

  return out;
}

function normalizeIdeas(value: unknown, input: IdeaInput): HomeIdea[] {
  const rawIdeas =
    typeof value === "object" && value !== null && Array.isArray((value as { ideas?: unknown[] }).ideas)
      ? (value as { ideas: unknown[] }).ideas
      : Array.isArray(value)
        ? value
        : [];

  const ideas: HomeIdea[] = [];

  for (const item of rawIdeas) {
    if (typeof item === "string") {
      const title = item.trim();
      if (title) {
        ideas.push({
          title: deriveIdeaTitle(title, "", input),
          description: "A practical, flavor-forward recipe idea shaped around your request.",
          cook_time_min: 30,
        });
      }
      continue;
    }

    if (!item || typeof item !== "object") {
      continue;
    }

    const raw = item as Record<string, unknown>;
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!title) {
      continue;
    }

    ideas.push({
      title: deriveIdeaTitle(title, typeof raw.description === "string" ? raw.description : "", input),
      description:
        typeof raw.description === "string" && raw.description.trim().length > 0
          ? raw.description.trim()
          : "A practical, flavor-forward recipe idea shaped around your request.",
      cook_time_min: typeof raw.cook_time_min === "number" ? Math.round(raw.cook_time_min) : 30,
    });
  }

  return ideas;
}

function normalizeRecipe(value: unknown, fallbackTitle: string): HomeGeneratedRecipe | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const ingredients = Array.isArray(raw.ingredients)
    ? raw.ingredients
        .map((item) => {
          if (typeof item === "string") {
            return { name: item.trim() };
          }
          if (item && typeof item === "object" && typeof (item as { name?: unknown }).name === "string") {
            const ingredient = item as { name: string; quantity?: number; unit?: string | null; prep?: string | null };
            return {
              name: formatIngredientLine({
                name: ingredient.name,
                quantity: typeof ingredient.quantity === "number" ? ingredient.quantity : null,
                unit: typeof ingredient.unit === "string" ? ingredient.unit : null,
                prep: typeof ingredient.prep === "string" ? ingredient.prep : null,
              }) || ingredient.name.trim(),
            };
          }
          return null;
        })
        .filter((item): item is { name: string } => item !== null && item.name.length > 0)
    : [];
  const steps = Array.isArray(raw.steps)
    ? raw.steps
        .map((item) => {
          if (typeof item === "string") {
            return { text: item.trim() };
          }
          if (item && typeof item === "object" && typeof (item as { text?: unknown }).text === "string") {
            return { text: (item as { text: string }).text.trim() };
          }
          return null;
        })
        .filter((item): item is { text: string } => item !== null && item.text.length > 0)
    : [];

  if (ingredients.length === 0 || steps.length === 0) {
    return null;
  }

  const title = typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : fallbackTitle;

  return {
    title,
    description: typeof raw.description === "string" ? raw.description.trim() || null : null,
    servings: typeof raw.servings === "number" ? Math.round(raw.servings) : 4,
    prep_time_min: typeof raw.prep_time_min === "number" ? Math.round(raw.prep_time_min) : 15,
    cook_time_min: typeof raw.cook_time_min === "number" ? Math.round(raw.cook_time_min) : 30,
    difficulty: typeof raw.difficulty === "string" && raw.difficulty.trim() ? raw.difficulty.trim() : "Easy",
    ingredients,
    steps,
  };
}

function recipeMatchesConversation(recipe: HomeGeneratedRecipe, input: { ideaTitle: string; prompt?: string; ingredients?: string[]; conversationHistory?: AIMessage[] }) {
  const context = `${input.ideaTitle} ${input.prompt ?? ""} ${formatConversation(input.conversationHistory)} ${(input.ingredients ?? []).join(" ")}`;
  return recipeMatchesRequestedDirection(recipe, context);
}

function buildIdeasPrompt(input: IdeaInput) {
  const requestedCount = Math.max(1, Math.min(input.requestedCount ?? 6, 6));
  const conversation = formatConversation(input.conversationHistory);
  const excludeTitles = JSON.stringify(input.excludeTitles ?? []);

  if (input.mode === "ingredients_ideas") {
    return `User ingredients: ${JSON.stringify(input.ingredients ?? [])}
Chef conversation (highest priority if present):
${conversation || "No chef conversation provided."}
Already shown idea titles (must NOT repeat any): ${excludeTitles}
Current batch index: ${input.batchIndex ?? 1}
Generate exactly ${requestedCount} recipe ideas the user can cook with these ingredients.
Rules:
- Chef conversation is priority 1. User taste profile is priority 2.
- Titles must name the actual dish the user would recognize on a menu.
- Never use words like Build, User, Interested, Idea, Version, Chef Special, or generic format labels without a real dish name.
- Keep the suggestions tightly aligned to the ingredients and conversation.
- Each description must explain flavor profile, texture, and what makes the dish distinct.
Return ONLY valid JSON:
{
  "ideas": [
    { "title": string, "description": string, "cook_time_min": number }
  ]
}`;
  }

  if (input.mode === "filtered_ideas") {
    return `Generate exactly ${requestedCount} recipe ideas from these filters:
${JSON.stringify(input.filters ?? {}, null, 2)}
Rules:
- Titles must name actual dishes, not generic meal formats.
- User taste profile is priority 2 after the explicit filter choices.
Return ONLY valid JSON:
{
  "ideas": [
    { "title": string, "description": string, "cook_time_min": number }
  ]
}`;
  }

  return `User craving prompt: ${input.prompt ?? ""}
Chef conversation (highest priority if present):
${conversation || "No chef conversation provided."}
Already shown idea titles (must NOT repeat any): ${excludeTitles}
Current batch index: ${input.batchIndex ?? 1}
Generate exactly ${requestedCount} recipe ideas.
Rules:
- Chef conversation is priority 1. User taste profile is priority 2.
- If the conversation clearly settles on one cuisine, dish family, or flavor direction, stay inside that lane.
- Titles must name the actual dish the user would expect to cook.
- Never use words like Build, User, Interested, Idea, Version, Chef Special, or generic format labels without a real dish name.
- Each description must explain flavor profile, texture, and what makes the dish distinct.
Return ONLY valid JSON:
{
  "ideas": [
    { "title": string, "description": string, "cook_time_min": number }
  ]
}`;
}

function isHomeIdeaList(value: unknown): value is HomeIdea[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as { title?: unknown }).title === "string" &&
        typeof (item as { description?: unknown }).description === "string" &&
        (typeof (item as { cook_time_min?: unknown }).cook_time_min === "number" ||
          (item as { cook_time_min?: unknown }).cook_time_min === null)
    )
  );
}

function isGeneratedRecipe(value: unknown): value is HomeGeneratedRecipe {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as { title?: unknown }).title === "string" &&
    Array.isArray((value as { ingredients?: unknown[] }).ingredients) &&
    Array.isArray((value as { steps?: unknown[] }).steps)
  );
}

export async function generateHomeIdeasWithCache(
  input: IdeaInput,
  userTasteSummary?: string,
  cacheContext?: AiCacheContext
): Promise<HomeIdea[]> {
  const inputHash = cacheContext
    ? hashAiCacheInput({
        input,
        userTasteSummary: userTasteSummary?.trim() || null,
      })
    : null;

  if (cacheContext && inputHash) {
    const cached = await readAiCache<unknown>(cacheContext.supabase, cacheContext.userId, "home_ideas", inputHash);
    if (cached && isHomeIdeaList(cached.response_json)) {
      return cached.response_json;
    }
  }

  const messages = [
    {
      role: "system" as const,
      content: `You are a recipe ideation assistant. Return only valid JSON. Keep titles distinct and natural. Keep ideas practical for a home cook.
Priority order:
1. Chef conversation and the user's most recent confirmed direction
2. User taste summary
User taste summary: ${userTasteSummary?.trim() || "No user taste summary available."}`,
    },
    {
      role: "user" as const,
      content: buildIdeasPrompt(input),
    },
  ];

  try {
    const taskSetting = await resolveAiTaskSettings("home_ideas");
    if (!taskSetting.enabled) {
      throw new Error("Home ideas AI task is disabled.");
    }
    const result = await callAIForJson(messages, {
      max_tokens: taskSetting.maxTokens,
      temperature: taskSetting.temperature,
      model: taskSetting.primaryModel,
      fallback_models: taskSetting.fallbackModel ? [taskSetting.fallbackModel] : [],
    });
    const { parsed } = result;
    const ideas = normalizeIdeas(parsed, input);
    const fallbackCount = input.requestedCount ?? (input.mode === "filtered_ideas" ? 5 : 6);
    const resolved = ideas.length > 0 ? ideas : buildFallbackIdeas(input, fallbackCount);
    if (cacheContext && inputHash) {
      await writeAiCache(
        cacheContext.supabase,
        cacheContext.userId,
        "home_ideas",
        inputHash,
        result.model ?? result.provider,
        resolved
      );
    }
    return resolved;
  } catch {
    return buildFallbackIdeas(input, input.requestedCount ?? (input.mode === "filtered_ideas" ? 5 : 6));
  }
}

export async function generateHomeRecipe(input: {
  ideaTitle: string;
  prompt?: string;
  ingredients?: string[];
  conversationHistory?: AIMessage[];
}, userTasteSummary?: string, cacheContext?: AiCacheContext): Promise<AiRecipeResult> {
  const inputHash = cacheContext
    ? hashAiCacheInput({
        input,
        userTasteSummary: userTasteSummary?.trim() || null,
      })
    : null;

  if (cacheContext && inputHash) {
    const cached = await readAiCache<unknown>(cacheContext.supabase, cacheContext.userId, "home_recipe", inputHash);
    if (cached) {
      const parsedCached = parseAiRecipeResult(cached.response_json);
      if (parsedCached) {
        return parsedCached;
      }
      if (isGeneratedRecipe(cached.response_json)) {
        return createAiRecipeResult({
          purpose: "home_recipe",
          source: "cache",
          model: cached.model,
          cached: true,
          inputHash,
          createdAt: null,
          recipe: {
            ...cached.response_json,
            tags: null,
            notes: null,
            change_log: null,
            ai_metadata_json: null,
          },
        });
      }
    }
  }

  const messages = [
    {
      role: "system" as const,
      content: `You are a professional recipe developer.
Priority order:
1. Chef conversation and the user's most recent confirmed direction
2. User taste summary
User taste summary: ${userTasteSummary?.trim() || "No user taste summary available."}
Return ONLY valid JSON:
{
  "title": string,
  "description": string|null,
  "servings": number|null,
  "prep_time_min": number|null,
  "cook_time_min": number|null,
  "difficulty": string|null,
  "ingredients": [{ "name": string, "quantity": number, "unit": string|null, "prep": string|null }],
  "steps": [{ "text": string }]
}
Rules:
- The recipe must follow the chef conversation closely.
- If the user narrowed to one exact dish, make that dish. Do not drift to adjacent ideas.
- If the chef conversation indicates a dish format like pasta, skillet, salad, soup, tacos, dip, or bowl, preserve that format exactly unless the user explicitly changed it later.
- When the conversation mentions a specific anchor ingredient or protein, keep it in the final recipe instead of swapping to a different main ingredient.
- The title must be a clean, dish-specific recipe name a home cook would understand.
- Every ingredient must include an explicit quantity. Good: 2 onions, 1.5 lb chicken, 2 tbsp olive oil. Bad: onion, chicken, olive oil.
- If an ingredient would normally appear without a unit, still include a count, like 1 onion or 2 eggs.
- Keep steps practical and home-cook friendly.
- Produce a complete recipe, not notes.`,
    },
    {
      role: "user" as const,
      content: `Generate a full recipe for this selected idea:
Idea: ${input.ideaTitle}
Prompt context: ${input.prompt ?? ""}
Conversation context:
${formatConversation(input.conversationHistory) || "No chef conversation available."}
Ingredients context: ${JSON.stringify(input.ingredients ?? [])}`,
    },
  ];

  const taskSetting = await resolveAiTaskSettings("home_recipe");
  if (!taskSetting.enabled) {
    throw new Error("Home recipe AI task is disabled.");
  }
  const result = await callAIForJson(messages, {
    max_tokens: taskSetting.maxTokens,
    temperature: taskSetting.temperature,
    model: taskSetting.primaryModel,
    fallback_models: taskSetting.fallbackModel ? [taskSetting.fallbackModel] : [],
  });
  const { parsed } = result;
  const recipe = normalizeRecipe(parsed, input.ideaTitle);

  if (!recipe) {
    throw new Error("AI returned invalid recipe payload.");
  }

  if (!recipeMatchesConversation(recipe, input)) {
    throw new Error("AI recipe drifted from the chef conversation.");
  }

  const aiRecipeResult = createAiRecipeResult({
    purpose: "home_recipe",
    source: "ai",
    provider: result.provider,
    model: result.model ?? result.provider,
    cached: false,
    inputHash,
    createdAt: new Date().toISOString(),
    recipe: {
      ...recipe,
      tags: null,
      notes: null,
      change_log: null,
      ai_metadata_json: null,
    },
  });

  if (cacheContext && inputHash) {
    await writeAiCache(
      cacheContext.supabase,
      cacheContext.userId,
      "home_recipe",
      inputHash,
      result.model ?? result.provider,
      aiRecipeResult
    );
  }

  return aiRecipeResult;
}
