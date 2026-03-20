"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateHomeIdeasWithCache = generateHomeIdeasWithCache;
exports.generateHomeRecipe = generateHomeRecipe;
const jsonResponse_1 = require("./jsonResponse");
const recipeResult_1 = require("./recipeResult");
const cache_1 = require("./cache");
const recipeDraft_1 = require("../recipes/recipeDraft");
const taskSettings_1 = require("./taskSettings");
const homeRecipeAlignment_1 = require("./homeRecipeAlignment");
const recipeVerifier_1 = require("./recipeVerifier");
const recipeBuildError_1 = require("./recipeBuildError");
const verificationResult_1 = require("./contracts/verificationResult");
const homeRecipeRetry_1 = require("./homeRecipeRetry");
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
function isVagueStep(text) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length < 10)
        return true;
    const lower = text.toLowerCase();
    return !Array.from(ACTIONABLE_COOKING_VERBS).some((verb) => lower.includes(verb));
}
// --- Taste profile helpers (Item 8) ---
function extractDislikedFromSummary(tasteSummary) {
    const match = tasteSummary.match(/\bAvoid\s+([^.]+)\./i);
    if (!match?.[1])
        return [];
    return match[1].split(/,\s+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
}
function findTasteViolations(recipe, disliked) {
    if (disliked.length === 0)
        return [];
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
const toTitleCase = (value) => value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
const FORBIDDEN_TITLE_TERMS = new Set(["build", "built", "user", "interested", "idea", "recipe", "version", "special", "chef"]);
function formatConversation(conversationHistory) {
    return (conversationHistory ?? [])
        .filter((message) => message.role === "user" || message.role === "assistant")
        .map((message) => `${message.role === "user" ? "User" : "Chef"}: ${message.content.trim()}`)
        .join("\n");
}
function extractSeedLabel(input) {
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
        .map((token) => token.trim())
        .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
        .slice(0, 3);
    if (tokens.length === 0) {
        return "Chef Special";
    }
    return toTitleCase(tokens.join(" "));
}
function sanitizeIdeaTitle(rawTitle) {
    return toTitleCase(rawTitle
        .replace(/[^\w\s&/-]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .filter((word) => !FORBIDDEN_TITLE_TERMS.has(word.toLowerCase()))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim());
}
function deriveIdeaTitle(rawTitle, description, input) {
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
function buildFallbackIdeas(input, count = 6) {
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
    const out = [];
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
function normalizeIdeas(value, input) {
    const rawIdeas = typeof value === "object" && value !== null && Array.isArray(value.ideas)
        ? value.ideas
        : Array.isArray(value)
            ? value
            : [];
    const ideas = [];
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
        const raw = item;
        const title = typeof raw.title === "string" ? raw.title.trim() : "";
        if (!title) {
            continue;
        }
        ideas.push({
            title: deriveIdeaTitle(title, typeof raw.description === "string" ? raw.description : "", input),
            description: typeof raw.description === "string" && raw.description.trim().length > 0
                ? raw.description.trim()
                : "A practical, flavor-forward recipe idea shaped around your request.",
            cook_time_min: typeof raw.cook_time_min === "number" ? Math.round(raw.cook_time_min) : 30,
        });
    }
    return ideas;
}
function normalizeRecipe(value, fallbackTitle) {
    if (!value || typeof value !== "object") {
        return null;
    }
    const raw = value;
    const ingredients = Array.isArray(raw.ingredients)
        ? raw.ingredients
            .map((item) => {
            if (typeof item === "string") {
                return { name: item.trim() };
            }
            if (item && typeof item === "object" && typeof item.name === "string") {
                const ingredient = item;
                const rawUnit = typeof ingredient.unit === "string" ? ingredient.unit.trim().toLowerCase() : null;
                const unit = rawUnit && rawUnit !== "count" && rawUnit !== "piece" && rawUnit !== "pieces" ? ingredient.unit.trim() : null;
                const rawPrep = typeof ingredient.prep === "string" ? ingredient.prep.trim() : null;
                const JUNK_PREP = new Set(["none", "n/a", "-", "null", "na"]);
                const prep = rawPrep && !JUNK_PREP.has(rawPrep.toLowerCase()) ? rawPrep : null;
                return {
                    name: (0, recipeDraft_1.formatIngredientLine)({
                        name: ingredient.name,
                        quantity: typeof ingredient.quantity === "number" ? ingredient.quantity : null,
                        unit,
                        prep,
                    }) || ingredient.name.trim(),
                };
            }
            return null;
        })
            .filter((item) => item !== null && item.name.length > 0)
        : [];
    const steps = Array.isArray(raw.steps)
        ? raw.steps
            .map((item) => {
            if (typeof item === "string") {
                return { text: item.trim() };
            }
            if (item && typeof item === "object" && typeof item.text === "string") {
                return { text: item.text.trim() };
            }
            return null;
        })
            .filter((item) => item !== null && item.text.length > 0)
        : [];
    if (ingredients.length === 0 || steps.length === 0) {
        return null;
    }
    const title = typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : fallbackTitle;
    const chefTips = Array.isArray(raw.chefTips)
        ? raw.chefTips
            .filter((tip) => typeof tip === "string" && tip.trim().length > 0)
            .map((tip) => tip.trim())
            .slice(0, 3)
        : [];
    return {
        title,
        description: typeof raw.description === "string" ? raw.description.trim() || null : null,
        servings: typeof raw.servings === "number" ? Math.round(raw.servings) : 4,
        prep_time_min: typeof raw.prep_time_min === "number" ? Math.round(raw.prep_time_min) : 15,
        cook_time_min: typeof raw.cook_time_min === "number" ? Math.round(raw.cook_time_min) : 30,
        difficulty: typeof raw.difficulty === "string" && raw.difficulty.trim()
            ? raw.difficulty.trim().charAt(0).toUpperCase() + raw.difficulty.trim().slice(1).toLowerCase()
            : "Easy",
        ingredients,
        steps,
        chefTips,
    };
}
function recipeMatchesConversation(recipe, input) {
    const briefContext = input.cookingBrief
        ? `${input.cookingBrief.dish.normalized_name ?? ""} ${input.cookingBrief.dish.dish_family ?? ""} ${(input.cookingBrief.directives.must_have ?? []).join(" ")} ${(input.cookingBrief.directives.must_not_have ?? []).join(" ")}`
        : "";
    const context = `${input.ideaTitle} ${input.prompt ?? ""} ${briefContext} ${formatConversation(input.conversationHistory)} ${(input.ingredients ?? []).join(" ")}`;
    return (0, homeRecipeAlignment_1.recipeMatchesRequestedDirection)(recipe, context);
}
function buildIdeasPrompt(input) {
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
function isHomeIdeaList(value) {
    return (Array.isArray(value) &&
        value.every((item) => item &&
            typeof item === "object" &&
            typeof item.title === "string" &&
            typeof item.description === "string" &&
            (typeof item.cook_time_min === "number" ||
                item.cook_time_min === null)));
}
function isGeneratedRecipe(value) {
    return (Boolean(value) &&
        typeof value === "object" &&
        typeof value.title === "string" &&
        Array.isArray(value.ingredients) &&
        Array.isArray(value.steps));
}
async function generateHomeIdeasWithCache(input, userTasteSummary, cacheContext) {
    const inputHash = cacheContext
        ? (0, cache_1.hashAiCacheInput)({
            input,
            userTasteSummary: userTasteSummary?.trim() || null,
        })
        : null;
    if (cacheContext && inputHash) {
        const cached = await (0, cache_1.readAiCache)(cacheContext.supabase, cacheContext.userId, "home_ideas", inputHash);
        if (cached && isHomeIdeaList(cached.response_json)) {
            return cached.response_json;
        }
    }
    const messages = [
        {
            role: "system",
            content: `You are a recipe ideation assistant. Return only valid JSON. Keep titles distinct and natural. Keep ideas practical for a home cook.
Priority order:
1. Chef conversation and the user's most recent confirmed direction
2. User taste summary
User taste summary: ${userTasteSummary?.trim() || "No user taste summary available."}`,
        },
        {
            role: "user",
            content: buildIdeasPrompt(input),
        },
    ];
    try {
        const taskSetting = await (0, taskSettings_1.resolveAiTaskSettings)("home_ideas");
        if (!taskSetting.enabled) {
            throw new Error("Home ideas AI task is disabled.");
        }
        const result = await (0, jsonResponse_1.callAIForJson)(messages, {
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
            await (0, cache_1.writeAiCache)(cacheContext.supabase, cacheContext.userId, "home_ideas", inputHash, result.model ?? result.provider, resolved);
        }
        return resolved;
    }
    catch {
        return buildFallbackIdeas(input, input.requestedCount ?? (input.mode === "filtered_ideas" ? 5 : 6));
    }
}
async function repairMalformedRecipePayload(input) {
    const repairMessages = [
        {
            role: "system",
            content: `You repair malformed AI recipe drafts.
Return ONLY valid JSON:
{
  "title": string,
  "description": string|null,
  "servings": number|null,
  "prep_time_min": number|null,
  "cook_time_min": number|null,
  "difficulty": string|null,
  "ingredients": [{ "name": string, "quantity": number, "unit": string|null, "prep": string|null }],
  "steps": [{ "text": string }],
  "chefTips": string[]
}
Rules:
- Preserve the original dish identity and requested format exactly.
- Preserve named dishes and regional dishes exactly instead of renaming them generically.
- Every ingredient must include an explicit quantity.
- Do not explain what you changed.
- Do not use markdown fences.
- Salvage the draft into valid recipe JSON instead of drifting to a different dish.`,
        },
        {
            role: "user",
            content: `Repair this malformed recipe draft into valid JSON.
Idea: ${input.ideaTitle}
Prompt context: ${input.prompt ?? ""}
Structured cooking brief:
${input.cookingBrief ? JSON.stringify(input.cookingBrief, null, 2) : "No structured cooking brief available."}
Structured recipe plan:
${input.recipePlan ? JSON.stringify(input.recipePlan, null, 2) : "No structured recipe plan available."}
Conversation context:
${formatConversation(input.conversationHistory) || "No chef conversation available."}
Malformed recipe draft:
${input.rawText}`,
        },
    ];
    const repairResult = await (0, jsonResponse_1.callAIForJson)(repairMessages, input.aiCallOptions);
    return {
        recipe: normalizeRecipe(repairResult.parsed, input.ideaTitle),
        usage: repairResult.usage,
    };
}
async function generateHomeRecipe(input, userTasteSummary, cacheContext, onStage) {
    const inputHash = cacheContext
        ? (0, cache_1.hashAiCacheInput)({
            input,
            userTasteSummary: userTasteSummary?.trim() || null,
        })
        : null;
    if (cacheContext && inputHash) {
        const cached = await (0, cache_1.readAiCache)(cacheContext.supabase, cacheContext.userId, "home_recipe", inputHash);
        if (cached) {
            const parsedCached = (0, recipeResult_1.parseAiRecipeResult)(cached.response_json);
            if (parsedCached) {
                return parsedCached;
            }
            if (isGeneratedRecipe(cached.response_json)) {
                return (0, recipeResult_1.createAiRecipeResult)({
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
            role: "system",
            content: `You are a professional recipe developer.
Priority order:
1. Chef conversation and the user's most recent confirmed direction
2. User taste summary
User taste summary: ${userTasteSummary?.trim() || "No user taste summary available."}
Structured cooking brief: ${input.cookingBrief ? JSON.stringify(input.cookingBrief) : "No structured cooking brief available."}
Structured recipe plan: ${input.recipePlan ? JSON.stringify(input.recipePlan) : "No structured recipe plan available."}
Retry instructions: ${input.retryContext
                ? (0, homeRecipeRetry_1.buildRetryInstructions)({
                    retryStrategy: input.retryContext.retryStrategy,
                    reasons: input.retryContext.reasons,
                    attemptNumber: input.retryContext.attemptNumber,
                }).join(" ")
                : "No retry instructions."}
Return ONLY valid JSON:
{
  "title": string,
  "description": string|null,
  "servings": number|null,
  "prep_time_min": number|null,
  "cook_time_min": number|null,
  "difficulty": string|null,
  "ingredients": [{ "name": string, "quantity": number, "unit": string|null, "prep": string|null }],
  "steps": [{ "text": string }],
  "chefTips": string[]
}
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
            role: "user",
            content: `Generate a full recipe for this selected idea:
Idea: ${input.ideaTitle}
Prompt context: ${input.prompt ?? ""}
Structured cooking brief:
${input.cookingBrief ? JSON.stringify(input.cookingBrief, null, 2) : "No structured cooking brief available."}
Structured recipe plan:
${input.recipePlan ? JSON.stringify(input.recipePlan, null, 2) : "No structured recipe plan available."}
Retry instructions:
${input.retryContext
                ? (0, homeRecipeRetry_1.buildRetryInstructions)({
                    retryStrategy: input.retryContext.retryStrategy,
                    reasons: input.retryContext.reasons,
                    attemptNumber: input.retryContext.attemptNumber,
                }).join("\n")
                : "No retry instructions."}
Conversation context:
${formatConversation(input.conversationHistory) || "No chef conversation available."}
Ingredients context: ${JSON.stringify(input.ingredients ?? [])}`,
        },
    ];
    const taskSetting = await (0, taskSettings_1.resolveAiTaskSettings)("home_recipe");
    if (!taskSetting.enabled) {
        throw new Error("Home recipe AI task is disabled.");
    }
    const aiCallOptions = {
        max_tokens: taskSetting.maxTokens,
        temperature: taskSetting.temperature,
        model: taskSetting.primaryModel,
        fallback_models: taskSetting.fallbackModel ? [taskSetting.fallbackModel] : [],
    };
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalEstimatedCostUsd = 0;
    let hasUsageMetrics = false;
    onStage?.("recipe_generate", input.retryContext ? "Retrying the recipe with tighter constraints..." : "Writing the recipe...");
    const result = await (0, jsonResponse_1.callAIForJson)(messages, aiCallOptions);
    if (result.usage.input_tokens != null || result.usage.output_tokens != null || result.usage.estimated_cost_usd != null) {
        totalInputTokens += result.usage.input_tokens ?? 0;
        totalOutputTokens += result.usage.output_tokens ?? 0;
        totalEstimatedCostUsd += result.usage.estimated_cost_usd ?? 0;
        hasUsageMetrics = true;
    }
    const { parsed } = result;
    let recipe = normalizeRecipe(parsed, input.ideaTitle);
    if (!recipe) {
        onStage?.("recipe_generate", "Repairing malformed recipe output...");
        try {
            const repaired = await repairMalformedRecipePayload({
                rawText: result.text,
                ideaTitle: input.ideaTitle,
                prompt: input.prompt,
                conversationHistory: input.conversationHistory,
                cookingBrief: input.cookingBrief,
                recipePlan: input.recipePlan,
                aiCallOptions,
            });
            if (repaired.usage.input_tokens != null ||
                repaired.usage.output_tokens != null ||
                repaired.usage.estimated_cost_usd != null) {
                totalInputTokens += repaired.usage.input_tokens ?? 0;
                totalOutputTokens += repaired.usage.output_tokens ?? 0;
                totalEstimatedCostUsd += repaired.usage.estimated_cost_usd ?? 0;
                hasUsageMetrics = true;
            }
            recipe = repaired.recipe;
        }
        catch {
            recipe = null;
        }
    }
    if (!recipe) {
        throw new recipeBuildError_1.RecipeBuildError({
            message: "AI returned invalid recipe payload.",
            kind: "invalid_payload",
            verification: (0, verificationResult_1.createFailedVerificationResult)("AI returned invalid recipe payload.", "regenerate_same_model"),
        });
    }
    let verification = (0, recipeVerifier_1.verifyRecipeAgainstBrief)({
        recipe,
        brief: input.cookingBrief,
        fallbackContext: `${input.ideaTitle} ${input.prompt ?? ""} ${formatConversation(input.conversationHistory)}`,
    });
    onStage?.("recipe_verify", input.retryContext ? "Checking the revised recipe..." : "Checking that it matches...");
    if (!verification.passes) {
        throw new recipeBuildError_1.RecipeBuildError({
            message: verification.reasons[0] ?? "AI recipe drifted from the chef conversation.",
            kind: "verification_failed",
            verification,
        });
    }
    // Quality repair pass: fix vague steps (Item 7) and taste violations (Item 8)
    const vagueSteps = recipe.steps.filter((s) => isVagueStep(s.text));
    const disliked = userTasteSummary ? extractDislikedFromSummary(userTasteSummary) : [];
    const violations = findTasteViolations(recipe, disliked);
    if (vagueSteps.length > 0 || violations.length > 0) {
        const repairs = [];
        if (vagueSteps.length > 0) {
            repairs.push(`Expand these vague steps — each must include an actionable verb, technique, and timing or doneness cues (minimum 10 words): ${vagueSteps.map((s) => `"${s.text}"`).join("; ")}.`);
        }
        if (violations.length > 0) {
            repairs.push(`The user dislikes: ${violations.join(", ")}. Remove these ingredients and substitute a compatible alternative that preserves the dish format and flavor direction.`);
        }
        try {
            const repairMessages = [
                ...messages,
                { role: "assistant", content: JSON.stringify(parsed) },
                {
                    role: "user",
                    content: `Fix these quality issues in the recipe:\n${repairs.join("\n")}\nReturn the corrected recipe using the same JSON format.`,
                },
            ];
            const repairResult = await (0, jsonResponse_1.callAIForJson)(repairMessages, aiCallOptions);
            if (repairResult.usage.input_tokens != null ||
                repairResult.usage.output_tokens != null ||
                repairResult.usage.estimated_cost_usd != null) {
                totalInputTokens += repairResult.usage.input_tokens ?? 0;
                totalOutputTokens += repairResult.usage.output_tokens ?? 0;
                totalEstimatedCostUsd += repairResult.usage.estimated_cost_usd ?? 0;
                hasUsageMetrics = true;
            }
            const repairedRecipe = normalizeRecipe(repairResult.parsed, input.ideaTitle);
            if (repairedRecipe) {
                recipe = repairedRecipe;
                onStage?.("recipe_verify", "Re-checking the corrected recipe...");
                verification = (0, recipeVerifier_1.verifyRecipeAgainstBrief)({
                    recipe,
                    brief: input.cookingBrief,
                    fallbackContext: `${input.ideaTitle} ${input.prompt ?? ""} ${formatConversation(input.conversationHistory)}`,
                });
            }
        }
        catch {
            // fail soft — use original recipe
        }
    }
    if (!verification.passes) {
        throw new recipeBuildError_1.RecipeBuildError({
            message: verification.reasons[0] ?? "AI recipe failed verification.",
            kind: "verification_failed",
            verification,
        });
    }
    const aiRecipeResult = (0, recipeResult_1.createAiRecipeResult)({
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
            tags: null,
            notes: recipe.chefTips.length > 0 ? recipe.chefTips.map((tip) => `• ${tip}`).join("\n") : null,
            change_log: null,
            ai_metadata_json: null,
        },
    });
    if (cacheContext && inputHash) {
        await (0, cache_1.writeAiCache)(cacheContext.supabase, cacheContext.userId, "home_recipe", inputHash, result.model ?? result.provider, aiRecipeResult);
    }
    return aiRecipeResult;
}
