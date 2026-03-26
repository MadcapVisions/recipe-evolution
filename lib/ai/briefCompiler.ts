import type { AIMessage, RecipeContext } from "./chatPromptBuilder";
import { createEmptyCookingBrief, type CookingBrief } from "./contracts/cookingBrief";
import type { LockedDirectionSession } from "./contracts/lockedDirectionSession";
import { sanitizeCookingBriefIngredients } from "./briefSanitization";
import { parseIngredientPhrase } from "./ingredientParsing";
import { deriveIdeaTitleFromConversationContext, detectRequestedDishFamily } from "./homeRecipeAlignment";
import { deriveBriefRequestMode } from "./briefStateMachine";
import { extractRefinementDelta } from "./refinementExtractor";

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}

export function isGenericCenterpieceTitle(s: string): boolean {
  return s === "Chef Conversation Recipe" || /^chef\s/i.test(s) || /\sDish$/.test(s);
}

export function deriveCanonicalCenterpiece(input: {
  normalizedName: string | null;
  recipeTitle?: string | null;
  userMessage: string;
}) {
  const candidate =
    input.normalizedName?.trim() ||
    input.recipeTitle?.trim() ||
    input.userMessage.trim();

  if (!candidate) {
    return null;
  }

  const canonical = deriveIdeaTitleFromConversationContext(candidate);
  // Accept canonical only when it is specific — skip generic fallbacks which lose
  // the actual dish name (e.g. "Mushroom Dish" from "make mushroom risotto").
  if (canonical && !isGenericCenterpieceTitle(canonical) && canonical !== "Tacos" && canonical !== "Pizza") {
    return canonical;
  }

  // Canonical was generic — prefer specific sources in order: normalizedName (if non-generic),
  // then recipeTitle, then strip "with ..." from the raw candidate.
  const specifics = [input.normalizedName?.trim(), input.recipeTitle?.trim()].filter(
    (s): s is string => typeof s === "string" && s.length > 0 && !isGenericCenterpieceTitle(s)
  );
  for (const specific of specifics) {
    const stripped = specific.replace(/\s+with\s+.+$/i, "").trim();
    if (stripped) return stripped;
  }

  const stripped = candidate.replace(/\s+with\s+.+$/i, "").trim();
  // Allow single-word stripped results (e.g. "Flatbread with Tomato" → "Flatbread").
  // Generic dish-format words like "Bowl" and "Skillet" are in CENTERPIECE_STOP_WORDS in the
  // verifier, so they produce no token constraint and pass trivially there.
  if (stripped && !isGenericCenterpieceTitle(stripped)) {
    return stripped;
  }
  return null;
}

const REQUIRED_INGREDIENT_STOP_WORDS = new Set([
  "make",
  "keep",
  "stay",
  "be",
  "nice",
  "spicy",
  "bright",
  "crunchy",
  "crispy",
  "quick",
  "traditional",
  "extra",
  "more",
  "less",
  // Quality/attribute words that can appear in conversational phrases like
  // "make sure it has great depth of flavor" — these are never ingredient names
  "great",
  "good",
  "depth",
  "flavor",
  "flavour",
  "taste",
  "texture",
  "rich",
  "complex",
  "delicious",
  "perfect",
  "balance",
  "quality",
  // Equipment / method words — "use a slow cooker" should not extract "slow cooker"
  "cooker",
  "crockpot",
  "skillet",
  "blender",
  "processor",
  "air fryer",
  "instant pot",
]);

function splitIngredientCandidates(value: string) {
  return value
    .split(/,|\band\b/gi)
    .map((item) => item.trim().replace(/^with\s+/i, ""))
    .map((item) => parseIngredientPhrase(item))
    .filter((item): item is string => Boolean(item))
    .filter((item) => item.split(/\s+/).length <= 4)
    .filter((item) => {
      const normalized = normalizeText(item);
      return !Array.from(REQUIRED_INGREDIENT_STOP_WORDS).some((token) => normalized.includes(token));
    });
}

function extractExplicitRequiredIngredients(text: string) {
  const normalized = normalizeText(text);
  const results: string[] = [];
  const patterns = [
    /\bcan we add ([\p{L}][\p{L}\s,-]{1,60}?)(?=(?:\s+and\s+(?:make|keep|stay|be|skip|leave out|remove|avoid)\b|[.!?]|$))/gu,
    /\badd ([\p{L}][\p{L}\s,-]{1,60}?)(?=(?:\s+and\s+(?:make|keep|stay|be|skip|leave out|remove|avoid)\b|[.!?]|$))/gu,
    /\bmake sure (?:it|this|the dish|the recipe) has ([\p{L}][\p{L}\s,-]{1,60}?)(?=(?:\s+and\s+(?:make|keep|stay|be|skip|leave out|remove|avoid)\b|[.!?]|$))/gu,
    /\bmust have ([\p{L}][\p{L}\s,-]{1,60}?)(?=(?:[.!?]|$))/gu,
    /\bneeds? ([\p{L}][\p{L}\s,-]{1,60}?)(?=(?:[.!?]|$))/gu,
    /\binclude ([\p{L}][\p{L}\s,-]{1,60}?)(?=(?:[.!?]|$))/gu,
    // "use some sourdough discard", "use sourdough discard in the recipe"
    /\buse (?:some |up (?:some |the |my )?|a bit of |a little |the |my )?([\p{L}][\p{L}\s-]{1,40}?)(?=\s+(?:in|for|to|when|if|as|with|and|or|while|into|over|at)\b|[.,!?]|$)/gu,
    // "using some sourdough discard", "using the leftover cream"
    /\busing (?:some |the |my )?([\p{L}][\p{L}\s-]{1,40}?)(?=\s+(?:in|for|to|when|if|as|with|and|or|while|into|over|at)\b|[.,!?]|$)/gu,
    // "want to use some X", "would like to use X"
    /\bwant(?:ing)? to use (?:some |the |my )?([\p{L}][\p{L}\s-]{1,40}?)(?=\s+(?:in|for|to|when|if|as|with|and|or|while|into|over|at)\b|[.,!?]|$)/gu,
    /\bwould like to use (?:some |the |my )?([\p{L}][\p{L}\s-]{1,40}?)(?=\s+(?:in|for|to|when|if|as|with|and|or|while|into|over|at)\b|[.,!?]|$)/gu,
    // "make it with X", "make this with X"
    /\bmake (?:it|this|the recipe|the dish) with ([\p{L}][\p{L}\s-]{1,40}?)(?=\s+(?:in|for|to|when|if|as|and|or|while|instead|but)\b|[.,!?]|$)/gu,
  ];

  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const candidate = (match[1] ?? "").trim();
      if (candidate.length > 0) {
        results.push(...splitIngredientCandidates(candidate));
      }
    }
  }

  return unique(results);
}

function extractForbiddenIngredients(text: string) {
  const normalized = normalizeText(text);
  const results: string[] = [];
  const noMatches = Array.from(
    normalized.matchAll(/\bno\s+([a-z][a-z\s-]{1,30}?)(?=(?:\s*,|\s+and\s+no\b|\s+but\b|\s+with\b|$))/g)
  );
  for (const match of noMatches) {
    const candidate = (match[1] ?? "").trim();
    if (candidate.length > 1) {
      const parsed = parseIngredientPhrase(candidate);
      if (parsed) {
        results.push(parsed);
      }
    }
  }
  return unique(results);
}

function extractTimeMaxMinutes(text: string) {
  const directMatch = text.match(/\b(?:in|under|within|less than|no more than)\s+(\d{1,3})\s*(?:minutes|min)\b/i);
  if (directMatch) {
    return Number(directMatch[1]);
  }

  const standaloneMinutes = text.match(/\b(\d{1,3})[\s-]?(?:minute|minutes|min)\b/i);
  if (standaloneMinutes) {
    return Number(standaloneMinutes[1]);
  }

  if (/\bhalf an hour\b/i.test(text)) {
    return 30;
  }

  if (/\ban hour\b/i.test(text)) {
    return 60;
  }

  return null;
}

function extractDietaryTags(text: string) {
  const normalized = normalizeText(text);
  const tags = ["vegetarian", "vegan", "gluten free", "dairy free", "high protein", "low carb"];
  return tags.filter((tag) => normalized.includes(tag) || normalized.includes(tag.replace(" ", "-")));
}

function extractFormatTags(text: string) {
  const normalized = normalizeText(text);
  const tags = ["sheet-pan", "focaccia-style", "flatbread-style", "traditional", "weeknight"];
  return tags.filter((tag) => normalized.includes(tag.replace("-", " ")) || normalized.includes(tag));
}

function extractStyleTags(text: string) {
  const normalized = normalizeText(text);
  const tags = ["spicy", "bright", "crispy", "crunchy", "creamy", "traditional", "lighter", "richer", "heartier"];
  return tags.filter((tag) => normalized.includes(tag));
}

function extractTextureTags(text: string) {
  const normalized = normalizeText(text);
  const tags = ["crispy", "airy", "chewy", "creamy", "delicate", "bright"];
  return tags.filter((tag) => normalized.includes(tag));
}

function inferConfidence(input: {
  dishFamily: string | null;
  normalizedName: string | null;
  recipeContext: RecipeContext;
  lockedSessionState?: LockedDirectionSession["state"] | null;
}) {
  if (input.lockedSessionState === "direction_locked" || input.lockedSessionState === "ready_to_build" || input.lockedSessionState === "built") {
    return 0.92;
  }
  if (input.recipeContext?.title && input.dishFamily) return 0.86;
  if (input.dishFamily && input.normalizedName) return 0.78;
  if (input.dishFamily) return 0.66;
  return 0.45;
}

export function compileCookingBrief(input: {
  userMessage: string;
  assistantReply?: string;
  conversationHistory?: AIMessage[];
  recipeContext?: RecipeContext;
  sourceTurnIds?: string[];
  lockedSessionState?: LockedDirectionSession["state"] | null;
  latestAssistantMode?: "options" | "refine" | null;
}): CookingBrief {
  const conversationHistory = input.conversationHistory ?? [];
  const assistantReply = input.assistantReply?.trim() ?? "";
  const recipeContext = input.recipeContext ?? null;
  const conversationText = [
    ...conversationHistory.map((message) => `${message.role === "user" ? "User" : "Chef"}: ${message.content}`),
    input.userMessage ? `User: ${input.userMessage}` : "",
    assistantReply ? `Chef: ${assistantReply}` : "",
    recipeContext?.title ? `Recipe Context Title: ${recipeContext.title}` : "",
    recipeContext?.ingredients?.length ? `Recipe Context Ingredients: ${recipeContext.ingredients.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // Hard constraints (required/forbidden ingredients) are derived only from
  // user-authored turns. Including assistant replies and recipe-context text
  // causes model-suggested ingredients to be promoted into must-have
  // requirements as if the user explicitly asked for them.
  const userOnlyText = [
    ...conversationHistory.filter((m) => m.role === "user").map((m) => m.content),
    input.userMessage,
  ]
    .filter(Boolean)
    .join("\n");

  const dishFamily = detectRequestedDishFamily(conversationText);
  const normalizedName = deriveIdeaTitleFromConversationContext(conversationText);
  const forbiddenIngredients = extractForbiddenIngredients(userOnlyText);
  const latestUserDelta = input.userMessage
    ? extractRefinementDelta({
        userText: input.userMessage,
        assistantText: assistantReply || null,
      })
    : null;
  const requiredIngredients = unique([
    ...extractExplicitRequiredIngredients(userOnlyText),
    ...(latestUserDelta?.extracted_changes.required_ingredients ?? []),
  ]);
  const mergedForbiddenIngredients = unique([
    ...forbiddenIngredients,
    ...(latestUserDelta?.extracted_changes.forbidden_ingredients ?? []),
  ]);
  const brief = createEmptyCookingBrief();
  const hasDishSignal = Boolean(
    dishFamily ||
      (normalizedName && normalizedName !== "Chef Conversation Recipe") ||
      recipeContext?.title?.trim()
  );
  const hasConstraintSignal =
    forbiddenIngredients.length > 0 ||
    requiredIngredients.length > 0 ||
    extractTimeMaxMinutes(userOnlyText) != null ||
    extractDietaryTags(userOnlyText).length > 0;
  const requestMode = deriveBriefRequestMode({
    latestUserMessage: input.userMessage,
    conversationHistory,
    lockedSessionState: input.lockedSessionState,
    latestAssistantMode: input.latestAssistantMode ?? null,
    hasDishSignal,
    hasConstraintSignal,
  });
  const confidence = inferConfidence({
    dishFamily,
    normalizedName,
    recipeContext,
    lockedSessionState: input.lockedSessionState,
  });

  brief.request_mode = requestMode;
  brief.confidence = confidence;
  brief.ambiguity_reason = confidence < 0.65 ? "Low-confidence dish interpretation." : null;
  brief.dish = {
    raw_user_phrase: input.userMessage.trim() || null,
    normalized_name:
      normalizedName === "Chef Conversation Recipe" || (normalizedName !== null && /\sDish$/.test(normalizedName))
        ? recipeContext?.title?.trim() || (normalizedName !== "Chef Conversation Recipe" ? normalizedName : null)
        : normalizedName,
    dish_family: dishFamily,
    cuisine: null,
    course: null,
    authenticity_target: normalizeText(conversationText).includes("traditional") ? "traditional" : null,
  };
  brief.style = {
    tags: unique(extractStyleTags(conversationText)),
    texture_tags: unique(extractTextureTags(conversationText)),
    format_tags: unique(extractFormatTags(conversationText)),
  };
  brief.ingredients = {
    required: requiredIngredients,
    preferred: unique(recipeContext?.ingredients ?? []),
    forbidden: mergedForbiddenIngredients,
    centerpiece: deriveCanonicalCenterpiece({
      normalizedName: brief.dish.normalized_name,
      recipeTitle: recipeContext?.title,
      userMessage: input.userMessage,
    }),
  };
  brief.constraints = {
    servings: null,
    time_max_minutes: extractTimeMaxMinutes(userOnlyText),
    difficulty_target: null,
    dietary_tags: extractDietaryTags(userOnlyText),
    equipment_limits: [],
  };
  brief.directives = {
    must_have: unique([...(dishFamily ? [dishFamily] : []), ...brief.style.tags, ...brief.ingredients.required]),
    nice_to_have: [],
    must_not_have: mergedForbiddenIngredients,
    required_techniques: dishFamily === "pizza" ? ["bake"] : [],
  };
  brief.field_state = {
    dish_family: dishFamily ? (requestMode === "locked" ? "locked" : "inferred") : "unknown",
    normalized_name: brief.dish.normalized_name ? (requestMode === "locked" ? "locked" : "inferred") : "unknown",
    cuisine: "unknown",
    ingredients:
      brief.ingredients.required.length > 0 ||
      brief.ingredients.preferred.length > 0 ||
      brief.ingredients.forbidden.length > 0
        ? "inferred"
        : "unknown",
    constraints: brief.constraints.time_max_minutes != null || brief.constraints.dietary_tags.length > 0 ? "inferred" : "unknown",
  };
  brief.source_turn_ids = input.sourceTurnIds ?? [];
  brief.compiler_notes = [
    recipeContext?.title ? "Recipe context was included in brief compilation." : "Compiled from conversation text only.",
    input.lockedSessionState ? `Locked session state: ${input.lockedSessionState}.` : "No locked session state provided.",
    `Resolved request mode: ${requestMode}.`,
  ];

  return sanitizeCookingBriefIngredients(brief);
}
