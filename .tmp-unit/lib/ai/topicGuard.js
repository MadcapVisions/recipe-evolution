"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COOKING_SCOPE_MESSAGE = void 0;
exports.guardCookingTopic = guardCookingTopic;
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
    "dessert",
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
    "bake",
    "roast",
    "sear",
    "saute",
    "simmer",
    "boil",
    "grill",
    "broil",
    "steam",
    "oven",
    "stovetop",
    "skillet",
    "sauce",
    "seasoning",
    "season",
    "flavor",
    "flavour",
    "spice",
    "marinade",
    "substitute",
    "substitution",
    "swap",
    "pairing",
    "serve",
    "serving",
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
    "air fryer",
    "sheet pan",
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
    "stock",
    "stocks",
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
    "vacation",
    "poem",
    "story",
    "translate",
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
    /\btoo (?:salty|sweet|bland|thin|thick|spicy)\b/,
    /\b(?:spicier|milder|faster|quicker|healthier|lighter|richer|crispier|creamier)\b/,
];
exports.COOKING_SCOPE_MESSAGE = "I can help with cooking-focused requests only. Ask about dishes, ingredients, substitutions, technique, timing, meal planning, grocery planning, or how to improve this recipe.";
function normalize(value) {
    return value.toLowerCase().replace(/\s+/g, " ").trim();
}
function countMatches(text, terms) {
    let matches = 0;
    for (const term of terms) {
        if (text.includes(term)) {
            matches += 1;
        }
    }
    return matches;
}
function hasRecipeContext(recipeContext) {
    if (!recipeContext) {
        return false;
    }
    return Boolean(recipeContext.title?.trim() ||
        (recipeContext.ingredients && recipeContext.ingredients.some((item) => item.trim().length > 0)) ||
        (recipeContext.steps && recipeContext.steps.some((item) => item.trim().length > 0)));
}
function looksLikeRecipeScopedFollowUp(text) {
    return RECIPE_CONTEXT_PATTERNS.some((pattern) => pattern.test(text));
}
function guardCookingTopic({ message, recipeContext }) {
    const normalized = normalize(message);
    const cookingSignals = countMatches(normalized, COOKING_KEYWORDS) + countMatches(normalized, FOOD_TERMS);
    const offTopicSignals = countMatches(normalized, OFF_TOPIC_KEYWORDS);
    const hasScopedRecipeContext = hasRecipeContext(recipeContext);
    if (cookingSignals > 0 && offTopicSignals === 0) {
        return { allowed: true, reason: "cooking" };
    }
    if (hasScopedRecipeContext && looksLikeRecipeScopedFollowUp(normalized) && offTopicSignals === 0) {
        return { allowed: true, reason: "recipe_context" };
    }
    if (cookingSignals >= 2 && cookingSignals >= offTopicSignals) {
        return { allowed: true, reason: "cooking" };
    }
    return { allowed: false, reason: "off_topic" };
}
