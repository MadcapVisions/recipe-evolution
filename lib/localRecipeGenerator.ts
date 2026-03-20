import type { GeneratedRecipe, RecipeIdea, UserTasteProfile } from "@/components/home/types";

type MealType = "breakfast" | "lunch" | "dinner";
type Cuisine = "italian" | "mexican" | "asian" | "comfort food" | "healthy";
type RecipeStyle = "bowl" | "skillet" | "roasted" | "stir-fry" | "pasta" | "salad";
type Preference = "high protein" | "low carb" | "vegetarian" | "gluten free" | "spicy";
type Season = "winter" | "spring" | "summer" | "fall";

type ParsedIntent = {
  proteins: string[];
  carbs: string[];
  vegetables: string[];
  aromatics: string[];
  acids: string[];
  herbs: string[];
  spices: string[];
  cuisines: Cuisine[];
  preferences: Preference[];
  mealType: MealType;
  flavors: string[];
  dishFamily: "dip" | "soup" | "salad" | "tacos" | "pasta" | "bowl" | "roasted" | "pizza" | null;
};

type SauceTemplate = {
  name: string;
  ingredients: string[];
  method: string;
  finish: string;
};

type CuisineProfile = {
  key: Cuisine;
  label: string;
  pantry: string[];
  herbs: string[];
  acids: string[];
  vegetables: string[];
  styles: RecipeStyle[];
  titleDescriptors: string[];
  sauces: SauceTemplate[];
  toppings: string[];
  crunchyToppings: string[];
  pickles: string[];
  cheeses: string[];
  sides: string[];
};

type PairingProfile = {
  proteins: string[];
  cuisines: Cuisine[];
  preferredHerbs: string[];
  preferredAcids: string[];
  preferredVegetables: string[];
  preferredStyles: RecipeStyle[];
  preferredSauceWords: string[];
  toppings: string[];
  sides: string[];
};

type ImproveGoal = "high protein" | "vegetarian" | "faster" | "spicier";

type RecipeBlueprint = {
  cuisine: CuisineProfile;
  style: RecipeStyle;
  protein: string;
  carb: string;
  vegetables: string[];
  aromatic: string;
  herb: string;
  acid: string;
  sauce: SauceTemplate;
  topping: string;
  crunchyTopping: string | null;
  pickle: string | null;
  cheese: string | null;
  side: string;
  title: string;
  description: string;
  cookTimeMin: number;
  score: number;
  pantryScore: number;
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  ingredients: Array<{ name: string }>;
  steps: Array<{ text: string }>;
};

type BlueprintStructure = {
  cuisine: CuisineProfile;
  style: RecipeStyle;
  protein: string;
  carb: string;
  vegetables: string[];
  aromatic: string;
  herb: string;
  acid: string;
  sauce: SauceTemplate;
  topping: string;
  crunchyTopping: string | null;
  pickle: string | null;
  cheese: string | null;
  side: string;
};

type DeterministicRecipeDraft = GeneratedRecipe & {
  remix_title: string;
  remix_description: string;
};

const COMMON_PANTRY_ITEMS = new Set([
  "olive oil",
  "neutral oil",
  "butter",
  "garlic",
  "onion",
  "ginger",
  "lemon",
  "lime",
  "vinegar",
  "red wine vinegar",
  "rice vinegar",
  "soy sauce",
  "sesame oil",
  "broth",
  "cream",
  "yogurt",
  "parmesan",
  "salt",
  "black pepper",
  "cumin",
  "chili powder",
  "chipotle",
]);

const KNOWN = {
  proteins: [
    "chicken",
    "beef",
    "pork",
    "fish",
    "salmon",
    "shrimp",
    "tofu",
    "beans",
    "eggs",
    "turkey",
    "chickpeas",
  ],
  carbs: ["rice", "pasta", "noodles", "potatoes", "sweet potatoes", "bread", "quinoa", "tortillas"],
  vegetables: [
    "broccoli",
    "peppers",
    "bell peppers",
    "eggplant",
    "aubergine",
    "spinach",
    "carrots",
    "cucumber",
    "tomatoes",
    "zucchini",
    "onion",
    "cabbage",
    "corn",
    "mushrooms",
    "green beans",
    "cauliflower",
    "asparagus",
    "peas",
  ],
  aromatics: ["garlic", "onion", "ginger", "scallions", "shallot"],
  acids: ["lemon", "lime", "vinegar", "red wine vinegar", "rice vinegar"],
  herbs: ["basil", "cilantro", "parsley", "oregano", "dill", "chives"],
  spices: [
    "spicy",
    "chili",
    "paprika",
    "cumin",
    "pepper",
    "black pepper",
    "red pepper flakes",
    "soy",
    "sesame",
    "chipotle",
    "curry",
    "smoky",
    "crispy",
  ],
  cuisines: ["italian", "mexican", "asian", "comfort food", "healthy"] as Cuisine[],
  preferences: ["high protein", "low carb", "vegetarian", "gluten free", "spicy"] as Preference[],
  flavors: ["spicy", "bright", "savory", "fresh", "creamy", "comfort", "herby", "crispy", "smoky"],
};

const STOP_WORDS = new Set([
  "i",
  "a",
  "an",
  "the",
  "and",
  "or",
  "with",
  "for",
  "to",
  "of",
  "in",
  "on",
  "at",
  "my",
  "want",
  "lets",
  "let",
  "make",
  "something",
  "dish",
  "meal",
  "what",
  "think",
  "recommend",
  "give",
  "some",
  "ideas",
  "cook",
  "cooking",
  "would",
  "like",
  "need",
  "best",
  "option",
  "options",
]);

const CUISINE_PROFILES: Record<Cuisine, CuisineProfile> = {
  italian: {
    key: "italian",
    label: "Italian",
    pantry: ["olive oil", "parmesan", "broth"],
    herbs: ["basil", "parsley", "oregano"],
    acids: ["lemon", "red wine vinegar"],
    vegetables: ["tomatoes", "zucchini", "spinach", "mushrooms", "asparagus"],
    styles: ["pasta", "skillet", "roasted", "salad"],
    titleDescriptors: ["Rustic", "Lemon", "Herbed", "Weeknight"],
    sauces: [
      {
        name: "lemon-garlic pan sauce",
        ingredients: ["olive oil", "garlic", "lemon", "broth"],
        method: "reduce garlic, broth, and lemon into a glossy pan sauce",
        finish: "finish with parsley and parmesan",
      },
      {
        name: "tomato-basil skillet sauce",
        ingredients: ["olive oil", "garlic", "tomatoes", "basil"],
        method: "simmer chopped tomatoes with garlic until jammy",
        finish: "stir in basil right before serving",
      },
    ],
    toppings: ["basil ribbons", "parsley", "parmesan"],
    crunchyToppings: ["toasted breadcrumbs", "crisp chickpeas"],
    pickles: ["quick-pickled shallots"],
    cheeses: ["parmesan", "mozzarella"],
    sides: ["simple arugula salad", "roasted green beans"],
  },
  mexican: {
    key: "mexican",
    label: "Mexican",
    pantry: ["olive oil", "cumin", "chili powder"],
    herbs: ["cilantro", "oregano"],
    acids: ["lime", "vinegar"],
    vegetables: ["peppers", "corn", "onion", "tomatoes", "cabbage"],
    styles: ["bowl", "skillet", "roasted", "salad"],
    titleDescriptors: ["Smoky", "Chipotle", "Cilantro-Lime", "Street-Style"],
    sauces: [
      {
        name: "chipotle-lime skillet sauce",
        ingredients: ["olive oil", "chipotle", "lime", "garlic"],
        method: "toast spices, then loosen with lime and a splash of water",
        finish: "finish with cilantro",
      },
      {
        name: "cumin-tomato pan sauce",
        ingredients: ["olive oil", "cumin", "tomatoes", "onion"],
        method: "cook onions and tomatoes into a smoky base",
        finish: "brighten with lime at the end",
      },
    ],
    toppings: ["cilantro", "avocado", "lime wedges"],
    crunchyToppings: ["toasted pepitas", "crushed tortilla strips"],
    pickles: ["quick-pickled red onions", "pickled jalapenos"],
    cheeses: ["cotija", "monterey jack"],
    sides: ["black beans", "charred corn salad"],
  },
  asian: {
    key: "asian",
    label: "Asian",
    pantry: ["soy sauce", "sesame oil", "rice vinegar"],
    herbs: ["cilantro", "scallions"],
    acids: ["lime", "rice vinegar"],
    vegetables: ["broccoli", "carrots", "cabbage", "peppers", "green beans"],
    styles: ["stir-fry", "bowl", "salad", "skillet"],
    titleDescriptors: ["Ginger-Sesame", "Soy-Glazed", "Sesame-Lime", "Weeknight"],
    sauces: [
      {
        name: "ginger-soy glaze",
        ingredients: ["soy sauce", "ginger", "garlic", "rice vinegar"],
        method: "whisk soy, ginger, and vinegar into a quick savory glaze",
        finish: "finish with scallions and sesame",
      },
      {
        name: "sesame-lime dressing",
        ingredients: ["sesame oil", "lime", "soy sauce", "garlic"],
        method: "shake into a bright dressing for bowls or salads",
        finish: "scatter herbs and crunchy vegetables on top",
      },
    ],
    toppings: ["scallions", "sesame seeds", "cilantro"],
    crunchyToppings: ["crushed peanuts", "crispy shallots"],
    pickles: ["quick-pickled cucumbers"],
    cheeses: [],
    sides: ["steamed edamame", "cucumber salad"],
  },
  "comfort food": {
    key: "comfort food",
    label: "Comfort Food",
    pantry: ["butter", "broth", "cream"],
    herbs: ["parsley", "chives"],
    acids: ["lemon"],
    vegetables: ["mushrooms", "onion", "peas", "carrots", "sweet potatoes"],
    styles: ["skillet", "roasted", "pasta", "bowl"],
    titleDescriptors: ["Cozy", "Creamy", "Weeknight", "Golden"],
    sauces: [
      {
        name: "creamy herb pan sauce",
        ingredients: ["butter", "garlic", "broth", "cream"],
        method: "reduce broth and cream into a spoon-coating sauce",
        finish: "finish with herbs and black pepper",
      },
      {
        name: "brown butter skillet finish",
        ingredients: ["butter", "garlic", "lemon"],
        method: "brown the butter lightly for nuttiness, then add garlic",
        finish: "cut the richness with lemon",
      },
    ],
    toppings: ["chives", "parsley"],
    crunchyToppings: ["buttered breadcrumbs", "toasted walnuts"],
    pickles: ["quick-pickled shallots"],
    cheeses: ["cheddar", "parmesan"],
    sides: ["sauteed green beans", "warm roasted carrots"],
  },
  healthy: {
    key: "healthy",
    label: "Healthy",
    pantry: ["olive oil", "yogurt", "quinoa"],
    herbs: ["parsley", "dill", "cilantro"],
    acids: ["lemon", "lime", "vinegar"],
    vegetables: ["broccoli", "cucumber", "spinach", "zucchini", "asparagus"],
    styles: ["bowl", "salad", "roasted", "skillet"],
    titleDescriptors: ["Bright", "Herbed", "Protein-Forward", "Fresh"],
    sauces: [
      {
        name: "herbed yogurt sauce",
        ingredients: ["yogurt", "lemon", "garlic", "herbs"],
        method: "stir into a cool sauce for roasted or grilled components",
        finish: "spoon over the plate right before serving",
      },
      {
        name: "lemon-herb vinaigrette",
        ingredients: ["olive oil", "lemon", "vinegar", "herbs"],
        method: "whisk into a bright vinaigrette",
        finish: "dress greens or bowls lightly",
      },
    ],
    toppings: ["fresh herbs", "avocado"],
    crunchyToppings: ["toasted almonds", "pumpkin seeds"],
    pickles: ["quick-pickled cucumbers"],
    cheeses: ["feta"],
    sides: ["cucumber salad", "roasted asparagus"],
  },
};

const PAIRINGS: PairingProfile[] = [
  {
    proteins: ["salmon", "fish"],
    cuisines: ["healthy", "italian"],
    preferredHerbs: ["dill", "parsley"],
    preferredAcids: ["lemon"],
    preferredVegetables: ["asparagus", "spinach", "broccoli"],
    preferredStyles: ["roasted", "salad", "bowl"],
    preferredSauceWords: ["yogurt", "lemon", "vinaigrette"],
    toppings: ["dill", "toasted almonds"],
    sides: ["roasted asparagus", "simple cucumber salad"],
  },
  {
    proteins: ["chicken"],
    cuisines: ["mexican", "healthy", "comfort food"],
    preferredHerbs: ["cilantro", "parsley"],
    preferredAcids: ["lime", "lemon"],
    preferredVegetables: ["peppers", "corn", "broccoli"],
    preferredStyles: ["skillet", "bowl", "roasted"],
    preferredSauceWords: ["chipotle", "lime", "lemon"],
    toppings: ["cilantro", "pickled red onions"],
    sides: ["charred corn salad", "black beans"],
  },
  {
    proteins: ["tofu", "beans", "chickpeas"],
    cuisines: ["asian", "healthy", "mexican"],
    preferredHerbs: ["cilantro", "scallions"],
    preferredAcids: ["lime", "rice vinegar"],
    preferredVegetables: ["broccoli", "cabbage", "peppers"],
    preferredStyles: ["stir-fry", "bowl", "salad"],
    preferredSauceWords: ["soy", "sesame", "lime"],
    toppings: ["sesame seeds", "crispy shallots"],
    sides: ["cucumber salad", "steamed edamame"],
  },
  {
    proteins: ["shrimp"],
    cuisines: ["asian", "mexican", "healthy"],
    preferredHerbs: ["cilantro", "parsley"],
    preferredAcids: ["lime", "lemon"],
    preferredVegetables: ["cabbage", "corn", "broccoli"],
    preferredStyles: ["stir-fry", "bowl", "salad"],
    preferredSauceWords: ["lime", "sesame", "chipotle"],
    toppings: ["lime wedges", "toasted pepitas"],
    sides: ["cucumber salad", "charred corn salad"],
  },
];

const SEASONAL_VEGETABLES: Record<Season, string[]> = {
  winter: ["broccoli", "cabbage", "carrots", "cauliflower", "mushrooms"],
  spring: ["asparagus", "peas", "spinach", "broccoli", "green beans"],
  summer: ["tomatoes", "zucchini", "corn", "peppers", "cucumber"],
  fall: ["sweet potatoes", "mushrooms", "green beans", "peppers", "carrots"],
};

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function humanList(values: string[]) {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token));
}

function includesPhrase(text: string, phrase: string) {
  return text.toLowerCase().includes(phrase.toLowerCase());
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function normalizeTasteValues(values: string[] | null | undefined) {
  return (values ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean);
}

function pickMatches(text: string, tokens: string[], items: string[]) {
  return unique(items.filter((item) => includesPhrase(text, item) || tokens.includes(item.split(" ")[0])));
}

function pickTypedMatches<T extends string>(text: string, tokens: string[], items: readonly T[]) {
  return unique(items.filter((item) => includesPhrase(text, item) || tokens.includes(item.split(" ")[0]))) as T[];
}

function getCurrentSeason(): Season {
  const month = new Date().getMonth();
  if (month <= 1 || month === 11) return "winter";
  if (month <= 4) return "spring";
  if (month <= 7) return "summer";
  return "fall";
}

function parseIntent(prompt: string, providedIngredients: string[] = []): ParsedIntent {
  const text = `${prompt} ${providedIngredients.join(" ")}`.toLowerCase();
  const tokens = tokenize(text);
  const mealType: MealType = text.includes("breakfast") ? "breakfast" : text.includes("lunch") ? "lunch" : "dinner";
  const dishFamily =
    text.includes("pizza") || text.includes("focaccia") || text.includes("flatbread")
      ? "pizza"
      : text.includes("dip") || text.includes("spread")
      ? "dip"
      : text.includes("soup") || text.includes("stew")
        ? "soup"
        : text.includes("salad")
          ? "salad"
          : text.includes("taco") || text.includes("wrap")
            ? "tacos"
            : text.includes("pasta") || text.includes("noodle")
              ? "pasta"
              : text.includes("bowl") || text.includes("rice bowl")
                ? "bowl"
                : text.includes("roasted") || text.includes("sheet pan")
                  ? "roasted"
                  : null;

  return {
    proteins: pickMatches(text, tokens, KNOWN.proteins),
    carbs: pickMatches(text, tokens, KNOWN.carbs),
    vegetables: pickMatches(text, tokens, KNOWN.vegetables),
    aromatics: pickMatches(text, tokens, KNOWN.aromatics),
    acids: pickMatches(text, tokens, KNOWN.acids),
    herbs: pickMatches(text, tokens, KNOWN.herbs),
    spices: pickMatches(text, tokens, KNOWN.spices),
    cuisines: pickTypedMatches(text, tokens, KNOWN.cuisines),
    preferences: pickTypedMatches(text, tokens, KNOWN.preferences),
    mealType,
    flavors: unique(KNOWN.flavors.filter((item) => includesPhrase(text, item))),
    dishFamily,
  };
}

function findPairing(intent: ParsedIntent, protein: string) {
  return (
    PAIRINGS.find(
      (pairing) =>
        pairing.proteins.includes(protein) &&
        (intent.cuisines.length === 0 || intent.cuisines.some((cuisine) => pairing.cuisines.includes(cuisine)))
    ) ?? null
  );
}

function detectCuisine(intent: ParsedIntent): CuisineProfile {
  if (intent.cuisines.length > 0) return CUISINE_PROFILES[intent.cuisines[0]];
  if (intent.flavors.includes("comfort") || intent.flavors.includes("creamy")) return CUISINE_PROFILES["comfort food"];
  if (intent.spices.some((item) => ["soy", "sesame", "ginger", "rice vinegar", "curry"].includes(item)) || intent.carbs.includes("noodles")) {
    return CUISINE_PROFILES.asian;
  }
  if (intent.spices.some((item) => ["chipotle", "cumin", "chili"].includes(item)) || intent.carbs.includes("tortillas")) {
    return CUISINE_PROFILES.mexican;
  }
  if (intent.carbs.includes("pasta") || intent.herbs.some((item) => ["basil", "oregano"].includes(item)) || intent.vegetables.includes("tomatoes")) {
    return CUISINE_PROFILES.italian;
  }
  return CUISINE_PROFILES.healthy;
}

function resolveProtein(intent: ParsedIntent) {
  if (intent.mealType === "breakfast") {
    return intent.proteins.find((item) => ["eggs", "turkey", "beans", "tofu"].includes(item)) ?? "eggs";
  }
  if (intent.preferences.includes("vegetarian")) {
    return intent.proteins.find((item) => ["tofu", "beans", "eggs", "chickpeas"].includes(item)) ?? "tofu";
  }
  return intent.proteins[0] ?? "chicken";
}

function applyProteinSubstitutions(protein: string, intent: ParsedIntent) {
  if (intent.preferences.includes("vegetarian") && ["chicken", "beef", "pork", "fish", "salmon", "shrimp", "turkey"].includes(protein)) {
    return "tofu";
  }
  return protein;
}

function resolveStyle(intent: ParsedIntent, cuisine: CuisineProfile, pairing: PairingProfile | null) {
  const candidates = cuisine.styles;

  if (intent.dishFamily === "salad" && candidates.includes("salad")) return "salad";
  if (intent.dishFamily === "pasta" && candidates.includes("pasta")) return "pasta";
  if (intent.dishFamily === "bowl" && candidates.includes("bowl")) return "bowl";
  if (intent.dishFamily === "roasted" && candidates.includes("roasted")) return "roasted";
  if (intent.mealType === "breakfast") {
    if (candidates.includes("skillet")) return "skillet";
    if (candidates.includes("bowl")) return "bowl";
  }
  if (intent.carbs.includes("pasta")) return "pasta";
  if (intent.mealType === "lunch") {
    const lunchStyle = candidates.find((style) => style === "salad" || style === "bowl");
    if (lunchStyle) return lunchStyle;
  }
  if (intent.carbs.includes("rice") && candidates.includes("bowl")) return "bowl";
  if (pairing) {
    const preferred = pairing.preferredStyles.find((style) => candidates.includes(style));
    if (preferred) return preferred;
  }
  return candidates[0];
}

function resolveCarb(intent: ParsedIntent, cuisine: CuisineProfile, style: RecipeStyle) {
  const requested = intent.carbs[0];

  if (intent.mealType === "breakfast" && !requested) {
    if (intent.preferences.includes("low carb")) return "cauliflower rice";
    return cuisine.key === "mexican" ? "sweet potatoes" : "potatoes";
  }

  if (intent.preferences.includes("low carb")) {
    if (style === "pasta") return "zucchini ribbons";
    return "cauliflower rice";
  }

  if (requested) {
    if (intent.preferences.includes("gluten free") && requested === "pasta") return "rice noodles";
    if (intent.preferences.includes("gluten free") && requested === "bread") return "roasted potatoes";
    return requested;
  }

  if (style === "pasta" && cuisine.key === "italian") return "pasta";
  if (cuisine.key === "mexican") return "rice";
  if (cuisine.key === "asian") return "rice";
  if (cuisine.key === "healthy") return "quinoa";
  return "potatoes";
}

function resolveVegetables(intent: ParsedIntent, cuisine: CuisineProfile, pairing: PairingProfile | null) {
  const season = getCurrentSeason();
  const seasonal = SEASONAL_VEGETABLES[season];
  const requested = intent.vegetables;
  const pairingVegetables = pairing?.preferredVegetables ?? [];
  const pool = unique([...requested, ...pairingVegetables, ...seasonal, ...cuisine.vegetables]);
  return pool.slice(0, 2);
}

function resolveAromatic(intent: ParsedIntent, cuisine: CuisineProfile) {
  if (intent.aromatics.length > 0) return intent.aromatics[0];
  return cuisine.key === "asian" ? "ginger" : "garlic";
}

function resolveHerb(intent: ParsedIntent, cuisine: CuisineProfile, pairing: PairingProfile | null) {
  return intent.herbs[0] ?? pairing?.preferredHerbs[0] ?? cuisine.herbs[0];
}

function resolveAcid(intent: ParsedIntent, cuisine: CuisineProfile, pairing: PairingProfile | null) {
  return intent.acids[0] ?? pairing?.preferredAcids[0] ?? cuisine.acids[0];
}

function chooseSauce(cuisine: CuisineProfile, intent: ParsedIntent, pairing: PairingProfile | null) {
  if (intent.flavors.includes("creamy") && cuisine.key !== "asian") {
    return cuisine.sauces.find((template) => template.name.includes("creamy")) ?? cuisine.sauces[0];
  }
  if (pairing) {
    const preferred = cuisine.sauces.find((template) =>
      pairing.preferredSauceWords.some((word) => template.name.includes(word))
    );
    if (preferred) return preferred;
  }
  if (intent.preferences.includes("spicy")) {
    return cuisine.sauces.find((template) => template.name.includes("chipotle") || template.name.includes("glaze")) ?? cuisine.sauces[0];
  }
  return cuisine.sauces[0];
}

function chooseExtra(candidates: string[], fallback: string | null = null) {
  return candidates[0] ?? fallback;
}

function describeSauceBehavior(style: RecipeStyle, sauce: SauceTemplate) {
  if (style === "salad") {
    return `use the ${sauce.name} cold so it stays bright and clean`;
  }
  if (style === "bowl") {
    return `keep the ${sauce.name} loose enough to spoon over the bowl`;
  }
  if (style === "pasta") {
    return `thin the ${sauce.name} slightly so it coats the pasta instead of clumping`;
  }
  if (style === "roasted") {
    return `spoon the ${sauce.name} over at the end so roasted edges stay crisp`;
  }
  return `reduce the ${sauce.name} until it lightly coats the protein and vegetables`;
}

function estimateNutrition(protein: string, carb: string, style: RecipeStyle, cheese: string | null) {
  const proteinMap: Record<string, { calories: number; protein: number; fat: number }> = {
    chicken: { calories: 190, protein: 35, fat: 4 },
    turkey: { calories: 180, protein: 34, fat: 4 },
    salmon: { calories: 260, protein: 30, fat: 15 },
    fish: { calories: 220, protein: 28, fat: 10 },
    shrimp: { calories: 170, protein: 30, fat: 3 },
    tofu: { calories: 170, protein: 18, fat: 10 },
    beans: { calories: 180, protein: 12, fat: 1 },
    chickpeas: { calories: 190, protein: 11, fat: 3 },
    eggs: { calories: 160, protein: 13, fat: 11 },
    beef: { calories: 280, protein: 28, fat: 18 },
    pork: { calories: 260, protein: 27, fat: 16 },
  };
  const carbMap: Record<string, { calories: number; carbs: number }> = {
    rice: { calories: 170, carbs: 36 },
    quinoa: { calories: 160, carbs: 28 },
    potatoes: { calories: 150, carbs: 31 },
    "sweet potatoes": { calories: 155, carbs: 34 },
    pasta: { calories: 210, carbs: 42 },
    noodles: { calories: 200, carbs: 40 },
    "rice noodles": { calories: 190, carbs: 42 },
    tortillas: { calories: 160, carbs: 28 },
    bread: { calories: 160, carbs: 28 },
    "cauliflower rice": { calories: 40, carbs: 8 },
    "zucchini ribbons": { calories: 30, carbs: 6 },
  };

  const proteinInfo = proteinMap[protein] ?? { calories: 210, protein: 24, fat: 8 };
  const carbInfo = carbMap[carb] ?? { calories: 140, carbs: 24 };
  const styleFat = style === "salad" ? 10 : style === "roasted" ? 12 : 14;
  const cheeseBoost = cheese ? { calories: 45, protein: 3, fat: 3 } : { calories: 0, protein: 0, fat: 0 };

  return {
    calories: proteinInfo.calories + carbInfo.calories + styleFat * 9 + cheeseBoost.calories,
    protein: proteinInfo.protein + cheeseBoost.protein,
    carbs: carbInfo.carbs,
    fat: proteinInfo.fat + styleFat + cheeseBoost.fat,
  };
}

function estimatePantryScore(ingredients: string[], cuisine: CuisineProfile) {
  const pantryHits = ingredients.filter((ingredient) => COMMON_PANTRY_ITEMS.has(ingredient)).length;
  const cuisineHits = ingredients.filter((ingredient) => cuisine.pantry.includes(ingredient)).length;
  return pantryHits + cuisineHits * 2;
}

function getProteinQuantity(protein: string, mealType: MealType) {
  if (protein === "eggs") {
    return mealType === "breakfast" ? "4 eggs" : "6 eggs";
  }
  if (["shrimp", "fish", "salmon"].includes(protein)) {
    return mealType === "lunch" ? "12 oz" : "1 lb";
  }
  if (["tofu", "beans", "chickpeas"].includes(protein)) {
    return protein === "tofu" ? "14 oz" : "2 cups";
  }
  return mealType === "lunch" ? "12 oz" : "1 lb";
}

function getProteinDonenessCue(protein: string) {
  if (protein === "chicken" || protein === "turkey") return "cook until fully done and the juices run clear";
  if (protein === "salmon") return "cook until the center is just translucent and flakes easily";
  if (protein === "fish") return "cook until flaky and opaque";
  if (protein === "shrimp") return "cook until pink and just curled";
  if (protein === "beef") return "cook until well browned with a little spring left";
  if (protein === "pork") return "cook until fully done but still juicy";
  if (protein === "tofu") return "cook until the edges are browned and lightly crisp";
  if (protein === "eggs") return "cook until softly set";
  return "cook until browned and heated through";
}

function getCookTimeAdjustment(protein: string, style: RecipeStyle) {
  if (protein === "eggs") return -10;
  if (["shrimp", "fish", "salmon"].includes(protein)) return -5;
  if (protein === "beef" && style === "roasted") return 5;
  return 0;
}

function cookTimeForStyle(style: RecipeStyle) {
  switch (style) {
    case "salad":
      return 20;
    case "stir-fry":
      return 20;
    case "skillet":
      return 25;
    case "pasta":
      return 30;
    case "bowl":
      return 30;
    case "roasted":
      return 35;
    default:
      return 30;
  }
}

function buildTitle(cuisine: CuisineProfile, style: RecipeStyle, protein: string, carb: string, vegetables: string[], descriptorIndex: number) {
  const descriptor = cuisine.titleDescriptors[descriptorIndex % cuisine.titleDescriptors.length];
  const proteinLabel = titleCase(protein);
  const carbLabel = titleCase(carb);
  const vegetableLabel = titleCase(vegetables[0] ?? "Vegetables");

  switch (style) {
    case "bowl":
      return `${descriptor} ${proteinLabel} ${carbLabel} Bowl`;
    case "stir-fry":
      return `${descriptor} ${proteinLabel} Stir-Fry with ${vegetableLabel}`;
    case "pasta":
      return `${descriptor} ${proteinLabel} ${carbLabel}`;
    case "salad":
      return `${descriptor} ${proteinLabel} and ${vegetableLabel} Salad`;
    case "roasted":
      return `${descriptor} Roasted ${proteinLabel} with ${vegetableLabel}`;
    case "skillet":
    default:
      return `${descriptor} ${proteinLabel} Skillet with ${carbLabel}`;
  }
}

function buildDescription(
  cuisine: CuisineProfile,
  style: RecipeStyle,
  protein: string,
  carb: string,
  vegetables: string[],
  sauce: SauceTemplate,
  topping: string,
  side: string,
  preferences: Preference[],
  nutrition: RecipeBlueprint["nutrition"]
) {
  const preferenceText = preferences.length > 0 ? ` It stays aligned with ${preferences.join(", ")} preferences.` : "";
  return `${cuisine.label} ${style} built around ${protein}, ${carb}, and ${humanList(vegetables)}, finished with ${sauce.name}, ${topping}, and served with ${side}. Roughly ${nutrition.protein}g protein per serving.${preferenceText}`;
}

function scoreBlueprint(input: {
  intent: ParsedIntent;
  cuisine: CuisineProfile;
  style: RecipeStyle;
  protein: string;
  carb: string;
  vegetables: string[];
  herb: string;
  acid: string;
  sauce: SauceTemplate;
  topping: string;
  side: string;
  pairing: PairingProfile | null;
  pantryScore: number;
  nutrition: RecipeBlueprint["nutrition"];
}) {
  const { intent, cuisine, style, protein, carb, vegetables, herb, acid, sauce, topping, side, pairing, pantryScore, nutrition } = input;
  let score = 0;

  score += intent.cuisines.length === 0 || intent.cuisines.includes(cuisine.key) ? 20 : 0;
  score += intent.proteins.length === 0 || intent.proteins.includes(protein) ? 15 : 0;
  score += intent.carbs.length === 0 || intent.carbs.some((item) => carb.includes(item) || item.includes(carb)) ? 10 : 0;
  score += intent.vegetables.filter((vegetable) => vegetables.includes(vegetable)).length * 6;
  score += intent.herbs.length === 0 || intent.herbs.includes(herb) ? 4 : 0;
  score += intent.acids.length === 0 || intent.acids.includes(acid) ? 4 : 0;
  score += intent.mealType === "lunch" && (style === "bowl" || style === "salad") ? 10 : 0;
  score += intent.mealType === "dinner" && (style === "skillet" || style === "roasted" || style === "pasta") ? 8 : 0;
  score += intent.preferences.includes("low carb") && ["cauliflower rice", "zucchini ribbons"].includes(carb) ? 14 : 0;
  score += intent.preferences.includes("vegetarian") && ["tofu", "beans", "chickpeas", "eggs"].includes(protein) ? 14 : 0;
  score += intent.preferences.includes("gluten free") && !["pasta", "bread"].includes(carb) ? 8 : 0;
  score += intent.preferences.includes("high protein") && ["chicken", "turkey", "salmon", "fish", "shrimp", "tofu"].includes(protein) ? 10 : 0;
  score += intent.preferences.includes("spicy") && (sauce.name.includes("chipotle") || sauce.name.includes("glaze") || topping.includes("jalap")) ? 8 : 0;
  score += intent.mealType === "breakfast" && (style === "skillet" || style === "bowl") ? 12 : 0;
  score += pantryScore;
  score += intent.preferences.includes("high protein") ? Math.min(12, Math.floor(nutrition.protein / 3)) : 0;
  score += intent.preferences.includes("low carb") ? Math.max(0, 10 - Math.floor(nutrition.carbs / 6)) : 0;

  if (pairing) {
    score += pairing.cuisines.includes(cuisine.key) ? 10 : 0;
    score += pairing.preferredStyles.includes(style) ? 8 : 0;
    score += pairing.preferredVegetables.some((vegetable) => vegetables.includes(vegetable)) ? 6 : 0;
    score += pairing.preferredSauceWords.some((word) => sauce.name.includes(word)) ? 6 : 0;
    score += pairing.toppings.includes(topping) ? 4 : 0;
    score += pairing.sides.includes(side) ? 4 : 0;
  }

  score += CUISINE_PROFILES[cuisine.key].toppings.includes(topping) ? 2 : 0;
  return score;
}

function buildIngredientLines(blueprint: BlueprintStructure) {
  const { cuisine, style, protein, carb, vegetables, aromatic, herb, acid, sauce, topping, crunchyTopping, pickle, cheese } = blueprint;
  const fat = cuisine.key === "comfort food" ? "2 tbsp butter" : cuisine.key === "asian" ? "1 tbsp neutral oil" : "2 tbsp olive oil";
  const proteinQuantity = getProteinQuantity(protein, protein === "eggs" ? "breakfast" : "dinner");
  const baseCarb =
    style === "salad"
      ? `4-6 cups greens or chopped ${vegetables[0]}`
      : protein === "eggs"
        ? `2 cups ${carb}`
      : ["rice", "quinoa", "cauliflower rice"].includes(carb)
        ? `1 cup ${carb}`
        : `12 oz ${carb}`;

  return unique([
    `${proteinQuantity} ${protein}`,
    baseCarb,
    ...vegetables.map((veg) => `1-2 cups ${veg}`),
    `2 cloves ${aromatic}`,
    fat,
    `${acid} for finishing`,
    `${herb} for finishing`,
    ...sauce.ingredients,
    topping,
    crunchyTopping ?? "",
    pickle ?? "",
    cheese ?? "",
    "Salt to taste",
    "Black pepper",
  ])
    .filter(Boolean)
    .map((name) => ({ name }));
}

function buildSteps(blueprint: BlueprintStructure) {
  const { style, protein, carb, vegetables, aromatic, herb, acid, sauce, topping, crunchyTopping, pickle, cheese } = blueprint;
  const vegetableText = humanList(vegetables);
  const finalTexture = [topping, crunchyTopping, pickle, cheese].filter(Boolean).join(", ");
  const sauceBehavior = describeSauceBehavior(style, sauce);
  const doneness = getProteinDonenessCue(protein);

  if (protein === "eggs") {
    return [
      { text: `Cook the ${carb} or breakfast base first and keep it warm.` },
      { text: `Saute ${vegetableText} with ${aromatic} until tender and lightly browned.` },
      { text: `Cook the eggs gently so they stay soft but fully set.` },
      { text: `${titleCase(sauce.method)} and ${sauceBehavior}.` },
      { text: `Bring everything together and finish with ${finalTexture}, ${herb}, and ${acid}.` },
    ];
  }

  if (style === "salad") {
    return [
      { text: `Cook the ${protein} until browned and ${doneness}, then rest and slice it.` },
      { text: `Build the base with greens and ${vegetableText} so the salad has freshness and crunch.` },
      { text: `${titleCase(sauce.method)} to make the ${sauce.name}, and ${sauceBehavior}.` },
      { text: `Toss lightly, then add the ${protein} back on top so it stays juicy.` },
      { text: `Finish with ${finalTexture} and extra ${acid} right before serving.` },
    ];
  }

  if (style === "roasted") {
    return [
      { text: `Heat the oven to 425°F. Arrange the ${protein}, ${vegetableText}, and ${carb} on a sheet pan.` },
      { text: `Season with salt, pepper, and ${aromatic}, then roast until browned and ${doneness}.` },
      { text: `While it cooks, ${sauce.method}, and ${sauceBehavior}.` },
      { text: `Plate everything and spoon over the ${sauce.name}.` },
      { text: `Finish with ${finalTexture}, ${herb}, and a final squeeze of ${acid}.` },
    ];
  }

  if (style === "stir-fry") {
    return [
      { text: `Cook the ${carb} first if needed and keep it warm.` },
      { text: `Sear the ${protein} in a hot pan until lightly browned and ${doneness}, then set it aside.` },
      { text: `Stir-fry ${vegetableText} with ${aromatic} until crisp-tender.` },
      { text: `Return the ${protein}, ${sauce.method}, and ${sauceBehavior}.` },
      { text: `Serve over the ${carb} and finish with ${finalTexture}.` },
    ];
  }

  if (style === "pasta") {
    return [
      { text: `Cook the ${carb} in well-salted water until al dente, reserving some cooking water.` },
      { text: `Brown the ${protein} in a skillet until ${doneness}, then set it aside.` },
      { text: `Cook ${vegetableText} with ${aromatic} until softened and fragrant.` },
      { text: `${titleCase(sauce.method)}, using a splash of pasta water to loosen if needed, and ${sauceBehavior}.` },
      { text: `Return the ${protein}, toss with the ${carb}, and finish with ${finalTexture}.` },
    ];
  }

  if (style === "bowl") {
    return [
      { text: `Cook the ${carb} and keep it warm as the base of the bowl.` },
      { text: `Season and cook the ${protein} until browned and ${doneness}.` },
      { text: `Cook ${vegetableText} with ${aromatic} until tender but still bright.` },
      { text: `${titleCase(sauce.method)} to create the finishing sauce, and ${sauceBehavior}.` },
      { text: `Build the bowl and finish with ${finalTexture}, ${herb}, and extra ${acid}.` },
    ];
  }

  return [
    { text: `Season the ${protein} well and sear it until browned and ${doneness}, then remove it from the pan.` },
    { text: `Cook ${vegetableText} with ${aromatic} until softened and lightly caramelized.` },
    { text: `Prepare or warm the ${carb} while the pan builds flavor.` },
    { text: `${titleCase(sauce.method)}, ${sauceBehavior}, then return the ${protein} to coat it in sauce.` },
    { text: `Serve with the ${carb} and finish with ${finalTexture}, ${herb}, and ${acid}.` },
  ];
}

function createBlueprint(intent: ParsedIntent, cuisine: CuisineProfile, style: RecipeStyle, descriptorIndex: number): RecipeBlueprint {
  const baseProtein = resolveProtein(intent);
  const pairing = findPairing(intent, baseProtein);
  const protein = applyProteinSubstitutions(baseProtein, intent);
  const carb = resolveCarb(intent, cuisine, style);
  const vegetables = resolveVegetables(intent, cuisine, pairing);
  const aromatic = resolveAromatic(intent, cuisine);
  const herb = resolveHerb(intent, cuisine, pairing);
  const acid = resolveAcid(intent, cuisine, pairing);
  const sauce = chooseSauce(cuisine, intent, pairing);
  const topping = chooseExtra(unique([...(pairing?.toppings ?? []), ...cuisine.toppings]), cuisine.toppings[0]) ?? "fresh herbs";
  const crunchyTopping = chooseExtra(cuisine.crunchyToppings, null);
  const pickle = chooseExtra(cuisine.pickles, null);
  const cheese = intent.preferences.includes("low carb") ? null : chooseExtra(cuisine.cheeses, null);
  const side = chooseExtra(unique([...(pairing?.sides ?? []), ...cuisine.sides]), cuisine.sides[0]) ?? "simple salad";
  const structure = { cuisine, style, protein, carb, vegetables, aromatic, herb, acid, sauce, topping, crunchyTopping, pickle, cheese, side };
  const ingredients = buildIngredientLines(structure);
  const pantryScore = estimatePantryScore(
    ingredients.map((item) => item.name),
    cuisine
  );
  const nutrition = estimateNutrition(protein, carb, style, cheese);
  const title = buildTitle(cuisine, style, protein, carb, vegetables, descriptorIndex);
  const description = buildDescription(cuisine, style, protein, carb, vegetables, sauce, topping, side, intent.preferences, nutrition);
  const cookTimeMin = Math.max(15, cookTimeForStyle(style) + getCookTimeAdjustment(protein, style));
  const score = scoreBlueprint({ intent, cuisine, style, protein, carb, vegetables, herb, acid, sauce, topping, side, pairing, pantryScore, nutrition });

  return {
    ...structure,
    title,
    description,
    cookTimeMin,
    score,
    pantryScore,
    nutrition,
    ingredients,
    steps: buildSteps(structure),
  };
}

function buildCandidateBlueprints(intent: ParsedIntent, tasteProfile?: UserTasteProfile) {
  const mergedIntent = mergeTasteProfile(intent, tasteProfile);
  const primaryCuisine = detectCuisine(mergedIntent);
  const cuisines = unique([primaryCuisine.key, ...mergedIntent.cuisines]).map((key) => CUISINE_PROFILES[key as Cuisine]);
  const candidates: RecipeBlueprint[] = [];

  cuisines.forEach((cuisine, cuisineIndex) => {
    cuisine.styles.forEach((style, styleIndex) => {
      const blueprint = createBlueprint(mergedIntent, cuisine, style, cuisineIndex + styleIndex);
      blueprint.score += scoreTasteProfile(blueprint, tasteProfile);
      if (!hasDislikedIngredient(blueprint.ingredients, tasteProfile)) {
        candidates.push(blueprint);
      }
    });
  });

  return candidates.sort((a, b) => b.score - a.score);
}

function inferIntentFromIdea(input: { ideaTitle: string; prompt?: string; ingredients?: string[] }) {
  return parseIntent(`${input.ideaTitle} ${input.prompt ?? ""}`, input.ingredients ?? []);
}

function mergeTasteProfile(intent: ParsedIntent, tasteProfile?: UserTasteProfile): ParsedIntent {
  if (!tasteProfile) return intent;

  const favoriteCuisines = normalizeTasteValues(tasteProfile.favoriteCuisines).filter((value): value is Cuisine =>
    (KNOWN.cuisines as readonly string[]).includes(value)
  );
  const favoriteProteins = normalizeTasteValues(tasteProfile.favoriteProteins).filter((value) => KNOWN.proteins.includes(value));
  const preferredFlavors = normalizeTasteValues(tasteProfile.preferredFlavors);
  const dietTags = normalizeTasteValues(tasteProfile.commonDietTags);
  const healthGoals = normalizeTasteValues(tasteProfile.healthGoals);

  const mergedPreferences = unique([
    ...intent.preferences,
    ...dietTags.flatMap((value) => {
      if (value.includes("vegetarian")) return ["vegetarian"];
      if (value.includes("gluten")) return ["gluten free"];
      if (value.includes("low carb")) return ["low carb"];
      return [];
    }),
    ...healthGoals.flatMap((value) => {
      if (value.includes("high protein")) return ["high protein"];
      if (value.includes("low carb")) return ["low carb"];
      return [];
    }),
    ...(tasteProfile.spiceTolerance?.toLowerCase().includes("high") || preferredFlavors.includes("spicy") ? ["spicy"] : []),
  ]) as Preference[];

  return {
    ...intent,
    cuisines: intent.cuisines.length > 0 ? intent.cuisines : favoriteCuisines,
    proteins: intent.proteins.length > 0 ? intent.proteins : favoriteProteins,
    flavors: intent.flavors.length > 0 ? intent.flavors : preferredFlavors,
    preferences: mergedPreferences,
  };
}

function hasDislikedIngredient(ingredients: Array<{ name: string }>, tasteProfile?: UserTasteProfile) {
  const disliked = normalizeTasteValues(tasteProfile?.dislikedIngredients);
  if (disliked.length === 0) return false;
  const text = ingredients.map((item) => item.name.toLowerCase()).join(" ");
  return disliked.some((item) => text.includes(item));
}

function scoreTasteProfile(blueprint: RecipeBlueprint, tasteProfile?: UserTasteProfile) {
  if (!tasteProfile) return 0;

  let score = 0;
  const favoriteCuisines = normalizeTasteValues(tasteProfile.favoriteCuisines);
  const favoriteProteins = normalizeTasteValues(tasteProfile.favoriteProteins);
  const preferredFlavors = normalizeTasteValues(tasteProfile.preferredFlavors);
  const pantryStaples = normalizeTasteValues(tasteProfile.pantryStaples);

  if (favoriteCuisines.includes(blueprint.cuisine.key)) score += 14;
  if (favoriteProteins.includes(blueprint.protein)) score += 10;
  if (preferredFlavors.some((value) => blueprint.description.toLowerCase().includes(value) || blueprint.sauce.name.toLowerCase().includes(value))) score += 8;
  if (pantryStaples.some((item) => blueprint.ingredients.some((ingredient) => ingredient.name.toLowerCase().includes(item)))) score += 5;
  if (hasDislikedIngredient(blueprint.ingredients, tasteProfile)) score -= 100;

  return score;
}

function isEggplantDipRequest(input: { ideaTitle: string; prompt?: string; ingredients?: string[] }) {
  const text = `${input.ideaTitle} ${input.prompt ?? ""} ${(input.ingredients ?? []).join(" ")}`.toLowerCase();
  const hasEggplant = text.includes("eggplant") || text.includes("aubergine") || text.includes("vinete");
  const hasDip = text.includes("dip") || text.includes("spread") || text.includes("salata de vinete") || text.includes("salată de vinete");
  return hasEggplant && hasDip;
}

function extractLeadIngredient(input: { ideaTitle: string; prompt?: string; ingredients?: string[] }) {
  const intent = inferIntentFromIdea(input);
  return (
    intent.vegetables[0] ??
    intent.proteins[0] ??
    intent.carbs[0] ??
    (input.ingredients ?? [])[0] ??
    "vegetable"
  );
}

function buildDishFamilyDraft(input: { ideaTitle: string; prompt?: string; ingredients?: string[] }, family: ParsedIntent["dishFamily"]): DeterministicRecipeDraft | null {
  const lead = titleCase(extractLeadIngredient(input));
  const text = `${input.ideaTitle} ${input.prompt ?? ""}`.toLowerCase();

  if (family === "pizza") {
    const focaccia = text.includes("focaccia");
    const title = focaccia ? "Crispy Focaccia Pizza" : `${lead} Pizza`;
    return {
      title,
      description: focaccia
        ? "A focaccia-style sheet-pan pizza with an airy base, crisp edges, and toppings chosen to stay in the pizza lane."
        : `A focused ${lead.toLowerCase()} pizza that stays anchored to the requested dish instead of drifting into another format.`,
      servings: 4,
      prep_time_min: 20,
      cook_time_min: 25,
      difficulty: "Medium",
      ingredients: [
        { name: focaccia ? "1 lb focaccia dough or pizza dough" : "1 lb pizza dough" },
        { name: "2 tbsp olive oil" },
        { name: "1/2 cup pizza sauce or crushed tomatoes" },
        { name: "8 oz mozzarella, shredded or torn" },
        { name: "1/4 cup parmesan" },
        { name: "1 tsp kosher salt" },
        { name: "Fresh basil or oregano for finishing" },
      ],
      steps: [
        { text: focaccia ? "Stretch the dough into an oiled sheet pan, dimple it lightly, and let it relax until airy and easy to shape." : "Stretch the dough on an oiled tray or pizza pan until evenly shaped with a slightly thicker rim." },
        { text: "Spread a thin layer of sauce over the dough, leaving a small border so the crust can brown properly." },
        { text: "Top with mozzarella and parmesan, then add any requested toppings sparingly so the crust stays crisp instead of soggy." },
        { text: "Bake in a very hot oven until the cheese is bubbling and the bottom and edges are deeply golden, then finish with herbs and a drizzle of olive oil." },
      ],
      remix_title: focaccia ? "Focaccia Pizza Squares" : `${lead} Pizza Toasts`,
      remix_description: focaccia
        ? "Reheat leftover focaccia pizza on a hot sheet pan so the underside crisps back up."
        : `Use leftover ${title.toLowerCase()} as crisp slices or chopped into a salad topping.`,
    };
  }

  if (family === "dip") {
    const title = `${lead} Dip`;
    return {
      title,
      description: `A focused, flavor-forward ${lead.toLowerCase()} dip built to match the conversation instead of drifting into another format.`,
      servings: 4,
      prep_time_min: 15,
      cook_time_min: 35,
      difficulty: "Easy",
      ingredients: [
        { name: `2 medium ${lead.toLowerCase()}` },
        { name: "2-3 tbsp olive oil" },
        { name: "1 small garlic clove or shallot, finely minced" },
        { name: "1-2 tsp lemon juice" },
        { name: "Salt to taste" },
        { name: "Black pepper to taste" },
      ],
      steps: [
        { text: `Cook or roast the ${lead.toLowerCase()} until very soft and any excess moisture can drain away.` },
        { text: `Mash or finely chop by hand for texture, then fold in the oil, aromatics, lemon, salt, and pepper.` },
        { text: "Taste and keep the seasoning restrained so the main ingredient stays in front." },
        { text: "Serve cool or at room temperature with bread, crackers, or sliced vegetables." },
      ],
      remix_title: `${lead} Dip Toasts`,
      remix_description: `Spread leftover ${title.toLowerCase()} on toast and finish with herbs or tomatoes.`,
    };
  }

  if (family === "soup") {
    const title = `${lead} Soup`;
    return {
      title,
      description: `A clean, focused ${lead.toLowerCase()} soup that stays true to the requested dish family with layered aromatics and a clear finishing note.`,
      servings: 4,
      prep_time_min: 15,
      cook_time_min: 35,
      difficulty: "Easy",
      ingredients: [
        { name: `1 lb ${lead.toLowerCase()}` },
        { name: "1 onion, diced" },
        { name: "2 cloves garlic, minced" },
        { name: "4 cups broth" },
        { name: "2 tbsp olive oil or butter" },
        { name: "Salt and black pepper" },
      ],
      steps: [
        { text: "Cook the onion and garlic in oil until soft and fragrant." },
        { text: `Add the ${lead.toLowerCase()} and cook briefly to build flavor.` },
        { text: "Add broth and simmer until the vegetables are fully tender and the soup tastes cohesive." },
        { text: "Blend or leave chunky depending on the requested style, then adjust seasoning and finish with herbs or acid." },
      ],
      remix_title: `${lead} Soup with Toasts`,
      remix_description: `Reheat leftovers and serve with crisp toast or a spoon of yogurt for contrast.`,
    };
  }

  if (family === "salad") {
    const title = `${lead} Salad`;
    return {
      title,
      description: `A crisp, direct ${lead.toLowerCase()} salad with enough acid and texture contrast to feel complete rather than generic.`,
      servings: 4,
      prep_time_min: 20,
      cook_time_min: 10,
      difficulty: "Easy",
      ingredients: [
        { name: `1 lb ${lead.toLowerCase()}` },
        { name: "4-6 cups greens or chopped vegetables" },
        { name: "1 tbsp olive oil" },
        { name: "1-2 tsp lemon juice or vinegar" },
        { name: "Fresh herbs" },
        { name: "Salt and black pepper" },
      ],
      steps: [
        { text: `Cook the ${lead.toLowerCase()} if needed, then let it cool slightly so the salad stays crisp.` },
        { text: "Build the salad base with greens or chopped vegetables and a simple vinaigrette." },
        { text: `Layer the ${lead.toLowerCase()} on top and finish with herbs and one crunchy element.` },
        { text: "Adjust acid right before serving so the salad tastes bright and balanced." },
      ],
      remix_title: `${lead} Salad Wrap`,
      remix_description: `Use leftover ${title.toLowerCase()} as a wrap filling with extra herbs and crunch.`,
    };
  }

  if (family === "tacos") {
    const title = `${lead} Tacos`;
    return {
      title,
      description: `A direct taco version centered on ${lead.toLowerCase()}, with clear contrast between warm filling, bright acid, and one crunchy topping.`,
      servings: 4,
      prep_time_min: 15,
      cook_time_min: 20,
      difficulty: "Easy",
      ingredients: [
        { name: `1 lb ${lead.toLowerCase()}` },
        { name: "8 small tortillas" },
        { name: "1 onion or cabbage slaw" },
        { name: "1 lime" },
        { name: "Fresh herbs" },
        { name: "Salt and pepper" },
      ],
      steps: [
        { text: `Cook the ${lead.toLowerCase()} with aromatics until browned and well seasoned.` },
        { text: "Warm the tortillas and prepare a simple crunchy topping like cabbage or onion." },
        { text: "Build the tacos and finish with lime and herbs so they taste bright instead of flat." },
      ],
      remix_title: `${lead} Taco Bowl`,
      remix_description: `Turn leftover taco filling into a bowl with rice or lettuce and extra lime.`,
    };
  }

  return null;
}

function buildEggplantDipDraft(input: { ideaTitle: string; prompt?: string; ingredients?: string[] }): DeterministicRecipeDraft {
  const text = `${input.ideaTitle} ${input.prompt ?? ""} ${(input.ingredients ?? []).join(" ")}`.toLowerCase();
  const romanian = text.includes("romanian") || text.includes("vinete");
  const delicate = text.includes("delicate") || text.includes("mild");
  const evoo = text.includes("evoo") || text.includes("olive oil");
  const oil = evoo ? "3 tbsp mild extra virgin olive oil" : romanian ? "3 tbsp sunflower oil" : "3 tbsp olive oil";
  const onion = delicate ? "1 small shallot, very finely minced" : "2 tbsp very finely minced sweet onion";
  const acid = delicate ? "1 tsp lemon juice (optional)" : "1-2 tsp lemon juice";
  const herb = delicate ? "1 tbsp parsley, finely chopped (optional)" : "1 tbsp parsley, finely chopped";
  const title = romanian
    ? delicate
      ? "Delicate Salată de Vinete"
      : "Salată de Vinete"
    : "Roasted Eggplant Dip";
  const description = romanian
    ? delicate
      ? "A delicate Romanian-style roasted eggplant dip with mild EVOO, finely minced shallot, and just enough lemon to keep it fresh without overpowering the eggplant."
      : "A classic Romanian roasted eggplant dip with silky texture, mild onion bite, and a clean finishing note from lemon."
    : "A smoky roasted eggplant dip with a soft, spreadable texture and a bright, savory finish.";

  return {
    title,
    description,
    servings: 4,
    prep_time_min: 15,
    cook_time_min: 40,
    difficulty: "Easy",
    ingredients: [
      { name: "2 medium eggplants" },
      { name: oil },
      { name: onion },
      { name: acid },
      { name: `${herb}` },
      { name: "Salt to taste" },
      { name: "Black pepper to taste" },
      { name: "Warm bread or tomatoes, for serving" },
    ],
    steps: [
      { text: "Heat the oven to 425°F. Roast the whole eggplants until fully collapsed and very soft, turning once, 35 to 45 minutes." },
      { text: "Split the eggplants and let them drain in a colander for 10 to 15 minutes so excess bitter liquid runs off." },
      { text: "Scoop out the flesh and finely chop or mash it by hand until soft and lightly textured, not completely pureed." },
      { text: `Fold in the ${oil.toLowerCase()}, ${onion.toLowerCase()}, and ${acid.toLowerCase()}. Season with salt and pepper.` },
      { text: `Finish with ${herb.toLowerCase()} if using, then chill slightly or serve at cool room temperature with bread or sliced tomatoes.` },
    ],
    remix_title: "Eggplant Dip Toasts",
    remix_description: "Use leftovers as a spread for toast with sliced tomatoes, herbs, and a drizzle of oil.",
  };
}

function buildImprovePrompt(basePrompt: string, goal: ImproveGoal) {
  switch (goal) {
    case "high protein":
      return `${basePrompt} high protein extra protein lighter carb`;
    case "vegetarian":
      return `${basePrompt} vegetarian tofu beans`;
    case "faster":
      return `${basePrompt} fast weeknight skillet 20 min`;
    case "spicier":
      return `${basePrompt} spicy chipotle chili`;
    default:
      return basePrompt;
  }
}

function buildRemixPrompt(recipe: GeneratedRecipe) {
  const title = recipe.title.toLowerCase();
  if (title.includes("bowl") || title.includes("rice")) {
    return `${recipe.title} leftovers remix into fried rice or stuffed peppers`;
  }
  if (title.includes("roasted") || title.includes("skillet")) {
    return `${recipe.title} leftovers remix into grain bowl lunch`;
  }
  if (title.includes("salad")) {
    return `${recipe.title} leftovers remix into wrap or toast`;
  }
  return `${recipe.title} leftovers remix into next-day bowl`;
}

function buildRemixTitle(recipe: GeneratedRecipe) {
  if (recipe.title.toLowerCase().includes("bowl")) {
    return `Crispy ${recipe.title.replace(/Bowl/i, "").trim()} Fried Rice`;
  }
  if (recipe.title.toLowerCase().includes("skillet")) {
    return `${recipe.title.replace(/Skillet/i, "").trim()} Lunch Bowl`;
  }
  if (recipe.title.toLowerCase().includes("roasted")) {
    return `${recipe.title.replace(/Roasted/i, "").trim()} Grain Bowl`;
  }
  return `Next-Day ${recipe.title}`;
}

export function generateLocalRecipeIdeas(prompt: string, providedIngredients: string[] = [], tasteProfile?: UserTasteProfile): RecipeIdea[] {
  const intent = parseIntent(prompt, providedIngredients);
  return buildCandidateBlueprints(intent, tasteProfile)
    .slice(0, 3)
    .map((blueprint) => ({
      title: blueprint.title,
      description: blueprint.description,
      cook_time_min: blueprint.cookTimeMin,
    }));
}

export function generateLocalChefReply(prompt: string, providedIngredients: string[] = [], tasteProfile?: UserTasteProfile): string {
  const intent = parseIntent(prompt, providedIngredients);
  const blueprints = buildCandidateBlueprints(intent, tasteProfile).slice(0, 3);
  if (blueprints.length === 0) {
    return "A good first move is a simple skillet or bowl with strong seasoning, one bright finishing note, and one crunchy element for contrast.";
  }

  const [first, second, third] = blueprints;
  const primaryLine = `${first.title} is your strongest option. ${first.description} Finish with ${first.topping}${first.pickle ? ` and ${first.pickle}` : ""}.`;
  const alternatives = [second, third]
    .filter(Boolean)
    .map((blueprint) => `${blueprint!.title} gives you a slightly different path with ${blueprint!.sauce.name} and a ${blueprint!.style === "bowl" ? "more layered, customizable finish" : blueprint!.style === "skillet" ? "deeper one-pan flavor" : "more complete plated feel"}.`);

  const proteinNote =
    typeof first.nutrition.protein === "number" && first.nutrition.protein > 0
      ? ` It should land around ${first.nutrition.protein}g protein per serving.`
      : "";

  return [primaryLine + proteinNote, ...alternatives.slice(0, 2)].join(" ");
}

export function generateLocalRecipeDraft(input: {
  ideaTitle: string;
  prompt?: string;
  ingredients?: string[];
}, tasteProfile?: UserTasteProfile): DeterministicRecipeDraft {
  if (isEggplantDipRequest(input)) {
    return buildEggplantDipDraft(input);
  }

  const intent = inferIntentFromIdea(input);
  const familyDraft = buildDishFamilyDraft(input, intent.dishFamily);
  if (familyDraft) {
    return familyDraft;
  }
  const blueprint = buildCandidateBlueprints(intent, tasteProfile)[0];
  const title = input.ideaTitle.trim() || blueprint.title;
  const remixTitle = buildRemixTitle({ title, description: blueprint.description, servings: 4, prep_time_min: 10, cook_time_min: blueprint.cookTimeMin, difficulty: "Easy", ingredients: blueprint.ingredients, steps: blueprint.steps });

  return {
    title,
    description: blueprint.description,
    servings: intent.mealType === "breakfast" ? 2 : 4,
    prep_time_min: blueprint.style === "roasted" ? 15 : 10,
    cook_time_min: blueprint.cookTimeMin,
    difficulty: "Easy",
    ingredients: blueprint.ingredients,
    steps: blueprint.steps,
    remix_title: remixTitle,
    remix_description: `Use leftovers to create ${remixTitle.toLowerCase()} by reheating the main components and adding one fresh crunchy element.`,
  };
}

export function generateLocalImprovedRecipe(
  recipe: GeneratedRecipe,
  goal: ImproveGoal,
  prompt = ""
): DeterministicRecipeDraft {
  return generateLocalRecipeDraft({
    ideaTitle: recipe.title,
    prompt: buildImprovePrompt(`${recipe.title} ${recipe.description ?? ""} ${prompt}`.trim(), goal),
    ingredients: recipe.ingredients.map((item) => item.name),
  });
}

export function generateLocalRemixRecipe(recipe: GeneratedRecipe): DeterministicRecipeDraft {
  return generateLocalRecipeDraft({
    ideaTitle: buildRemixTitle(recipe),
    prompt: buildRemixPrompt(recipe),
    ingredients: recipe.ingredients.map((item) => item.name),
  });
}
