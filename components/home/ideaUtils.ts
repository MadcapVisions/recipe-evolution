import type { RecipeIdea } from "@/components/home/types";

const IDEA_VISUALS = [
  { icon: "🍛", bg: "from-orange-100 to-amber-200" },
  { icon: "🥘", bg: "from-rose-100 to-orange-200" },
  { icon: "🍲", bg: "from-blue-100 to-indigo-200" },
  { icon: "🥗", bg: "from-green-100 to-emerald-200" },
  { icon: "🍝", bg: "from-pink-100 to-fuchsia-200" },
  { icon: "🌶️", bg: "from-red-100 to-rose-200" },
  { icon: "🍜", bg: "from-violet-100 to-indigo-200" },
  { icon: "🍗", bg: "from-yellow-100 to-orange-200" },
];

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const getIdeaIcon = (idea: RecipeIdea, index: number) => {
  const text = `${idea.title} ${idea.description}`.toLowerCase();
  if (text.includes("salad") || text.includes("vegetarian") || text.includes("veggie")) {
    return "🥗";
  }
  if (text.includes("pasta") || text.includes("noodle")) {
    return "🍝";
  }
  if (text.includes("soup") || text.includes("stew")) {
    return "🍲";
  }
  if (text.includes("spicy") || text.includes("chili") || text.includes("hot")) {
    return "🌶️";
  }
  if (text.includes("chicken") || text.includes("wing") || text.includes("turkey")) {
    return "🍗";
  }
  return IDEA_VISUALS[index % IDEA_VISUALS.length].icon;
};

export const getIconTone = (idea: RecipeIdea) => {
  const text = `${idea.title} ${idea.description}`.toLowerCase();
  if (text.includes("vegetarian") || text.includes("veggie") || text.includes("salad")) {
    return "bg-green-100";
  }
  if (text.includes("spicy") || text.includes("chili") || text.includes("hot")) {
    return "bg-red-100";
  }
  if (
    text.includes("protein") ||
    text.includes("chicken") ||
    text.includes("beef") ||
    text.includes("fish") ||
    text.includes("shrimp")
  ) {
    return "bg-blue-100";
  }
  if (text.includes("comfort") || text.includes("creamy") || text.includes("butter")) {
    return "bg-yellow-100";
  }
  const fallback = IDEA_VISUALS[hashString(idea.title) % IDEA_VISUALS.length];
  return `bg-gradient-to-br ${fallback.bg}`;
};

export const getIdeaTags = (idea: RecipeIdea): string[] => {
  const tags: string[] = [];
  const text = `${idea.title} ${idea.description}`.toLowerCase();
  const cookMinutes = typeof idea.cook_time_min === "number" ? idea.cook_time_min : 30;
  tags.push(`🕒 ${cookMinutes} min`);

  if (text.includes("easy") || cookMinutes <= 30) {
    tags.push("Easy");
  } else if (cookMinutes <= 45) {
    tags.push("Medium");
  } else {
    tags.push("Hard");
  }

  if (text.includes("one-pan") || text.includes("skillet") || text.includes("sheet pan")) {
    tags.push("One Pan");
  } else if (text.includes("soup") || text.includes("stew")) {
    tags.push("Simmered");
  } else if (text.includes("pasta") || text.includes("noodle")) {
    tags.push("Stovetop");
  } else {
    tags.push("One Pan");
  }

  return tags;
};

const buildIdeaDescriptionFromTitle = (title: string) => {
  const lower = title.toLowerCase();
  if (lower.includes("pasta") || lower.includes("fettuccine") || lower.includes("noodle")) {
    return "This pasta leans into layered aromatics and a sauce that clings to every bite. Expect a cozy, savory profile with enough acidity or herbs to keep it bright. It is styled to feel dinner-party worthy while still being manageable at home.";
  }
  if (lower.includes("bowl")) {
    return "This bowl combines hearty protein, soft grains, and crisp toppings for texture contrast. The flavor profile is balanced between savory depth and a clean finishing note. It is satisfying without feeling too heavy.";
  }
  if (lower.includes("burger")) {
    return "This burger-style option is built for rich, juicy flavor and a crisp exterior. The toppings and sauce are designed to add brightness so the dish stays balanced. You get comfort-food impact with a cleaner, more polished finish.";
  }
  if (lower.includes("salmon") || lower.includes("fish") || lower.includes("shrimp")) {
    return "This seafood-forward dish is bright, aromatic, and lightly rich. Gentle cooking keeps the protein tender while citrus, herbs, or spice sharpen the flavor. It is elegant enough for a special night but still practical to execute.";
  }
  if (lower.includes("chicken")) {
    return "This chicken dish develops flavor through browning, aromatics, and layered seasoning. The profile is savory and rounded with just enough lift from acid or herbs. It is designed to taste polished without requiring complicated technique.";
  }
  if (lower.includes("vegetarian") || lower.includes("chickpea") || lower.includes("tofu")) {
    return "This meat-free recipe focuses on texture contrast and deep seasoning so it feels complete. Creamy, crisp, and bright elements are balanced for a full flavor arc. It is wholesome, satisfying, and far from bland.";
  }
  return "This recipe idea is designed for layered flavor and balanced texture from start to finish. Expect a savory core with bright accents that keep each bite lively. It aims for a restaurant-style result using approachable home techniques.";
};

const ensureDetailedIdeaDescription = (description: string, title: string) => {
  const normalized = description.trim().replace(/\s+/g, " ");
  const sentenceCount = normalized
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;

  if (sentenceCount >= 2 && normalized.length >= 140) {
    return normalized;
  }

  return buildIdeaDescriptionFromTitle(title);
};

export const cookTimeLabelToMinutes = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("1 hour")) return 60;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isNaN(parsed) ? 30 : parsed;
};

const normalizeSmartValue = (value: string) => value.trim().toLowerCase();

const describeSmartFlavorProfile = ({
  format,
  protein,
  cuisine,
  preferences,
  cookMinutes,
}: {
  format: "bowl" | "skillet" | "plate";
  protein: string;
  cuisine: string;
  preferences: string[];
  cookMinutes: number;
}) => {
  const normalizedCuisine = cuisine.trim().toLowerCase();
  const normalizedProtein = protein.trim().toLowerCase();
  const normalizedPreferences = preferences.map((item) => item.trim().toLowerCase());

  const cuisineProfile =
    normalizedCuisine === "mexican"
      ? "Expect smoky seasoning, lime brightness, and a savory finish that keeps the dish lively."
      : normalizedCuisine === "italian"
        ? "Expect garlic, herbs, and a bright citrus or parmesan finish for a polished, balanced bite."
        : normalizedCuisine === "asian"
          ? "Expect ginger, soy, sesame, and a clean acidic lift that keeps the flavor sharp and layered."
          : normalizedCuisine === "mediterranean"
            ? "Expect lemon, herbs, and clean savory depth with a fresh finish that never feels heavy."
            : normalizedCuisine === "comfort food"
              ? "Expect deeper savory notes, gentle richness, and enough brightness to keep it from feeling too heavy."
              : "Expect balanced seasoning, a clean finish, and practical weeknight flavor.";

  const proteinProfile =
    normalizedProtein === "chicken"
      ? "Chicken gives it an easy savory base that works well with herbs, browning, and quick pan sauces."
      : normalizedProtein === "pork"
        ? "Pork brings richer savory flavor, so the profile works best with acidity, char, or a lightly spicy finish."
        : normalizedProtein === "fish"
          ? "Fish keeps the dish lighter and benefits from bright acid, herbs, and a gentler aromatic finish."
          : normalizedProtein === "beef"
            ? "Beef gives this direction more depth and a stronger browned flavor core."
            : normalizedProtein === "tofu"
              ? "Tofu keeps the dish lighter while soaking up sauce, aromatics, and spice especially well."
              : normalizedProtein === "beans"
                ? "Beans make the dish hearty and satisfying while pairing well with herbs, spice, and bright finishing notes."
                : normalizedProtein === "eggs"
                  ? "Eggs make it softer and more delicate, with room for herbs, spice, and savory contrast."
                  : "The protein keeps the dish satisfying while leaving room for sauce and texture contrast.";

  const preferenceNotes = [
    normalizedPreferences.includes("high protein") ? "It is tuned to feel filling and protein-forward." : null,
    normalizedPreferences.includes("low carb") ? "The structure stays lighter and avoids unnecessary heaviness." : null,
    normalizedPreferences.includes("spicy") ? "A gentle chili heat would fit naturally here." : null,
    normalizedPreferences.includes("vegetarian") ? "The flavors are built to feel complete even without meat." : null,
    normalizedPreferences.includes("gluten free") ? "The format stays naturally simple and gluten-friendly." : null,
  ]
    .filter(Boolean)
    .join(" ");

  const formatProfile =
    format === "bowl"
      ? "As a bowl, it gives you soft grains, savory protein, and room for crunchy or herb-driven toppings."
      : format === "skillet"
        ? "As a skillet, the flavor leans more browned, concentrated, and weeknight-friendly."
        : `As a plated dinner, it feels more complete and dinner-table ready within about ${cookMinutes} minutes.`;

  return [cuisineProfile, proteinProfile, formatProfile, preferenceNotes].filter(Boolean).join(" ");
};

export const getRecipeCategory = (title: string) => {
  const text = title.toLowerCase();
  if (text.includes("cake") || text.includes("cookie") || text.includes("pie") || text.includes("dessert")) {
    return "Dessert";
  }
  if (text.includes("chicken") || text.includes("beef") || text.includes("pork") || text.includes("protein")) {
    return "Protein";
  }
  if (text.includes("shrimp") || text.includes("fish") || text.includes("salmon") || text.includes("seafood")) {
    return "Seafood";
  }
  if (text.includes("spicy") || text.includes("chili") || text.includes("sriracha")) {
    return "Spicy";
  }
  return "Other";
};

export const matchesProtein = (text: string, proteinSelections: string[]) => {
  const normalizedSelections = proteinSelections.map(normalizeSmartValue);
  if (normalizedSelections.length === 0 || normalizedSelections.includes("no preference")) return true;
  return normalizedSelections.some((normalizedProtein) => {
    if (normalizedProtein === "fish") {
      return ["fish", "salmon", "tuna", "cod", "halibut", "trout", "shrimp"].some((token) => text.includes(token));
    }
    return text.includes(normalizedProtein);
  });
};

export const matchesCuisine = (text: string, cuisineSelections: string[]) => {
  const normalizedSelections = cuisineSelections.map(normalizeSmartValue);
  if (normalizedSelections.length === 0) return true;
  return normalizedSelections.some((normalizedCuisine) => {
    if (normalizedCuisine === "healthy") {
      return ["healthy", "light", "balanced", "high-protein", "low-carb"].some((token) => text.includes(token));
    }
    if (normalizedCuisine === "comfort food") {
      return ["comfort", "creamy", "hearty", "cozy"].some((token) => text.includes(token));
    }
    return text.includes(normalizedCuisine);
  });
};

export const matchesCookTime = (cookTimeMin: number | null, cookTimeSelections: number[]) => {
  if (cookTimeSelections.length === 0) return true;
  const value = typeof cookTimeMin === "number" ? cookTimeMin : 30;
  return cookTimeSelections.includes(value);
};

export const buildSmartFallbackIdeas = (
  proteins: string[],
  cuisines: string[],
  cookTimeMinutes: number[],
  preferences: string[]
): RecipeIdea[] => {
  const proteinBase = proteins.filter((item) => normalizeSmartValue(item) !== "no preference");
  const proteinText = proteinBase.length > 0 ? proteinBase[0] : "Protein-Packed";
  const cuisineText = cuisines.length > 0 ? cuisines[0] : "Balanced";
  const cookMinutes = cookTimeMinutes.length > 0 ? cookTimeMinutes[0] : 30;
  const prefText = preferences.length ? `${preferences[0]} ` : "";
  return [
    {
      title: `${cuisineText} ${proteinText} Bowl`,
      description: `${prefText}${describeSmartFlavorProfile({
        format: "bowl",
        protein: proteinText,
        cuisine: cuisineText,
        preferences,
        cookMinutes,
      })}`,
      cook_time_min: cookMinutes,
    },
    {
      title: `${cuisineText} ${proteinText} Skillet`,
      description: `${prefText}${describeSmartFlavorProfile({
        format: "skillet",
        protein: proteinText,
        cuisine: cuisineText,
        preferences,
        cookMinutes,
      })}`,
      cook_time_min: cookMinutes,
    },
    {
      title: `${cuisineText} ${proteinText} Plate`,
      description: `${prefText}${describeSmartFlavorProfile({
        format: "plate",
        protein: proteinText,
        cuisine: cuisineText,
        preferences,
        cookMinutes,
      })}`,
      cook_time_min: cookMinutes,
    },
  ];
};

const FALLBACK_STOP_WORDS = new Set([
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
  "make",
  "something",
  "dish",
  "meal",
  "ideas",
  "give",
  "some",
  "using",
  "have",
  "love",
  "like",
  "let",
  "lets",
  "dinner",
  "lunch",
  "breakfast",
]);

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function buildPromptFallbackIdeas(prompt: string): RecipeIdea[] {
  const parts = prompt
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/,|\n|\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 2 && !FALLBACK_STOP_WORDS.has(item));

  const base = toTitleCase(parts.slice(0, 3).join(" ")) || "Chef Special";
  const descriptors = [
    {
      title: `${base} Skillet`,
      description: `A savory, weeknight-friendly skillet direction built around ${base.toLowerCase()} with strong browning and bright finishing notes.`,
    },
    {
      title: `${base} Bowl`,
      description: `A balanced bowl format that keeps ${base.toLowerCase()} hearty, practical, and easy to customize with sauce or crunch.`,
    },
    {
      title: `Roasted ${base} Plate`,
      description: `A roasted dinner direction that leans into caramelized flavor, simple prep, and a clean, satisfying finish.`,
    },
  ];

  return descriptors.map((item, index) => ({
    title: item.title,
    description: item.description,
    cook_time_min: index === 0 ? 25 : index === 1 ? 30 : 35,
  }));
}

export const normalizeIdeas = (value: unknown): RecipeIdea[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: RecipeIdea[] = [];

  for (const item of value) {
    if (typeof item === "string") {
      const title = item.trim();
      if (!title) {
        continue;
      }
      normalized.push({
        title,
        description: ensureDetailedIdeaDescription(buildIdeaDescriptionFromTitle(title), title),
        cook_time_min: 30,
      });
      continue;
    }

    if (typeof item !== "object" || item === null) {
      continue;
    }

    const raw = item as Record<string, unknown>;
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!title) {
      continue;
    }

    const rawDescription = typeof raw.description === "string" ? raw.description.trim() : "";
    const looksLikePlaceholder =
      !rawDescription ||
      /^ai-generated recipe idea\.?$/i.test(rawDescription) ||
      /^ai generated recipe idea\.?$/i.test(rawDescription);

    const baseDescription = looksLikePlaceholder ? buildIdeaDescriptionFromTitle(title) : rawDescription;

    normalized.push({
      title,
      description: ensureDetailedIdeaDescription(baseDescription, title),
      cook_time_min: typeof raw.cook_time_min === "number" ? raw.cook_time_min : 30,
    });
  }

  return normalized;
};
