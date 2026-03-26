/**
 * Intent resolver — pre-routing layer for the recipe generation pipeline.
 *
 * Sits before dish family detection. When a user prompt does not contain an
 * explicit dish name, this resolver classifies the intent type and returns
 * candidate dish families to try in priority order.
 *
 * v1 uses keyword/heuristic matching. Can be upgraded to LLM-based
 * classification without changing the interface.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type IntentType =
  | "explicit"    // "chicken curry", "vanilla flan" — clear dish name
  | "constraint"  // "vegan pasta", "gluten-free pancakes" — diet/constraint led
  | "open"        // "what should I eat", "give me a good meal" — no dish specified
  | "pantry"      // "I have eggs milk cheese" — ingredient-led
  | "goal";       // "healthy comfort food", "quick dinner" — outcome-led

export type IntentResolution = {
  intentType: IntentType;
  /** Candidate dish family keys to try, in priority order. Empty = explicit. */
  candidateFamilies: string[];
  reasoning: string;
};

// ── Internal helpers ──────────────────────────────────────────────────────────

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function containsAny(text: string, patterns: string[]): boolean {
  return patterns.some((p) => text.includes(p));
}

// ── Signal tables ─────────────────────────────────────────────────────────────

const PANTRY_SIGNALS = [
  "i have ",
  "i ve got ",
  "what can i make",
  "what can i cook",
  "what should i make",
  "using what i have",
  "from what i have",
  "in my fridge",
  "in my pantry",
  "in fridge",
  "with eggs",
  "with chicken",
  "with rice",
  "leftover",
  "got some",
  "got eggs",
  "got rice",
  "got chicken",
  "got a ",
  "only have",
  "just have",
  "just some",
  "just a ",
  "just bananas",
  "just yogurt",
  "just milk",
  "fridge has",
  "any ideas",
];

const OPEN_SIGNALS = [
  "make something",
  "make me something",
  "make me food",
  "something tasty",
  "something good",
  "something nice",
  "something delicious",
  "dinner idea",
  "lunch idea",
  "breakfast idea",
  "meal idea",
  "food idea",
  "what should i eat",
  "what s a good",
  "give me a good",
  "give me a recipe",
  "surprise me",
  "i don t know what i want",
  "idk just",
  "don t know what i want",
  "i m hungry",
  "i am hungry",
  "im hungry",
  "need food",
  "need a meal",
  "need a recipe",
  "i need a meal",
  "i need food",
];

const GOAL_SIGNALS = [
  "healthy",
  "comfort food",
  "comforting",
  "cheap",
  "budget",
  "quick",
  "fast",
  "easy",
  "high protein",
  "low carb",
  "low calorie",
  "light meal",
  "filling",
  "cozy",
  "junk food",
  "lazy",
  "minimal effort",
  "after work",
  "in 10 minutes",
  "in ten minutes",
  "indulgent",
  "satisfying",
  "10 minutes",
  "dessert",
  "sweet",
  "treat",
  "baked",
  "bake",
];

const CONSTRAINT_SIGNALS = [
  "vegan",
  "vegetarian",
  "gluten free",
  "gluten-free",
  "dairy free",
  "dairy-free",
  "nut free",
  "nut-free",
  "keto",
];

const MEALTIME_SIGNALS = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "dessert",
];

const SOFT_GOAL_SIGNALS = [
  "eat clean",
  "clean eating",
  "simple",
  "simple but good",
  "simple and good",
  "light lunch",
  "light for lunch",
  "light meal",
  "something light",
  "good lunch",
  "good dinner",
  "fresh",
  "not heavy",
  "easy but good",
  "healthyish",
  "healthy-ish",
  "healthier",
  "feel good",
  "feel better",
  "eat better",
];

const GENERAL_FOOD_INTENT_TERMS = [
  "eat",
  "meal",
  "food",
  "recipe",
  "cook",
  "cooking",
  "lunch",
  "dinner",
  "breakfast",
  "snack",
  "dessert",
];

// ── Candidate maps ────────────────────────────────────────────────────────────

const PANTRY_INGREDIENT_CANDIDATES: Array<{ signals: string[]; families: string[] }> = [
  { signals: ["egg", "eggs"],         families: ["omelet_frittata", "pancake_waffle"] },
  { signals: ["banana", "bananas", "berries", "fruit", "yogurt"], families: ["smoothie", "muffin_quick_bread", "pancake_waffle"] },
  { signals: ["rice"],                families: ["fried_rice", "risotto", "stir_fry"] },
  { signals: ["chicken", "beef", "shrimp", "tofu"], families: ["stir_fry", "curry", "tacos", "sandwich_wrap"] },
  { signals: ["tuna", "mayo", "mayonnaise"], families: ["sandwich_wrap", "salad"] },
  { signals: ["potato", "potatoes", "carrot", "carrots"], families: ["soup_stew", "curry", "stir_fry"] },
  { signals: ["bread", "roll", "bun"], families: ["sandwich_wrap", "omelet_frittata"] },
  { signals: ["milk", "cheese", "butter", "cream"], families: ["omelet_frittata", "pasta", "muffin_quick_bread"] },
  { signals: ["beans", "lentil"],     families: ["soup_stew", "curry", "salad"] },
  { signals: ["pasta", "noodle"],     families: ["pasta"] },
  { signals: ["vegetable", "veggie"], families: ["stir_fry", "soup_stew", "salad"] },
];

const GOAL_SIGNAL_CANDIDATES: Array<{ signals: string[]; families: string[] }> = [
  { signals: ["healthy", "light meal", "low calorie"], families: ["salad", "soup_stew", "smoothie", "stir_fry"] },
  { signals: ["comfort food", "comforting", "cozy"],   families: ["soup_stew", "pasta", "curry", "risotto"] },
  { signals: ["high protein"],         families: ["stir_fry", "omelet_frittata", "smoothie", "pasta"] },
  { signals: ["low carb", "keto"],     families: ["salad", "omelet_frittata", "tacos", "stir_fry"] },
  { signals: ["cheap", "budget"],      families: ["soup_stew", "curry", "pasta", "omelet_frittata"] },
  { signals: ["quick", "fast", "easy", "10 minutes", "minimal effort", "lazy", "after work"],
                                       families: ["omelet_frittata", "stir_fry", "smoothie", "salad"] },
  { signals: ["filling", "satisfying", "indulgent", "junk food"],
                                       families: ["pasta", "curry", "sandwich_wrap", "stir_fry"] },
  { signals: ["dessert", "sweet", "treat", "baked", "bake"],
                                       families: ["cookie", "brownie", "cheesecake", "custard_flan", "muffin_quick_bread"] },
];

const CONSTRAINT_SIGNAL_CANDIDATES: Array<{ signals: string[]; families: string[] }> = [
  { signals: ["vegan", "vegetarian"],          families: ["curry", "stir_fry", "soup_stew", "salad", "tacos"] },
  { signals: ["gluten free", "gluten-free"],   families: ["omelet_frittata", "smoothie", "salad", "soup_stew"] },
  { signals: ["dairy free", "dairy-free"],     families: ["curry", "stir_fry", "smoothie", "tacos"] },
  { signals: ["nut free", "nut-free"],         families: ["smoothie", "salad", "soup_stew", "stir_fry"] },
  { signals: ["keto", "low carb"],             families: ["salad", "omelet_frittata", "stir_fry", "tacos"] },
];

// ── Main export ───────────────────────────────────────────────────────────────

export function resolveIntent(prompt: string): IntentResolution {
  const text = normalizeText(prompt);

  // ── Pantry-led ─────────────────────────────────────────────────────────────

  if (containsAny(text, PANTRY_SIGNALS)) {
    const candidates: string[] = [];
    for (const { signals, families } of PANTRY_INGREDIENT_CANDIDATES) {
      if (containsAny(text, signals)) candidates.push(...families);
    }
    if (candidates.length === 0) {
      candidates.push("omelet_frittata", "stir_fry", "pasta", "soup_stew");
    }
    return {
      intentType: "pantry",
      candidateFamilies: uniqueStrings(candidates),
      reasoning: "Detected pantry-based or ingredient-led request.",
    };
  }

  // ── Open-ended ─────────────────────────────────────────────────────────────

  if (containsAny(text, OPEN_SIGNALS)) {
    return {
      intentType: "open",
      candidateFamilies: ["stir_fry", "pasta", "soup_stew", "omelet_frittata", "salad"],
      reasoning: "Detected open-ended recipe request without a specific dish.",
    };
  }

  // ── Goal-led ───────────────────────────────────────────────────────────────

  if (containsAny(text, GOAL_SIGNALS)) {
    const candidates: string[] = [];
    for (const { signals, families } of GOAL_SIGNAL_CANDIDATES) {
      if (containsAny(text, signals)) candidates.push(...families);
    }
    if (candidates.length === 0) {
      candidates.push("stir_fry", "soup_stew", "pasta");
    }
    return {
      intentType: "goal",
      candidateFamilies: uniqueStrings(candidates),
      reasoning: "Detected goal-based request with no explicit dish family.",
    };
  }

  // ── Constraint-led (diet/macro keywords without explicit dish) ─────────────

  if (containsAny(text, CONSTRAINT_SIGNALS)) {
    const candidates: string[] = [];
    for (const { signals, families } of CONSTRAINT_SIGNAL_CANDIDATES) {
      if (containsAny(text, signals)) candidates.push(...families);
    }
    if (candidates.length === 0) {
      candidates.push("stir_fry", "curry", "salad");
    }
    return {
      intentType: "constraint",
      candidateFamilies: uniqueStrings(candidates),
      reasoning: "Detected constraint-led request without a clear explicit dish.",
    };
  }

  // ── Ingredient-only: known ingredients present but no pantry signal ────────
  // Catches e.g. "potatoes carrots and some random spices" — real ingredients
  // without a pantry framing phrase.

  {
    const ingredientCandidates: string[] = [];
    for (const { signals, families } of PANTRY_INGREDIENT_CANDIDATES) {
      if (containsAny(text, signals)) ingredientCandidates.push(...families);
    }
    if (ingredientCandidates.length > 0) {
      return {
        intentType: "pantry",
        candidateFamilies: uniqueStrings(ingredientCandidates),
        reasoning: "Detected known ingredient keywords; treating as pantry-led request.",
      };
    }
  }

  // ── Meal-time: breakfast / lunch / dinner / snack cues ───────────────────

  if (containsAny(text, MEALTIME_SIGNALS)) {
    const candidates: string[] = [];
    if (text.includes("breakfast")) candidates.push("omelet_frittata", "pancake_waffle", "smoothie");
    if (text.includes("lunch"))     candidates.push("salad", "soup_stew", "sandwich_wrap");
    if (text.includes("dinner"))    candidates.push("stir_fry", "pasta", "curry", "soup_stew");
    if (text.includes("snack"))     candidates.push("smoothie", "salad");
    if (text.includes("dessert"))   candidates.push("cookie", "brownie", "cheesecake", "custard_flan");
    if (candidates.length > 0) {
      return {
        intentType: "goal",
        candidateFamilies: uniqueStrings(candidates),
        reasoning: "Matched meal-time signal.",
      };
    }
  }

  // ── Soft-goal: lifestyle / health phrasing ───────────────────────────────

  if (containsAny(text, SOFT_GOAL_SIGNALS)) {
    const candidates: string[] = [];

    if (containsAny(text, ["eat clean", "clean eating", "fresh", "feel good", "feel better", "eat better", "healthier", "healthy-ish", "healthyish"])) {
      candidates.push("salad", "soup_stew", "stir_fry", "smoothie");
    }
    if (containsAny(text, ["simple", "simple but good", "simple and good", "easy but good"])) {
      candidates.push("pasta", "soup_stew", "omelet_frittata", "salad");
    }
    if (containsAny(text, ["light lunch", "light for lunch", "light meal", "something light", "not heavy"])) {
      candidates.push("salad", "soup_stew", "smoothie", "sandwich_wrap");
    }
    if (containsAny(text, ["good lunch", "good dinner"])) {
      candidates.push("soup_stew", "pasta", "stir_fry", "salad");
    }

    if (candidates.length > 0) {
      return {
        intentType: "goal",
        candidateFamilies: uniqueStrings(candidates),
        reasoning: "Matched soft goal phrase.",
      };
    }
  }

  // ── General food-intent fallback ─────────────────────────────────────────
  // Catches longer vague prompts that have no specific routing signal but
  // clearly express food intent (e.g. "I don't feel like cooking what can I do").

  if (containsAny(text, GENERAL_FOOD_INTENT_TERMS)) {
    return {
      intentType: "open",
      candidateFamilies: ["soup_stew", "pasta", "salad", "stir_fry", "omelet_frittata"],
      reasoning: "No strong routing signals found; using generalized food-intent fallback.",
    };
  }

  // ── Default: explicit or near-explicit ────────────────────────────────────

  return {
    intentType: "explicit",
    candidateFamilies: [],
    reasoning: "No explicit family or recoverable routing signals found.",
  };
}
