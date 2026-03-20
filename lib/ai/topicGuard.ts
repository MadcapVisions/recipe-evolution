import type { RecipeContext } from "./chatPromptBuilder";

const COOKING_KEYWORDS = [
  "cook",
  "cooking",
  "recipe",
  "dish",
  "meal",
  "dinner",
  "lunch",
  "breakfast",
  "brunch",
  "snack",
  "appetizer",
  "dessert",
  "side",
  "side dish",
  "ingredient",
  "ingredients",
  "pantry",
  "leftover",
  "leftovers",
  "grocery",
  "groceries",
  "shopping list",
  "meal prep",
  "prep",
  "make ahead",
  "freezer",
  "batch cook",
  "bake",
  "roast",
  "sear",
  "saute",
  "simmer",
  "boil",
  "grill",
  "broil",
  "steam",
  "air fryer",
  "sheet pan",
  "oven",
  "stovetop",
  "skillet",
  "pot",
  "pan",
  "sauce",
  "sauces",
  "dip",
  "dipping",
  "salsa",
  "queso",
  "guacamole",
  "dressing",
  "marinade",
  "seasoning",
  "season",
  "flavor",
  "flavour",
  "spice",
  "substitute",
  "substitution",
  "swap",
  "pairing",
  "pair with",
  "serve",
  "serving",
  "serves",
  "servings",
  "scale",
  "double",
  "halve",
  "timing",
  "kitchen",
  "knife",
  "dice",
  "slice",
  "chop",
  "mince",
  "protein",
  "carbs",
  "calories",
  "vegetarian",
  "vegan",
  "gluten-free",
  "dairy-free",
];

const FOOD_TERMS = [
  "chicken",
  "beef",
  "pork",
  "turkey",
  "salmon",
  "shrimp",
  "tofu",
  "rice",
  "pasta",
  "noodle",
  "potato",
  "egg",
  "beans",
  "lentils",
  "broth",
  "stock",
  "salad",
  "soup",
  "taco",
  "tortilla",
  "chips",
  "sandwich",
  "pizza",
  "burger",
  "bowl",
  "garlic",
  "onion",
  "tomato",
  "lemon",
  "lime",
  "herb",
  "cheese",
  "butter",
  "olive oil",
  "vinegar",
  "chili",
  "cumin",
  "paprika",
  "basil",
  "cilantro",
  "corn",
  "cabbage",
  "avocado",
  "yogurt",
  "jalapeño",
  "jalapeños",
  "serrano",
  "chipotle",
];

const OFF_TOPIC_KEYWORDS = [
  "javascript",
  "typescript",
  "python",
  "react",
  "nextjs",
  "css",
  "html",
  "sql",
  "debug",
  "bug",
  "compile",
  "interview",
  "resume",
  "cover letter",
  "essay",
  "homework",
  "math",
  "algebra",
  "physics",
  "politics",
  "election",
  "president",
  "mortgage",
  "mortgage rates",
  "crypto",
  "bitcoin",
  "ethereum",
  "tax",
  "taxes",
  "legal",
  "lawyer",
  "doctor",
  "medical",
  "therapy",
  "dating",
  "girlfriend",
  "boyfriend",
  "horoscope",
  "travel itinerary",
  "airline",
  "flight",
  "flights",
  "airline tickets",
  "vacation",
  "poem",
  "story",
  "translate",
  "joke",
];

const STRONG_OFF_TOPIC_PATTERNS = [
  /\b(?:airline|flight|flights|airfare|ticket|tickets)\b/,
  /\bmortgage(?: rates?)?\b/,
  /\bwhat (?:are|is) today'?s\b.*\b(?:rate|rates|mortgage|stocks?)\b/,
  /\b(?:react|typescript|javascript|python|css|html|sql)\b/,
  /\b(?:write|fix|debug|build)\b.*\b(?:component|code|app|script|query)\b/,
  /\b(?:stocks?|crypto|bitcoin|ethereum|taxes?|legal|lawyer)\b/,
  /\b(?:president|election|politics)\b/,
  /\b(?:essay|resume|cover letter|translate|poem|story)\b/,
];

const COOKING_INTENT_PATTERNS = [
  /\bwhat can i make\b/,
  /\bwhat should i make\b/,
  /\bgive me\b.+\b(?:options?|ideas?|variations?|alternatives?)\b/,
  /\bshow me\b.+\b(?:options?|ideas?|variations?|alternatives?)\b/,
  /\b(?:options?|ideas?|variations?|alternatives?)\b.+\bfor\b/,
  /\bmeal prep\b/,
  /\bmake ahead\b/,
  /\bprep ahead\b/,
  /\bgrocery\b/,
  /\bshopping list\b/,
  /\bleftovers?\b/,
  /\bhow long\b/,
  /\bwhat side\b/,
  /\bwhat goes with\b/,
  /\bpair with\b/,
  /\bcan i make\b.+\bin\b.+\b(?:air fryer|oven|skillet|slow cooker|instant pot)\b/,
  /\b(?:dip|dipping|sauce|sauces|salsa|queso|guacamole|dressing)\b/,
  /\b(?:for|with)\b.+\b(?:chips|crackers|vegetables|veggies|bread|pasta|rice|shrimp|chicken|salmon|tacos?)\b/,
  /\bunder \$?\d+/,
];

const RECIPE_CONTEXT_PATTERNS = [
  /\bmake (?:it|this)\b/,
  /\bhow do i fix\b/,
  /\bwhat should i change\b/,
  /\bwhat can i swap\b/,
  /\bwhat can i use instead\b/,
  /\bdoes this need\b/,
  /\bhow long\b/,
  /\bwhat side\b/,
  /\bwhat goes with\b/,
  /\bi (?:don't|do not) like\b/,
  /\bi (?:don't|do not) want\b/,
  /\bi prefer\b/,
  /\bwithout\b/,
  /\blet'?s add\b/,
  /\badd\b/,
  /\bleave out\b/,
  /\bskip\b/,
  /\bremove\b/,
  /\bavoid\b/,
  /\binstead of\b/,
  /\btoo (?:salty|sweet|bland|thin|thick|spicy)\b/,
  /\b(?:spicier|milder|faster|quicker|healthier|lighter|richer|crispier|creamier)\b/,
  /\bdouble this\b/,
  /\bhalve this\b/,
  /\bfor \d+\b/,
];

export const COOKING_SCOPE_MESSAGE =
  "I can help with cooking-focused requests only. Ask about dishes, ingredients, sauces, substitutions, technique, timing, grocery planning, meal prep, or how to improve this recipe.";

type TopicGuardInput = {
  message: string;
  recipeContext?: RecipeContext;
};

export type TopicGuardResult = {
  allowed: boolean;
  reason: "cooking" | "recipe_context" | "off_topic";
};

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function countMatches(text: string, terms: string[]) {
  let matches = 0;

  for (const term of terms) {
    if (text.includes(term)) {
      matches += 1;
    }
  }

  return matches;
}

function hasRecipeContext(recipeContext?: RecipeContext) {
  if (!recipeContext) {
    return false;
  }

  return Boolean(
    recipeContext.title?.trim() ||
      (recipeContext.ingredients && recipeContext.ingredients.some((item) => item.trim().length > 0)) ||
      (recipeContext.steps && recipeContext.steps.some((item) => item.trim().length > 0))
  );
}

function looksLikeRecipeScopedFollowUp(text: string) {
  return RECIPE_CONTEXT_PATTERNS.some((pattern) => pattern.test(text));
}

function looksLikeRecipeScopedIngredientAdjustment(text: string) {
  return /\b(?:add|swap|replace|remove|skip|leave out|without)\b/.test(text) && countMatches(text, FOOD_TERMS) > 0;
}

function looksLikeShortRecipeScopedRefinement(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 8) {
    return false;
  }

  if (hasStrongOffTopicIntent(text)) {
    return false;
  }

  return (
    /\b(?:add|use|swap|replace|skip|remove|leave out|without|more|less|extra|make|keep)\b/.test(text) ||
    countMatches(text, FOOD_TERMS) > 0 ||
    countMatches(text, COOKING_KEYWORDS) > 0
  );
}

function looksLikeCookingIntent(text: string) {
  return COOKING_INTENT_PATTERNS.some((pattern) => pattern.test(text));
}

function looksLikeIngredientList(text: string) {
  const parts = text
    .split(/\n|,/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (parts.length < 2) {
    return false;
  }

  return parts.every((item) => item.split(/\s+/).length <= 4 && !/\b(?:react|mortgage|flight|bitcoin)\b/.test(item));
}

function hasStrongOffTopicIntent(text: string) {
  return STRONG_OFF_TOPIC_PATTERNS.some((pattern) => pattern.test(text));
}

export function guardCookingTopic({ message, recipeContext }: TopicGuardInput): TopicGuardResult {
  const normalized = normalize(message);
  const cookingSignals = countMatches(normalized, COOKING_KEYWORDS) + countMatches(normalized, FOOD_TERMS);
  const offTopicSignals = countMatches(normalized, OFF_TOPIC_KEYWORDS);
  const hasScopedRecipeContext = hasRecipeContext(recipeContext);
  const cookingIntent = looksLikeCookingIntent(normalized);
  const ingredientList = looksLikeIngredientList(normalized);
  const recipeScopedFollowUp = hasScopedRecipeContext && looksLikeRecipeScopedFollowUp(normalized);
  const recipeScopedIngredientAdjustment = hasScopedRecipeContext && looksLikeRecipeScopedIngredientAdjustment(normalized);
  const shortRecipeScopedRefinement = hasScopedRecipeContext && looksLikeShortRecipeScopedRefinement(normalized);
  const strongOffTopic = hasStrongOffTopicIntent(normalized);

  if ((recipeScopedFollowUp || recipeScopedIngredientAdjustment || shortRecipeScopedRefinement) && offTopicSignals === 0) {
    return { allowed: true, reason: "recipe_context" };
  }

  if (strongOffTopic && cookingSignals === 0 && !cookingIntent && !ingredientList && !hasScopedRecipeContext) {
    return { allowed: false, reason: "off_topic" };
  }

  if (cookingSignals > 0 && offTopicSignals === 0) {
    return { allowed: true, reason: "cooking" };
  }

  if ((cookingIntent || ingredientList) && !strongOffTopic) {
    return { allowed: true, reason: "cooking" };
  }

  if (cookingSignals >= 2 && cookingSignals >= offTopicSignals) {
    return { allowed: true, reason: "cooking" };
  }

  return { allowed: false, reason: "off_topic" };
}
