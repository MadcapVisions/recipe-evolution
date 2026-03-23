import { AIJsonParseError, callAIForJson, callAIForJsonWithContract } from "./jsonResponse";
import type { AICallOptions } from "./aiClient";
import { createAiRecipeResult, parseAiRecipeResult, type AiRecipeResult } from "./recipeResult";
import type { AIMessage } from "./chatPromptBuilder";
import { hashAiCacheInput, readAiCache, writeAiCache } from "./cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { repairRecipeDraftIngredientLines } from "../recipes/recipeDraft";
import { resolveAiTaskSettings } from "./taskSettings";
import type { CookingBrief } from "./contracts/cookingBrief";
import type { RecipeOutline } from "./contracts/recipeOutline";
import type { RecipePlan } from "./contracts/recipePlan";
import { verifyRecipeAgainstBrief } from "./recipeVerifier";
import { RecipeBuildError } from "./recipeBuildError";
import { createFailedVerificationResult } from "./contracts/verificationResult";
import { buildRetryInstructions } from "./homeRecipeRetry";
import {
  shouldEscalateVerification,
  findMissingQuantities,
  buildVerificationRepairPlan,
  buildQualityRepairPlan,
  buildScopedRepairPrompt,
} from "./recipeRepair";
import { detectRequestedAnchorIngredient, detectRequestedProtein } from "./homeRecipeAlignment";
import { buildHomeRecipeAiMetadata } from "./homeRecipeMetadata";
import { normalizeGeneratedRecipePayload, type HomeGeneratedRecipe, type RecipeNormalizationResult } from "./recipeNormalization";
import { buildFallbackRecipeOutline, normalizeRecipeOutlinePayload, validateRecipeOutline } from "./recipeOutline";
import { HOME_RECIPE_JSON_SCHEMA, RECIPE_OUTLINE_JSON_SCHEMA } from "./recipeJsonSchemas";
import { isLikelyTruncatedRecipePayload } from "./recipeTruncation";
import { validateRecipeStructure } from "./recipeStructuralValidation";

type HomeIdea = {
  title: string;
  description: string;
  cook_time_min: number | null;
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

type HomeRecipeStage = "recipe_plan" | "recipe_outline" | "recipe_generate" | "recipe_verify";

type HomeRecipeStageReporter = (stage: HomeRecipeStage, message: string) => void;

// --- Step quality helpers (Item 7) ---
const ACTIONABLE_COOKING_VERBS = new Set([
  "add", "heat", "cook", "stir", "mix", "season", "chop", "dice", "slice", "mince",
  "saute", "sauté", "fry", "boil", "simmer", "bake", "roast", "grill", "broil", "steam",
  "drain", "rinse", "pour", "combine", "whisk", "beat", "fold", "toss", "coat", "brush",
  "spread", "place", "transfer", "remove", "cover", "reduce", "thicken", "brown",
  "caramelize", "marinate", "taste", "adjust", "serve", "rest", "cool", "preheat",
  "melt", "sear", "deglaze", "blend", "puree", "press", "squeeze", "peel", "cut",
  "trim", "score", "pound", "flatten", "roll", "knead", "refrigerate", "freeze", "let",
]);

function isVagueStep(text: string): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 10) return true;
  const lower = text.toLowerCase();
  return !Array.from(ACTIONABLE_COOKING_VERBS).some((verb) => lower.includes(verb));
}

// --- Taste profile helpers (Item 8) ---
function extractDislikedFromSummary(tasteSummary: string): string[] {
  const match = tasteSummary.match(/\bAvoid\s+([^.]+)\./i);
  if (!match?.[1]) return [];
  return match[1].split(/,\s+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function findTasteViolations(recipe: HomeGeneratedRecipe, disliked: string[]): string[] {
  if (disliked.length === 0) return [];
  const ingredientText = recipe.ingredients.map((ing) => ing.name.toLowerCase()).join(" ");
  return disliked.filter((d) => ingredientText.includes(d));
}

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
  return normalizeGeneratedRecipePayload(value, fallbackTitle).recipe;
}

async function buildRecipeOutlineForGeneration(input: {
  ideaTitle: string;
  prompt?: string;
  ingredients?: string[];
  conversationHistory?: AIMessage[];
  cookingBrief?: CookingBrief | null;
  recipePlan?: RecipePlan | null;
  aiCallOptions: AICallOptions;
  onStage?: HomeRecipeStageReporter;
}) {
  const fallbackOutline = buildFallbackRecipeOutline({
    ideaTitle: input.ideaTitle,
    brief: input.cookingBrief,
    recipePlan: input.recipePlan,
  });
  const outlineMaxTokens = input.aiCallOptions.max_tokens ?? 900;
  const outlineTemperature = input.aiCallOptions.temperature ?? 0.35;

  input.onStage?.("recipe_outline", "Drafting the recipe outline...");
  const outlineMessages = [
    {
      role: "system" as const,
      content: `You build typed recipe outlines for a home-cooking pipeline.
Return ONLY a single JSON object with EXACTLY these fields:
{
  "title": string,
  "summary": string|null,
  "dish_family": string|null,
  "primary_ingredient": string|null,
  "ingredient_groups": [{ "name": string, "items": string[] }],
  "step_outline": string[],
  "chef_tip_topics": string[]
}
Rules:
- Preserve the requested dish identity and format exactly.
- Keep ingredient_groups focused on the core components the final recipe must include.
- step_outline should capture the cooking flow, not full detailed instructions.
- chef_tip_topics must be short topic phrases, not full chef tips.
- Do not include markdown, wrapper keys, or commentary.`,
    },
    {
      role: "user" as const,
      content: `Build a recipe outline for this idea.
Idea: ${input.ideaTitle}
Prompt context: ${input.prompt ?? ""}
Structured cooking brief:
${input.cookingBrief ? JSON.stringify(input.cookingBrief, null, 2) : "No structured cooking brief available."}
Structured recipe plan:
${input.recipePlan ? JSON.stringify(input.recipePlan, null, 2) : "No structured recipe plan available."}
Conversation context:
${formatConversation(input.conversationHistory) || "No chef conversation available."}
Ingredients context: ${JSON.stringify(input.ingredients ?? [])}`,
    },
  ];

  try {
    const outlineResult = await callAIForJsonWithContract<RecipeOutline>(
      outlineMessages,
      (parsed) => {
        const normalized = normalizeRecipeOutlinePayload(parsed, fallbackOutline.title);
        return {
          value: normalized.outline,
          error: normalized.reason,
        };
      },
      {
      ...input.aiCallOptions,
      max_tokens: Math.min(900, Math.max(500, Math.floor(outlineMaxTokens * 0.55))),
      temperature: Math.min(outlineTemperature, 0.35),
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "recipe_outline",
          strict: true,
          schema: RECIPE_OUTLINE_JSON_SCHEMA,
        },
      },
      allow_response_format_downgrade: true,
      }
    );

    const validation = validateRecipeOutline({
      outline: outlineResult.contract,
      brief: input.cookingBrief,
      recipePlan: input.recipePlan,
    });
    if (!validation.passes) {
      console.warn("[homeHub] outline validation failed", {
        reasons: validation.reasons,
        checks: validation.checks,
      });
      return {
        outline: fallbackOutline,
        source: "fallback" as const,
        usage: outlineResult.usage,
      };
    }

    return {
      outline: outlineResult.contract,
      source: "ai" as const,
      usage: outlineResult.usage,
    };
  } catch {
    return {
      outline: fallbackOutline,
      source: "fallback" as const,
      usage: {
        input_tokens: null,
        output_tokens: null,
        total_tokens: null,
        estimated_cost_usd: null,
      },
    };
  }
}

function getSuspiciousBriefReason(input: {
  ideaTitle: string;
  prompt?: string;
  conversationHistory?: AIMessage[];
  cookingBrief?: CookingBrief | null;
}) {
  const brief = input.cookingBrief;
  if (!brief || brief.request_mode !== "locked") {
    return null;
  }

  const normalizedName = brief.dish.normalized_name?.trim() ?? "";
  const centerpiece = brief.ingredients.centerpiece?.trim() ?? "";
  const context = `${input.ideaTitle} ${input.prompt ?? ""} ${formatConversation(input.conversationHistory)}`.toLowerCase();
  const requestedProtein = detectRequestedProtein(context);
  const requestedAnchor = detectRequestedAnchorIngredient(context);

  if (!normalizedName || normalizedName === "Chef Conversation Recipe") {
    return "Locked direction is too generic to build reliably. Pick a more specific direction first.";
  }

  if (
    centerpiece &&
    requestedProtein &&
    !centerpiece.toLowerCase().includes(requestedProtein) &&
    !normalizedName.toLowerCase().includes(requestedProtein)
  ) {
    return `Locked direction lost the requested centerpiece ingredient (${requestedProtein}). Refine the direction before building.`;
  }

  if (
    !centerpiece &&
    (requestedProtein || requestedAnchor) &&
    !normalizedName.toLowerCase().includes((requestedProtein ?? requestedAnchor ?? "").toLowerCase())
  ) {
    return "Locked direction is missing a concrete anchor ingredient. Refine the direction before building.";
  }

  return null;
}

export function normalizeGeneratedRecipeForTest(value: unknown, fallbackTitle: string) {
  return normalizeGeneratedRecipePayload(value, fallbackTitle);
}


function buildIdeasPrompt(input: IdeaInput) {
  const requestedCount = Math.max(1, Math.min(input.requestedCount ?? 2, 2));
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

async function repairMalformedRecipePayload(input: {
  rawText: string;
  ideaTitle: string;
  prompt?: string;
  conversationHistory?: AIMessage[];
  cookingBrief?: CookingBrief | null;
  recipePlan?: RecipePlan | null;
  recipeOutline?: RecipeOutline | null;
  aiCallOptions: AICallOptions;
}) {
  const repairMessages = [
    {
      role: "system" as const,
      content: `You repair malformed AI recipe drafts.
Return ONLY a single JSON object with EXACTLY these fields — no markdown, no wrapper keys, no explanation:
{
  "title": string,            // REQUIRED
  "description": string|null,
  "servings": number|null,
  "prep_time_min": number|null,
  "cook_time_min": number|null,
  "difficulty": string|null,
  "ingredients": [{ "name": string, "quantity": number, "unit": string|null, "prep": string|null }],  // REQUIRED — non-empty array
  "steps": [{ "text": string }],  // REQUIRED — non-empty array
  "chefTips": string[]
}
SELF-CHECK before returning: confirm (1) "title" is a non-empty string, (2) "ingredients" is a non-empty array with every element having a "name", (3) "steps" is a non-empty array with every element having a "text". Fix before returning if any is missing.
Rules:
- Preserve the original dish identity and requested format exactly.
- Preserve named dishes and regional dishes exactly instead of renaming them generically.
- Every ingredient must include an explicit quantity.
- Do not explain what you changed.
- Do not use markdown fences.
- Salvage the draft into valid recipe JSON instead of drifting to a different dish.`,
    },
    {
      role: "user" as const,
      content: `Repair this malformed recipe draft into valid JSON.
Idea: ${input.ideaTitle}
Prompt context: ${input.prompt ?? ""}
Structured cooking brief:
${input.cookingBrief ? JSON.stringify(input.cookingBrief, null, 2) : "No structured cooking brief available."}
Structured recipe plan:
${input.recipePlan ? JSON.stringify(input.recipePlan, null, 2) : "No structured recipe plan available."}
Structured recipe outline:
${input.recipeOutline ? JSON.stringify(input.recipeOutline, null, 2) : "No structured recipe outline available."}
Conversation context:
${formatConversation(input.conversationHistory) || "No chef conversation available."}
Malformed recipe draft:
${input.rawText}`,
    },
  ];

  const repairResult = await callAIForJsonWithContract<HomeGeneratedRecipe>(
    repairMessages,
    (parsed) => {
      const normalized = normalizeGeneratedRecipePayload(parsed, input.ideaTitle);
      return {
        value: normalized.recipe,
        error: normalized.reason,
      };
    },
    input.aiCallOptions
  );
  return {
    recipe: repairResult.contract,
    reason: null,
    usage: repairResult.usage,
  };
}

function buildExpandedRecipeCallOptions(options: AICallOptions): AICallOptions {
  const current = typeof options.max_tokens === "number" ? options.max_tokens : 1600;
  return {
    ...options,
    max_tokens: Math.min(current + 1200, 4000),
  };
}

export async function generateHomeRecipe(input: {
  ideaTitle: string;
  prompt?: string;
  ingredients?: string[];
  conversationHistory?: AIMessage[];
  cookingBrief?: CookingBrief | null;
  recipePlan?: RecipePlan | null;
  retryContext?: {
    attemptNumber: number;
    retryStrategy: "regenerate_same_model" | "regenerate_stricter" | "try_fallback_model";
    reasons: string[];
    modelOverride?: string;
  } | null;
}, userTasteSummary?: string, cacheContext?: AiCacheContext, onStage?: HomeRecipeStageReporter): Promise<AiRecipeResult> {
  const suspiciousBriefReason = getSuspiciousBriefReason(input);
  if (suspiciousBriefReason) {
    throw new RecipeBuildError({
      message: suspiciousBriefReason,
      kind: "generation_failed",
      verification: createFailedVerificationResult(suspiciousBriefReason, "ask_user", {
        failure_stage: "generation",
        failure_context: {
          reason: "suspicious_brief",
          idea_title: input.ideaTitle,
        },
      }),
      retryStrategy: "ask_user",
      reasons: [suspiciousBriefReason],
    });
  }

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
        const cacheVerification = verifyRecipeAgainstBrief({
          recipe: parsedCached.recipe,
          brief: input.cookingBrief,
          fallbackContext: `${input.ideaTitle} ${input.prompt ?? ""}`,
        });
        if (cacheVerification.passes) {
          return parsedCached;
        }
        // Cached result failed verification against current brief — fall through to fresh generation
      } else if (isGeneratedRecipe(cached.response_json)) {
        const cacheVerification = verifyRecipeAgainstBrief({
          recipe: cached.response_json,
          brief: input.cookingBrief,
          fallbackContext: `${input.ideaTitle} ${input.prompt ?? ""}`,
        });
        if (cacheVerification.passes) {
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
        // Cached result failed verification against current brief — fall through to fresh generation
      }
    }
  }

  const taskSetting = await resolveAiTaskSettings("home_recipe");
  if (!taskSetting.enabled) {
    throw new Error("Home recipe AI task is disabled.");
  }
  const resolvedModel = input.retryContext?.modelOverride ?? taskSetting.primaryModel;
  const aiCallOptions = {
    max_tokens: taskSetting.maxTokens,
    temperature: taskSetting.temperature,
    model: resolvedModel,
    fallback_models: input.retryContext?.modelOverride ? [] : (taskSetting.fallbackModel ? [taskSetting.fallbackModel] : []),
    strict_model: !!input.retryContext?.modelOverride,
    response_format: {
      type: "json_schema" as const,
      json_schema: {
        name: "home_recipe",
        strict: true,
        schema: HOME_RECIPE_JSON_SCHEMA,
      },
    },
    allow_response_format_downgrade: true,
  };
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalEstimatedCostUsd = 0;
  let hasUsageMetrics = false;
  const outlineBuild = await buildRecipeOutlineForGeneration({
    ideaTitle: input.ideaTitle,
    prompt: input.prompt,
    ingredients: input.ingredients,
    conversationHistory: input.conversationHistory,
    cookingBrief: input.cookingBrief,
    recipePlan: input.recipePlan,
    aiCallOptions,
    onStage,
  });
  const recipeOutline = outlineBuild.outline;
  if (
    outlineBuild.usage.input_tokens != null ||
    outlineBuild.usage.output_tokens != null ||
    outlineBuild.usage.estimated_cost_usd != null
  ) {
    totalInputTokens += outlineBuild.usage.input_tokens ?? 0;
    totalOutputTokens += outlineBuild.usage.output_tokens ?? 0;
    totalEstimatedCostUsd += outlineBuild.usage.estimated_cost_usd ?? 0;
    hasUsageMetrics = true;
  }

  const messages = [
    {
      role: "system" as const,
      content: `You are a professional recipe developer.
Priority order:
1. Chef conversation and the user's most recent confirmed direction
2. User taste summary
User taste summary: ${userTasteSummary?.trim() || "No user taste summary available."}
Structured cooking brief: ${input.cookingBrief ? JSON.stringify(input.cookingBrief) : "No structured cooking brief available."}
Structured recipe plan: ${input.recipePlan ? JSON.stringify(input.recipePlan) : "No structured recipe plan available."}
Structured recipe outline: ${JSON.stringify(recipeOutline)}
Retry instructions: ${
          input.retryContext
            ? buildRetryInstructions({
                retryStrategy: input.retryContext.retryStrategy,
                reasons: input.retryContext.reasons,
                attemptNumber: input.retryContext.attemptNumber,
              }).join(" ")
            : "No retry instructions."
        }
Return ONLY a single JSON object with EXACTLY these fields — no markdown, no wrapper keys, no explanation:
{
  "title": string,            // REQUIRED — clean dish-specific recipe name
  "description": string|null,
  "servings": number|null,
  "prep_time_min": number|null,
  "cook_time_min": number|null,
  "difficulty": string|null,
  "ingredients": [{ "name": string, "quantity": number, "unit": string|null, "prep": string|null }],  // REQUIRED — must be a non-empty array
  "steps": [{ "text": string }],  // REQUIRED — must be a non-empty array
  "chefTips": string[]
}
SELF-CHECK before returning: confirm your JSON has (1) a non-empty "title" string, (2) a non-empty "ingredients" array where every element has a "name" key, (3) a non-empty "steps" array where every element has a "text" key. If any of these is missing, fix it before returning.
Rules:
- The recipe must follow the chef conversation closely.
- If the user narrowed to one exact dish, make that dish. Do not drift to adjacent ideas.
- If the chef conversation indicates a dish format like pizza, focaccia, flatbread, pasta, skillet, salad, soup, tacos, dip, or bowl, preserve that format exactly unless the user explicitly changed it later.
- When the conversation mentions a specific anchor ingredient or protein, keep it in the final recipe instead of swapping to a different main ingredient.
- If the user mentions a ready-made or filled ingredient (fresh pasta, stuffed pasta, dumplings, tortillas, pre-made dough, etc.), treat that item as the centerpiece. Do not discard it or replace it with its filling ingredient (e.g. chicken-filled ravioli stays as ravioli, not a chicken dish).
- The title must be a clean, dish-specific recipe name a home cook would understand.
- Every ingredient must include an explicit quantity. Good: 2 onions, 1.5 lb chicken, 2 tbsp olive oil. Bad: onion, chicken, olive oil.
- If an ingredient would normally appear without a unit, still include a count, like 1 onion or 2 eggs.
- Keep steps practical and home-cook friendly.
- Produce a complete recipe, not notes.
- chefTips: include 2–3 specific, practical tips that a home cook would find genuinely useful — technique nuances, common mistakes to avoid, or flavor-boosting tricks. Do not repeat information already in the steps.`,
    },
    {
      role: "user" as const,
      content: `Generate a full recipe for this selected idea:
Idea: ${input.ideaTitle}
Prompt context: ${input.prompt ?? ""}
Structured cooking brief:
${input.cookingBrief ? JSON.stringify(input.cookingBrief, null, 2) : "No structured cooking brief available."}
Structured recipe plan:
${input.recipePlan ? JSON.stringify(input.recipePlan, null, 2) : "No structured recipe plan available."}
Structured recipe outline:
${JSON.stringify(recipeOutline, null, 2)}
Retry instructions:
${
        input.retryContext
          ? buildRetryInstructions({
              retryStrategy: input.retryContext.retryStrategy,
              reasons: input.retryContext.reasons,
              attemptNumber: input.retryContext.attemptNumber,
            }).join("\n")
          : "No retry instructions."
      }
Conversation context:
${formatConversation(input.conversationHistory) || "No chef conversation available."}
Ingredients context: ${JSON.stringify(input.ingredients ?? [])}`,
    },
  ];
  const retryStageMessage = input.retryContext
    ? input.retryContext.retryStrategy === "try_fallback_model"
      ? "Trying a different approach..."
      : "Retrying with same model..."
    : "Writing the recipe...";
  onStage?.("recipe_generate", retryStageMessage);
  let result;
  try {
    result = await callAIForJson(messages, aiCallOptions);
  } catch (callError) {
    const errMessage = callError instanceof Error ? callError.message : String(callError);
    const parseResponse = callError instanceof AIJsonParseError ? callError.response : null;
    throw new RecipeBuildError({
      message: errMessage,
      kind: "invalid_payload",
      verification: createFailedVerificationResult(errMessage, "regenerate_same_model", {
        failure_stage: "parse",
        failure_context: {
          provider: parseResponse?.provider ?? null,
          model: parseResponse?.model ?? resolvedModel,
        },
      }),
      rawModelOutput: parseResponse,
      provider: parseResponse?.provider ?? null,
      model: parseResponse?.model ?? resolvedModel,
    });
  }
  if (result.usage.input_tokens != null || result.usage.output_tokens != null || result.usage.estimated_cost_usd != null) {
    totalInputTokens += result.usage.input_tokens ?? 0;
    totalOutputTokens += result.usage.output_tokens ?? 0;
    totalEstimatedCostUsd += result.usage.estimated_cost_usd ?? 0;
    hasUsageMetrics = true;
  }
  let parsed = result.parsed;
  let normalizedResult: RecipeNormalizationResult = normalizeGeneratedRecipePayload(parsed, input.ideaTitle);
  let recipe = normalizedResult.recipe;
  let repairFailureContext: Record<string, unknown> | null = null;

  if (!recipe && isLikelyTruncatedRecipePayload({
    resultText: result.text,
    finishReason: result.finishReason,
    parsed,
    normalized: normalizedResult,
  })) {
    try {
      onStage?.("recipe_generate", "Retrying with more room for the recipe...");
      const expandedResult = await callAIForJson(messages, buildExpandedRecipeCallOptions(aiCallOptions));
      if (
        expandedResult.usage.input_tokens != null ||
        expandedResult.usage.output_tokens != null ||
        expandedResult.usage.estimated_cost_usd != null
      ) {
        totalInputTokens += expandedResult.usage.input_tokens ?? 0;
        totalOutputTokens += expandedResult.usage.output_tokens ?? 0;
        totalEstimatedCostUsd += expandedResult.usage.estimated_cost_usd ?? 0;
        hasUsageMetrics = true;
      }
      result = expandedResult;
      parsed = expandedResult.parsed;
      normalizedResult = normalizeGeneratedRecipePayload(parsed, input.ideaTitle);
      recipe = normalizedResult.recipe;
    } catch (expandedError) {
      repairFailureContext = {
        ...(repairFailureContext ?? {}),
        truncation_retry_error: expandedError instanceof Error ? expandedError.message : String(expandedError),
      };
    }
  }

  if (!recipe) {
    // Log normalization telemetry before attempting repair so we capture the raw failure.
    console.warn("[homeHub] normalization failed on first parse", {
      reason: normalizedResult.reason,
      normalization_log: normalizedResult.normalization_log,
    });
    onStage?.("recipe_generate", "Repairing malformed recipe output...");
    try {
      const repaired = await repairMalformedRecipePayload({
        rawText: result.text,
        ideaTitle: input.ideaTitle,
        prompt: input.prompt,
        conversationHistory: input.conversationHistory,
        cookingBrief: input.cookingBrief,
        recipePlan: input.recipePlan,
        recipeOutline,
        aiCallOptions,
      });
      if (
        repaired.usage.input_tokens != null ||
        repaired.usage.output_tokens != null ||
        repaired.usage.estimated_cost_usd != null
      ) {
        totalInputTokens += repaired.usage.input_tokens ?? 0;
        totalOutputTokens += repaired.usage.output_tokens ?? 0;
        totalEstimatedCostUsd += repaired.usage.estimated_cost_usd ?? 0;
        hasUsageMetrics = true;
      }
      recipe = repaired.recipe;
      normalizedResult = {
        recipe,
        reason: recipe ? null : repaired.reason ?? normalizedResult.reason,
        normalization_log: {
          raw_top_level_keys: normalizedResult.normalization_log.raw_top_level_keys,
          path_taken: "failed",
          missing_fields: normalizedResult.normalization_log.missing_fields,
          repaired_fields: recipe ? ["repair_succeeded"] : ["repair_failed"],
        },
      };
    } catch (repairError) {
      repairFailureContext = {
        repair_error: repairError instanceof Error ? repairError.message : String(repairError),
      };
      recipe = null;
    }
  }

  if (!recipe) {
    const invalidPayloadReason = normalizedResult.reason ?? "AI returned invalid recipe payload.";
    console.error("[homeHub] invalid payload after repair", {
      reason: invalidPayloadReason,
      normalization_log: normalizedResult.normalization_log,
    });
    throw new RecipeBuildError({
      message: invalidPayloadReason,
      kind: "invalid_payload",
      verification: createFailedVerificationResult(invalidPayloadReason, "regenerate_same_model", {
        failure_stage: "parse",
        failure_context: {
          normalization_log: normalizedResult.normalization_log,
          raw_top_level_keys: normalizedResult.normalization_log.raw_top_level_keys,
          parsed_top_level_keys:
            parsed && typeof parsed === "object" && !Array.isArray(parsed) ? Object.keys(parsed as Record<string, unknown>) : [],
          repair_failure: repairFailureContext,
        },
      }),
      reasons: [invalidPayloadReason],
      rawModelOutput: result,
      provider: result.provider,
      model: result.model ?? resolvedModel,
    });
  }

  const structuralValidation = validateRecipeStructure(recipe);
  if (!structuralValidation.passes) {
    const structuralReason = structuralValidation.reasons[0] ?? "Recipe failed structural validation.";
    throw new RecipeBuildError({
      message: structuralReason,
      kind: "structural_validation_failed",
      verification: createFailedVerificationResult(structuralReason, "regenerate_same_model", {
        failure_stage: "schema",
        failure_context: {
          structural_checks: structuralValidation.checks,
          structural_reasons: structuralValidation.reasons,
        },
      }),
      retryStrategy: "regenerate_same_model",
      reasons: structuralValidation.reasons,
      rawModelOutput: result,
      normalizedRecipe: recipe,
      provider: result.provider,
      model: result.model ?? resolvedModel,
    });
  }

  let verification = verifyRecipeAgainstBrief({
    recipe,
    brief: input.cookingBrief,
    fallbackContext: `${input.ideaTitle} ${input.prompt ?? ""} ${formatConversation(input.conversationHistory)}`,
  });
  onStage?.(
    "recipe_verify",
    input.retryContext ? "Checking the revised recipe..." : "Checking that it matches..."
  );
  if (!verification.passes) {
    // Attempt a targeted repair for patchable failures before escalating to a full retry.
    // Only escalate immediately if dish_family_match = false (model built the wrong dish entirely).
    if (!shouldEscalateVerification(verification.checks)) {
      const verificationRepairPlan = buildVerificationRepairPlan(verification, input.cookingBrief);
      if (verificationRepairPlan.instructions.length > 0) {
        try {
          onStage?.("recipe_verify", "Fixing the recipe alignment...");
          const verificationRepairMessages = [
            ...messages,
            { role: "assistant" as const, content: JSON.stringify(recipe) },
            {
              role: "user" as const,
              content: buildScopedRepairPrompt(verificationRepairPlan, "alignment"),
            },
          ];
          const verificationRepairResult = await callAIForJsonWithContract<HomeGeneratedRecipe>(
            verificationRepairMessages,
            (parsed) => {
              const normalized = normalizeGeneratedRecipePayload(parsed, input.ideaTitle);
              return {
                value: normalized.recipe,
                error: normalized.reason,
              };
            },
            aiCallOptions
          );
          if (
            verificationRepairResult.usage.input_tokens != null ||
            verificationRepairResult.usage.output_tokens != null ||
            verificationRepairResult.usage.estimated_cost_usd != null
          ) {
            totalInputTokens += verificationRepairResult.usage.input_tokens ?? 0;
            totalOutputTokens += verificationRepairResult.usage.output_tokens ?? 0;
            totalEstimatedCostUsd += verificationRepairResult.usage.estimated_cost_usd ?? 0;
            hasUsageMetrics = true;
          }
          const repairedVerificationRecipe = verificationRepairResult.contract;
          if (repairedVerificationRecipe) {
            recipe = repairedVerificationRecipe;
            verification = verifyRecipeAgainstBrief({
              recipe,
              brief: input.cookingBrief,
              fallbackContext: `${input.ideaTitle} ${input.prompt ?? ""} ${formatConversation(input.conversationHistory)}`,
            });
          }
        } catch {
          // fail soft — fall through to existing throw
        }
      }
    }

    if (!verification.passes) {
      throw new RecipeBuildError({
        message: verification.reasons[0] ?? "AI recipe drifted from the chef conversation.",
        kind: "verification_failed",
        verification: {
          ...verification,
          failure_stage: "semantic",
          failure_context: {
            checks: verification.checks,
            reasons: verification.reasons,
          },
        },
        rawModelOutput: result,
        normalizedRecipe: recipe,
        provider: result.provider,
        model: result.model ?? resolvedModel,
      });
    }
  }

  // Quality repair pass: fix vague steps, taste violations, and missing quantities.
  // The recipe already passed verification above — if the repair re-check fails we revert
  // to the pre-repair state rather than throwing, so a quality repair never kills a valid build.
  const vagueSteps = recipe.steps.filter((s: { text: string }) => isVagueStep(s.text));
  const disliked = userTasteSummary ? extractDislikedFromSummary(userTasteSummary) : [];
  const violations = findTasteViolations(recipe, disliked);
  const missingQty = findMissingQuantities(recipe.ingredients);

  if (vagueSteps.length > 0 || violations.length > 0 || missingQty.length > 0) {
    const qualityRepairPlan = buildQualityRepairPlan({
      vagueSteps,
      tasteViolations: violations,
      missingQuantities: missingQty,
    });
    try {
      const repairMessages = [
        ...messages,
        { role: "assistant" as const, content: JSON.stringify(parsed) },
        {
          role: "user" as const,
          content: buildScopedRepairPrompt(qualityRepairPlan, "quality"),
        },
      ];
      const repairResult = await callAIForJsonWithContract<HomeGeneratedRecipe>(
        repairMessages,
        (parsed) => {
          const normalized = normalizeGeneratedRecipePayload(parsed, input.ideaTitle);
          return {
            value: normalized.recipe,
            error: normalized.reason,
          };
        },
        aiCallOptions
      );
      if (
        repairResult.usage.input_tokens != null ||
        repairResult.usage.output_tokens != null ||
        repairResult.usage.estimated_cost_usd != null
      ) {
        totalInputTokens += repairResult.usage.input_tokens ?? 0;
        totalOutputTokens += repairResult.usage.output_tokens ?? 0;
        totalEstimatedCostUsd += repairResult.usage.estimated_cost_usd ?? 0;
        hasUsageMetrics = true;
      }
      const repairedRecipe = repairResult.contract;
      if (repairedRecipe) {
        onStage?.("recipe_verify", "Re-checking the corrected recipe...");
        const repairedVerification = verifyRecipeAgainstBrief({
          recipe: repairedRecipe,
          brief: input.cookingBrief,
          fallbackContext: `${input.ideaTitle} ${input.prompt ?? ""} ${formatConversation(input.conversationHistory)}`,
        });
        if (repairedVerification.passes) {
          recipe = repairedRecipe;
          verification = repairedVerification;
        }
        // If the repair drifted the recipe and broke verification, silently keep the
        // pre-repair recipe — it already passed and is good enough to serve.
      }
    } catch {
      // fail soft — use original recipe
    }
  }

  const aiRecipeResult = createAiRecipeResult({
    purpose: "home_recipe",
    source: "ai",
    provider: result.provider,
      model: result.model ?? result.provider,
      cached: false,
      inputHash,
      createdAt: new Date().toISOString(),
      inputTokens: hasUsageMetrics ? totalInputTokens : null,
      outputTokens: hasUsageMetrics ? totalOutputTokens : null,
      estimatedCostUsd: hasUsageMetrics ? Number(totalEstimatedCostUsd.toFixed(6)) : null,
      recipe: {
        ...recipe,
      ingredients: repairRecipeDraftIngredientLines(recipe.ingredients),
      tags: null,
      notes: recipe.chefTips.length > 0 ? recipe.chefTips.map((tip: string) => `• ${tip}`).join("\n") : null,
      change_log: null,
      ai_metadata_json: buildHomeRecipeAiMetadata({
        outline: recipeOutline,
        outlineSource: outlineBuild.source,
        cookingBrief: input.cookingBrief,
        recipePlan: input.recipePlan,
        retryContext: input.retryContext,
      }),
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
