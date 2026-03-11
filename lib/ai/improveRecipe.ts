import { callAI } from "./aiClient";
import { CHEF_SYSTEM_PROMPT } from "./chefSystemPrompt";
import { TOKEN_LIMITS } from "./config/tokenLimits";
import { parseRecipeResponse } from "./schema/parseRecipeResponse";
import { validateRecipe } from "./schema/recipeValidator";

type ImproveRecipeInput = {
  instruction: string;
  recipe: {
    title: string;
    servings: number | null;
    prep_time_min: number | null;
    cook_time_min: number | null;
    difficulty: string | null;
    ingredients: Array<{ name: string }>;
    steps: Array<{ text: string }>;
  };
};

export type ImproveRecipeResult = {
  title: string;
  explanation: string | null;
  servings: number | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  difficulty: string | null;
  ingredients: Array<{ name: string }>;
  steps: Array<{ text: string }>;
};

function normalizeIngredients(value: unknown): Array<{ name: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const name = (item as Record<string, unknown>).name;
      if (typeof name !== "string" || !name.trim()) {
        return null;
      }
      return { name: name.trim() };
    })
    .filter((item): item is { name: string } => item !== null);
}

function normalizeSteps(value: unknown): Array<{ text: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const text = (item as Record<string, unknown>).text;
      if (typeof text !== "string" || !text.trim()) {
        return null;
      }
      return { text: text.trim() };
    })
    .filter((item): item is { text: string } => item !== null);
}

export async function improveRecipe(input: ImproveRecipeInput): Promise<ImproveRecipeResult> {
  const messages = [
    {
      role: "system" as const,
      content: `${CHEF_SYSTEM_PROMPT}

When asked to improve a recipe, you must return ONLY valid JSON with no markdown:
{
  "title": string,
  "explanation": string,
  "servings": number|null,
  "prep_time_min": number|null,
  "cook_time_min": number|null,
  "difficulty": string|null,
  "ingredients": [{ "name": string }],
  "steps": [{ "text": string }]
}

Rules:
- Always make meaningful changes for the instruction.
- Keep ingredient names concise.
- Keep steps practical and home-cook friendly.
- Do not include any text outside the JSON object.`,
    },
    {
      role: "user" as const,
      content: `Instruction:
${input.instruction}

Current recipe:
${JSON.stringify(input.recipe, null, 2)}`,
    },
  ];

  const raw = await callAI(messages, TOKEN_LIMITS.recipeVariation);
  const parsed = parseRecipeResponse(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI returned invalid recipe payload.");
  }

  const obj = parsed as Record<string, unknown>;
  const ingredients = normalizeIngredients(obj.ingredients);
  const steps = normalizeSteps(obj.steps);
  const title = typeof obj.title === "string" && obj.title.trim() ? obj.title.trim() : input.recipe.title;
  const normalizedRecipeForValidation = {
    title,
    ingredients: ingredients.map((item) => item.name),
    steps: steps.map((item) => item.text),
    chefTips: Array.isArray(obj.chefTips)
      ? obj.chefTips
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .map((item) => item.trim())
      : [],
  };

  if (!validateRecipe(normalizedRecipeForValidation)) {
    throw new Error("Invalid recipe format returned by AI");
  }

  const explanation =
    typeof obj.explanation === "string" && obj.explanation.trim().length > 0 ? obj.explanation.trim() : null;

  return {
    title,
    explanation,
    servings: typeof obj.servings === "number" ? obj.servings : input.recipe.servings,
    prep_time_min: typeof obj.prep_time_min === "number" ? obj.prep_time_min : input.recipe.prep_time_min,
    cook_time_min: typeof obj.cook_time_min === "number" ? obj.cook_time_min : input.recipe.cook_time_min,
    difficulty:
      typeof obj.difficulty === "string" && obj.difficulty.trim().length > 0
        ? obj.difficulty.trim()
        : input.recipe.difficulty,
    ingredients,
    steps,
  };
}
