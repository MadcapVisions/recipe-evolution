import { callAI } from "./aiClient";
import { TOKEN_LIMITS } from "./config/tokenLimits";
import { parseRecipeResponse } from "./schema/parseRecipeResponse";

export type HomeIdea = {
  title: string;
  description: string;
  cook_time_min: number | null;
};

export type HomeGeneratedRecipe = {
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
  filters?: {
    cuisine?: string;
    protein?: string;
    mealType?: string;
    cookingTime?: string;
  };
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
]);

const toTitleCase = (value: string) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

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

function buildFallbackIdeas(input: IdeaInput, count = 6): HomeIdea[] {
  const seed = extractSeedLabel(input).slice(0, 40);
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

function normalizeIdeas(value: unknown): HomeIdea[] {
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
          title,
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
      title,
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
            return { name: (item as { name: string }).name.trim() };
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

function buildIdeasPrompt(input: IdeaInput) {
  if (input.mode === "ingredients_ideas") {
    return `User ingredients: ${JSON.stringify(input.ingredients ?? [])}
Already shown idea titles (must NOT repeat any): ${JSON.stringify(input.excludeTitles ?? [])}
Current batch index: ${input.batchIndex ?? 1}
Generate exactly 6 recipe ideas the user can cook with these ingredients.
Rules:
- All titles must be unique and appealing.
- Vary cooking style across the 6 ideas.
- Each description must be 2-3 full sentences explaining flavor profile, texture, and overall style.
Return ONLY valid JSON:
{
  "ideas": [
    { "title": string, "description": string, "cook_time_min": number }
  ]
}`;
  }

  if (input.mode === "filtered_ideas") {
    return `Generate exactly 5 recipe ideas from these filters:
${JSON.stringify(input.filters ?? {}, null, 2)}
Return ONLY valid JSON:
{
  "ideas": [
    { "title": string, "description": string, "cook_time_min": number }
  ]
}`;
  }

  return `User craving prompt: ${input.prompt ?? ""}
Already shown idea titles (must NOT repeat any): ${JSON.stringify(input.excludeTitles ?? [])}
Current batch index: ${input.batchIndex ?? 1}
Generate exactly 6 recipe ideas.
Rules:
- All titles must be unique and appealing.
- Vary cooking style across the 6 ideas.
- Each description must be 2-3 full sentences explaining flavor profile, texture, and overall style.
Return ONLY valid JSON:
{
  "ideas": [
    { "title": string, "description": string, "cook_time_min": number }
  ]
}`;
}

export async function generateHomeIdeas(input: IdeaInput): Promise<HomeIdea[]> {
  const messages = [
    {
      role: "system" as const,
      content:
        "You are a recipe ideation assistant. Return only valid JSON. Keep titles distinct and natural. Keep ideas practical for a home cook.",
    },
    {
      role: "user" as const,
      content: buildIdeasPrompt(input),
    },
  ];

  try {
    const raw = await callAI(messages, TOKEN_LIMITS.recipeGeneration);
    const parsed = parseRecipeResponse(raw);
    const ideas = normalizeIdeas(parsed);
    return ideas.length > 0 ? ideas : buildFallbackIdeas(input, input.mode === "filtered_ideas" ? 5 : 6);
  } catch {
    return buildFallbackIdeas(input, input.mode === "filtered_ideas" ? 5 : 6);
  }
}

export async function generateHomeRecipe(input: {
  ideaTitle: string;
  prompt?: string;
  ingredients?: string[];
}): Promise<HomeGeneratedRecipe> {
  const messages = [
    {
      role: "system" as const,
      content: `You are a professional recipe developer.
Return ONLY valid JSON:
{
  "title": string,
  "description": string|null,
  "servings": number|null,
  "prep_time_min": number|null,
  "cook_time_min": number|null,
  "difficulty": string|null,
  "ingredients": [{ "name": string }],
  "steps": [{ "text": string }]
}
Rules:
- Keep ingredients concise.
- Keep steps practical and home-cook friendly.
- Produce a complete recipe, not notes.`,
    },
    {
      role: "user" as const,
      content: `Generate a full recipe for this selected idea:
Idea: ${input.ideaTitle}
Prompt context: ${input.prompt ?? ""}
Ingredients context: ${JSON.stringify(input.ingredients ?? [])}`,
    },
  ];

  const raw = await callAI(messages, TOKEN_LIMITS.recipeGeneration);
  const parsed = parseRecipeResponse(raw);
  const recipe = normalizeRecipe(parsed, input.ideaTitle);

  if (!recipe) {
    throw new Error("AI returned invalid recipe payload.");
  }

  return recipe;
}
