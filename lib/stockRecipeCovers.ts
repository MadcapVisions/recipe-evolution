const STOCK_COVER_BUCKETS = {
  cookies: [
    "/assets/stock_photos/chocolate_chip_cookies.jpg",
    "/assets/stock_photos/chocolate_cookies.jpg",
  ],
  brownies: ["/assets/stock_photos/brownie.jpg"],
  iceCream: [
    "/assets/stock_photos/chocholate_ice_cream.jpg",
    "/assets/stock_photos/vanilla_ice_cream.jpg",
  ],
  cakesAndTarts: [
    "/assets/stock_photos/fruit_tart.jpg",
    "/assets/stock_photos/chocolate_cake.jpg",
    "/assets/stock_photos/cheesecake-2.jpg",
    "/assets/stock_photos/vanilla_cakejpg.jpg",
    "/assets/stock_photos/apple_pie-1.jpg",
    "/assets/stock_photos/fruit_crumble.jpg",
    "/assets/stock_photos/chocholate_mousse.jpg",
  ],
  breakfast: [
    "/assets/stock_photos/pancakes.jpg",
    "/assets/stock_photos/breakfast_egg_toast.jpg",
    "/assets/stock_photos/breakfast_avocado_toast.jpg.jpg",
  ],
  salads: [
    "/assets/stock_photos/salad-1.jpg",
    "/assets/stock_photos/mixed_salad.jpg",
    "/assets/stock_photos/mixed_salad_2.jpg",
    "/assets/stock_photos/spinach_strawberry_salad.jpg",
    "/assets/stock_photos/avocado_quinoa_salad.jpg",
  ],
  bowls: [
    "/assets/stock_photos/rice-bowl-1.jpg",
    "/assets/stock_photos/rice-bowl-2.jpg",
    "/assets/stock_photos/rice-bowl-3.jpg",
    "/assets/stock_photos/vegan_veggie_bowl.jpg",
    "/assets/stock_photos/vegetarian_qunoa.jpg",
  ],
  soups: [
    "/assets/stock_photos/hearty_soup.jpg",
    "/assets/stock_photos/tomato_soup-1.jpg",
    "/assets/stock_photos/potato_squash_soup.jpg",
  ],
  sandwiches: [
    "/assets/stock_photos/burger.jpg",
    "/assets/stock_photos/avocado_cheese_sandwich.jpg",
    "/assets/stock_photos/chicken_sandwich.jpg",
    "/assets/stock_photos/veggie_wrap.jpg",
  ],
  pizza: [
    "/assets/stock_photos/meat_pizza.jpg",
    "/assets/stock_photos/shrimp_pizza.jpg",
  ],
  pasta: [
    "/assets/stock_photos/pasta-1.jpg",
    "/assets/stock_photos/pasta-2.jpg",
    "/assets/stock_photos/pasta-3.jpg",
    "/assets/stock_photos/pasta-4.jpg",
    "/assets/stock_photos/stir_fry_noodles.jpg",
  ],
  seafood: [
    "/assets/stock_photos/seafood-1.jpg",
    "/assets/stock_photos/seafood-2.jpg",
    "/assets/stock_photos/seafood-3.jpg",
    "/assets/stock_photos/sushi.jpg",
  ],
  beef: [
    "/assets/stock_photos/beef-1.jpg",
    "/assets/stock_photos/beef-2.jpg",
  ],
  chicken: [
    "/assets/stock_photos/chicken-1.jpg",
    "/assets/stock_photos/chicken-2.jpg",
    "/assets/stock_photos/chicken-3.jpg",
    "/assets/stock_photos/roasted_chicken_potatoes.jpg",
    "/assets/stock_photos/veggie_chicken_skillet.jpg",
  ],
  vegetables: [
    "/assets/stock_photos/roasted_vegetables.jpg",
    "/assets/stock_photos/roasted_vegetables_2.jpg",
  ],
  tacos: ["/assets/stock_photos/tacos_variety.jpg"],
  dipsAndBoards: [
    "/assets/stock_photos/dips.jpg",
    "/assets/stock_photos/hummus_dips.jpg",
    "/assets/stock_photos/bread_cheese_charcuterie.jpg",
    "/assets/stock_photos/meat_cheese_charcuterie.jpg.jpg",
    "/assets/stock_photos/bread_loves.jpg",
  ],
  generic: [
    "/assets/stock_photos/Lucid_Origin_professional_photo_of_beautiful_plated_home_cooke_0.jpg",
    "/assets/stock_photos/roasted_vegetables.jpg",
    "/assets/stock_photos/roasted_vegetables_2.jpg",
    "/assets/stock_photos/vegan_veggie_bowl.jpg",
    "/assets/stock_photos/mixed_salad.jpg",
  ],
} as const;

type Bucket = keyof typeof STOCK_COVER_BUCKETS;
type CoverAsset = { src: string; keywords?: string[] };

type Rule = {
  bucket: Bucket;
  titlePhrases?: string[];
  titleWords?: string[];
  tagWords?: string[];
  ingredientWords?: string[];
  titleWeight?: number;
  tagWeight?: number;
  ingredientWeight?: number;
};

const RULES: Rule[] = [
  {
    bucket: "cookies",
    titleWords: ["cookie", "cookies"],
    titleWeight: 14,
  },
  {
    bucket: "brownies",
    titleWords: ["brownie", "brownies", "blondie", "blondies"],
    titleWeight: 14,
  },
  {
    bucket: "iceCream",
    titlePhrases: ["ice cream"],
    titleWords: ["gelato", "sorbet"],
    titleWeight: 14,
  },
  {
    bucket: "cakesAndTarts",
    titleWords: ["cake", "cheesecake", "tart", "pie", "crumble", "cobbler", "mousse", "flan"],
    titleWeight: 14,
    ingredientWords: ["cocoa", "berries", "berry", "whipped", "pastry"],
    ingredientWeight: 1,
  },
  {
    bucket: "tacos",
    titleWords: ["taco", "tacos", "quesadilla", "quesadillas"],
    titleWeight: 14,
  },
  {
    bucket: "pizza",
    titleWords: ["pizza", "flatbread"],
    titleWeight: 14,
  },
  {
    bucket: "pasta",
    titleWords: ["pasta", "spaghetti", "linguine", "fettuccine", "penne", "ziti", "lasagna", "mac", "orzo", "ramen", "noodles", "noodle"],
    titlePhrases: ["stir fry noodles", "stir fry noodle", "stir-fry noodles", "stir-fry noodle", "lo mein"],
    titleWeight: 14,
    ingredientWords: ["pasta", "spaghetti", "linguine", "fettuccine", "penne", "ziti", "orzo", "noodles", "noodle"],
    ingredientWeight: 2,
  },
  {
    bucket: "bowls",
    titleWords: ["bowl", "bowls"],
    titlePhrases: ["rice bowl", "grain bowl"],
    tagWords: ["bowl", "grain-bowl"],
    titleWeight: 14,
    tagWeight: 6,
    ingredientWords: ["rice", "quinoa", "beans", "bean", "chickpea", "chickpeas", "lentil", "lentils"],
    ingredientWeight: 2,
  },
  {
    bucket: "salads",
    titleWords: ["salad", "salads", "salata", "salat"],
    titleWeight: 14,
    tagWords: ["salad"],
    tagWeight: 6,
  },
  {
    bucket: "soups",
    titleWords: ["soup", "soups", "stew", "stews", "chili", "chilies", "bisque"],
    titleWeight: 14,
  },
  {
    bucket: "dipsAndBoards",
    titleWords: ["dip", "dips", "hummus", "mezze", "board", "boards", "charcuterie", "platter", "spread", "vinete", "baba", "ghanoush", "baba-ghanoush", "babaghanoush"],
    titleWeight: 14,
  },
  {
    bucket: "sandwiches",
    titleWords: ["sandwich", "sandwiches", "burger", "burgers", "wrap", "wraps", "panini", "paninis", "melt", "melts"],
    titleWeight: 14,
  },
  {
    bucket: "breakfast",
    titleWords: ["breakfast", "brunch", "pancake", "pancakes", "toast", "toasts", "omelet", "omelette"],
    titlePhrases: ["avocado toast", "egg toast", "french toast"],
    titleWeight: 14,
  },
  {
    bucket: "seafood",
    titleWords: ["shrimp", "fish", "salmon", "cod", "tuna", "seafood", "prawn", "sushi"],
    titleWeight: 10,
    tagWords: ["seafood", "fish", "shrimp"],
    tagWeight: 6,
    ingredientWords: ["shrimp", "fish", "salmon", "cod", "tuna", "prawn"],
    ingredientWeight: 2,
  },
  {
    bucket: "chicken",
    titleWords: ["chicken", "thigh", "thighs", "drumstick", "drumsticks"],
    titleWeight: 8,
    tagWords: ["chicken"],
    tagWeight: 5,
    ingredientWords: ["chicken"],
    ingredientWeight: 2,
  },
  {
    bucket: "beef",
    titleWords: ["beef", "steak", "meatball", "meatballs", "brisket"],
    titleWeight: 8,
    tagWords: ["beef", "steak"],
    tagWeight: 5,
    ingredientWords: ["beef", "steak"],
    ingredientWeight: 2,
  },
  {
    bucket: "vegetables",
    titleWords: ["vegetable", "vegetables", "veggie", "veggies", "tofu", "eggplant", "aubergine", "squash", "cauliflower", "roasted", "chickpea", "chickpeas", "lentil", "lentils", "bean", "beans", "potato", "potatoes", "casserole"],
    titlePhrases: ["chickpea skillet", "lentil skillet", "bean skillet", "rice patties", "bean patties", "eggplant dip"],
    titleWeight: 8,
    tagWords: ["vegetarian", "vegan", "veggie", "mediterranean"],
    tagWeight: 5,
    ingredientWords: ["eggplant", "aubergine", "squash", "cauliflower", "zucchini", "tofu", "chickpea", "chickpeas", "lentil", "lentils", "bean", "beans", "potato", "potatoes"],
    ingredientWeight: 2,
  },
];

const TOKEN_SYNONYMS: Record<string, string[]> = {
  vinete: ["eggplant", "dip"],
  aubergine: ["eggplant"],
  aubergines: ["eggplant"],
  eggplants: ["eggplant"],
  salata: ["salad"],
  salat: ["salad"],
  flan: ["custard", "vanilla"],
  garbanzo: ["chickpea"],
  garbanzos: ["chickpea"],
  chickpeas: ["chickpea"],
  lentils: ["lentil"],
  beans: ["bean"],
  patties: ["patty", "fritter"],
  pattie: ["patty"],
};

const STOCK_ASSET_KEYWORDS: Record<string, string[]> = {
  "/assets/stock_photos/chocolate_chip_cookies.jpg": ["cookie", "cookies", "chocolate", "chip"],
  "/assets/stock_photos/chocolate_cookies.jpg": ["cookie", "cookies", "chocolate"],
  "/assets/stock_photos/brownie.jpg": ["brownie", "brownies", "bar"],
  "/assets/stock_photos/chocholate_ice_cream.jpg": ["ice", "cream", "chocolate"],
  "/assets/stock_photos/vanilla_ice_cream.jpg": ["ice", "cream", "vanilla"],
  "/assets/stock_photos/fruit_tart.jpg": ["fruit", "tart", "berry"],
  "/assets/stock_photos/chocolate_cake.jpg": ["chocolate", "cake", "dessert"],
  "/assets/stock_photos/cheesecake-2.jpg": ["cheesecake", "cake", "cream"],
  "/assets/stock_photos/vanilla_cakejpg.jpg": ["cake", "vanilla", "plain", "pound", "lemon", "flan", "custard"],
  "/assets/stock_photos/apple_pie-1.jpg": ["apple", "pie", "dessert"],
  "/assets/stock_photos/fruit_crumble.jpg": ["crumble", "fruit", "dessert"],
  "/assets/stock_photos/chocholate_mousse.jpg": ["mousse", "dessert", "chocolate"],
  "/assets/stock_photos/pancakes.jpg": ["pancake", "breakfast", "brunch"],
  "/assets/stock_photos/breakfast_egg_toast.jpg": ["breakfast", "egg", "toast"],
  "/assets/stock_photos/breakfast_avocado_toast.jpg.jpg": ["breakfast", "avocado", "toast"],
  "/assets/stock_photos/salad-1.jpg": ["salad", "greens", "mixed"],
  "/assets/stock_photos/mixed_salad.jpg": ["salad", "greens", "mixed"],
  "/assets/stock_photos/mixed_salad_2.jpg": ["salad", "greens", "mixed"],
  "/assets/stock_photos/spinach_strawberry_salad.jpg": ["salad", "spinach", "strawberry", "fruit"],
  "/assets/stock_photos/avocado_quinoa_salad.jpg": ["salad", "quinoa", "avocado"],
  "/assets/stock_photos/rice-bowl-1.jpg": ["bowl", "rice", "grain", "beans"],
  "/assets/stock_photos/rice-bowl-2.jpg": ["bowl", "rice", "grain", "vegetable"],
  "/assets/stock_photos/rice-bowl-3.jpg": ["bowl", "rice", "grain", "beans"],
  "/assets/stock_photos/vegan_veggie_bowl.jpg": ["bowl", "vegan", "veggie", "vegetable"],
  "/assets/stock_photos/vegetarian_qunoa.jpg": ["bowl", "quinoa", "vegetarian", "chickpea"],
  "/assets/stock_photos/hearty_soup.jpg": ["soup", "stew", "chili", "hearty", "beef", "bean"],
  "/assets/stock_photos/tomato_soup-1.jpg": ["soup", "tomato", "bisque"],
  "/assets/stock_photos/potato_squash_soup.jpg": ["soup", "potato", "squash", "creamy"],
  "/assets/stock_photos/burger.jpg": ["burger", "sandwich"],
  "/assets/stock_photos/avocado_cheese_sandwich.jpg": ["sandwich", "avocado", "cheese"],
  "/assets/stock_photos/chicken_sandwich.jpg": ["sandwich", "chicken"],
  "/assets/stock_photos/veggie_wrap.jpg": ["wrap", "sandwich", "veggie"],
  "/assets/stock_photos/meat_pizza.jpg": ["pizza", "meat"],
  "/assets/stock_photos/shrimp_pizza.jpg": ["pizza", "shrimp", "seafood"],
  "/assets/stock_photos/pasta-1.jpg": ["pasta", "spaghetti", "tomato"],
  "/assets/stock_photos/pasta-2.jpg": ["pasta", "linguine", "creamy", "lemon"],
  "/assets/stock_photos/pasta-3.jpg": ["pasta", "fettuccine", "creamy"],
  "/assets/stock_photos/pasta-4.jpg": ["pasta", "penne", "tomato"],
  "/assets/stock_photos/stir_fry_noodles.jpg": ["noodles", "stir", "stir-fry", "asian"],
  "/assets/stock_photos/seafood-1.jpg": ["seafood", "fish", "shrimp"],
  "/assets/stock_photos/seafood-2.jpg": ["seafood", "fish", "shrimp"],
  "/assets/stock_photos/seafood-3.jpg": ["seafood", "fish", "shrimp"],
  "/assets/stock_photos/sushi.jpg": ["sushi", "seafood", "fish"],
  "/assets/stock_photos/beef-1.jpg": ["beef", "steak"],
  "/assets/stock_photos/beef-2.jpg": ["beef", "steak"],
  "/assets/stock_photos/chicken-1.jpg": ["chicken", "roasted"],
  "/assets/stock_photos/chicken-2.jpg": ["chicken", "roasted"],
  "/assets/stock_photos/chicken-3.jpg": ["chicken", "roasted"],
  "/assets/stock_photos/roasted_chicken_potatoes.jpg": ["chicken", "roasted", "potatoes", "sheet-pan"],
  "/assets/stock_photos/veggie_chicken_skillet.jpg": ["chicken", "skillet", "vegetable"],
  "/assets/stock_photos/roasted_vegetables.jpg": ["vegetable", "veggie", "roasted", "eggplant", "aubergine"],
  "/assets/stock_photos/roasted_vegetables_2.jpg": ["vegetable", "veggie", "roasted", "chickpea", "mediterranean", "bean"],
  "/assets/stock_photos/tacos_variety.jpg": ["taco", "tacos"],
  "/assets/stock_photos/dips.jpg": ["dip", "dips", "mezze", "eggplant", "spread"],
  "/assets/stock_photos/hummus_dips.jpg": ["dip", "dips", "hummus", "mezze", "eggplant", "baba", "ghanoush"],
  "/assets/stock_photos/bread_cheese_charcuterie.jpg": ["board", "charcuterie", "bread", "cheese"],
  "/assets/stock_photos/meat_cheese_charcuterie.jpg.jpg": ["board", "charcuterie", "meat", "cheese"],
  "/assets/stock_photos/bread_loves.jpg": ["bread", "loaf", "board"],
  "/assets/stock_photos/Lucid_Origin_professional_photo_of_beautiful_plated_home_cooke_0.jpg": ["savory", "plated", "generic", "vegetable"],
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(value: string) {
  return new Set(normalize(value).split(" ").filter(Boolean));
}

function expandWords(words: Set<string>) {
  const expanded = new Set(words);
  for (const word of words) {
    for (const synonym of TOKEN_SYNONYMS[word] ?? []) {
      expanded.add(normalize(synonym));
    }
  }
  return expanded;
}

function containsPhrase(value: string, phrase: string) {
  return normalize(value).includes(normalize(phrase));
}

function countWordMatches(words: Set<string>, candidates: string[]) {
  return candidates.reduce((count, candidate) => count + (words.has(normalize(candidate)) ? 1 : 0), 0);
}

function pickDeterministic(items: readonly string[], seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return items[hash % items.length] ?? null;
}

function pickBestAsset(bucket: Bucket, seed: string, queryWords: Set<string>) {
  const assets: CoverAsset[] = STOCK_COVER_BUCKETS[bucket].map((src) => ({
    src,
    keywords: STOCK_ASSET_KEYWORDS[src] ?? [],
  }));

  const scored = assets.map((asset) => {
    const score = (asset.keywords ?? []).reduce((total, keyword) => total + (queryWords.has(normalize(keyword)) ? 1 : 0), 0);
    return { asset, score };
  });

  const bestScore = Math.max(...scored.map((item) => item.score), 0);
  const candidates = bestScore > 0 ? scored.filter((item) => item.score === bestScore).map((item) => item.asset.src) : assets.map((item) => item.src);
  return pickDeterministic(candidates, seed);
}

function scoreRule(rule: Rule, input: {
  normalizedTitle: string;
  normalizedTags: string[];
  normalizedIngredients: string[];
  titleWords: Set<string>;
  tagWords: Set<string>;
  ingredientWords: Set<string>;
}) {
  let score = 0;
  const reasons: string[] = [];

  if (rule.titlePhrases?.length) {
    const matched = rule.titlePhrases.filter((phrase) => containsPhrase(input.normalizedTitle, phrase));
    if (matched.length) {
      score += matched.length * (rule.titleWeight ?? 10);
      reasons.push(...matched.map((item) => `title:${item}`));
    }
  }

  if (rule.titleWords?.length) {
    const matchedCount = countWordMatches(input.titleWords, rule.titleWords);
    if (matchedCount) {
      score += matchedCount * (rule.titleWeight ?? 10);
      reasons.push(...rule.titleWords.filter((item) => input.titleWords.has(normalize(item))).map((item) => `title:${item}`));
    }
  }

  if (rule.tagWords?.length) {
    const matchedCount = countWordMatches(input.tagWords, rule.tagWords);
    if (matchedCount) {
      score += matchedCount * (rule.tagWeight ?? 4);
      reasons.push(...rule.tagWords.filter((item) => input.tagWords.has(normalize(item))).map((item) => `tag:${item}`));
    }
  }

  if (rule.ingredientWords?.length) {
    const matchedCount = countWordMatches(input.ingredientWords, rule.ingredientWords);
    if (matchedCount) {
      score += matchedCount * (rule.ingredientWeight ?? 1);
      reasons.push(...rule.ingredientWords.filter((item) => input.ingredientWords.has(normalize(item))).map((item) => `ingredient:${item}`));
    }
  }

  return { score, reasons };
}

export function resolveStockRecipeCover(input: {
  recipeId?: string | null;
  title: string;
  tags?: string[] | null;
  ingredientNames?: string[] | null;
}) {
  const normalizedTitle = normalize(input.title);
  const normalizedTags = (input.tags ?? []).map(normalize);
  const normalizedIngredients = (input.ingredientNames ?? []).map(normalize);
  const titleWords = expandWords(tokenize(input.title));
  const tagWords = expandWords(tokenize(normalizedTags.join(" ")));
  const ingredientWords = expandWords(tokenize(normalizedIngredients.join(" ")));
  const queryWords = new Set([...titleWords, ...tagWords, ...ingredientWords]);
  const seed = `${input.recipeId ?? ""}:${input.title}`;

  let bestBucket: Bucket = "generic";
  let bestScore = 0;
  let bestReasons: string[] = [];

  for (const rule of RULES) {
    const result = scoreRule(rule, {
      normalizedTitle,
      normalizedTags,
      normalizedIngredients,
      titleWords,
      tagWords,
      ingredientWords,
    });

    if (result.score > bestScore) {
      bestBucket = rule.bucket;
      bestScore = result.score;
      bestReasons = result.reasons;
    }
  }

  return {
    bucket: bestBucket,
    score: bestScore,
    reasons: bestReasons,
    coverUrl: pickBestAsset(bestBucket, seed, queryWords),
  };
}

export function getStockRecipeCover(input: {
  recipeId?: string | null;
  title: string;
  tags?: string[] | null;
  ingredientNames?: string[] | null;
}) {
  return resolveStockRecipeCover(input).coverUrl;
}
