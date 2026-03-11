import { callAI } from "./aiClient";
import { RECIPE_GENERATOR_PROMPT } from "./recipeGeneratorPrompt";
import { detectTechniques } from "./chefEngine/techniqueDetector";
import { injectTechniques } from "./chefEngine/techniqueInjector";
import { analyzeFlavor } from "./chefEngine/flavorAnalyzer";
import { generateFlavorContext } from "./flavorGraph/flavorGraphEngine";
import { generateSubstitutionContext } from "./substitutionEngine/substitutionEngine";
import { buildCookingContext } from "./preprocessing/buildCookingContext";
import { TOKEN_LIMITS } from "./config/tokenLimits";
import { parseRecipeResponse } from "./schema/parseRecipeResponse";
import { validateRecipe } from "./schema/recipeValidator";
import { buildTemplateContext } from "./templateEngine/applyTemplate";

export type GeneratedRecipeSchema = {
  title: string;
  ingredients: string[];
  steps: string[];
  chefTips: string[];
};

function extractCoreIngredientNames(ingredients: string[]): string[] {
  return ingredients
    .map((line) =>
      line
        .toLowerCase()
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
    )
    .flat()
    .filter((token, index, arr) => arr.indexOf(token) === index);
}

export async function generateRecipe(prompt: string, userIngredients: string[] = []): Promise<GeneratedRecipeSchema> {
  const flavorContext = generateFlavorContext(userIngredients);
  const substitutionContext = generateSubstitutionContext(userIngredients);
  const cookingContext = buildCookingContext(userIngredients);
  const templateContext = buildTemplateContext(prompt);
  const promptWithFlavorContext = `${prompt}
${flavorContext}
${substitutionContext}
${cookingContext}
${templateContext}`;

  const messages = [
    {
      role: "system" as const,
      content: RECIPE_GENERATOR_PROMPT,
    },
    {
      role: "user" as const,
      content: promptWithFlavorContext,
    },
  ];

  const rawResponse = await callAI(messages, TOKEN_LIMITS.recipeGeneration);
  const parsed = parseRecipeResponse(rawResponse);

  if (!validateRecipe(parsed)) {
    throw new Error("Invalid recipe format returned by AI");
  }

  const baseRecipe: GeneratedRecipeSchema = {
    title: parsed.title.trim(),
    ingredients: parsed.ingredients
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim())
      .slice(0, 12),
    steps: parsed.steps
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim())
      .slice(0, 8),
    chefTips: Array.isArray(parsed.chefTips)
      ? parsed.chefTips
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .map((item) => item.trim())
          .slice(0, 3)
      : [],
  };

  const ingredientTokens = extractCoreIngredientNames(baseRecipe.ingredients);
  const techniques = detectTechniques(ingredientTokens);
  baseRecipe.steps = injectTechniques(baseRecipe.steps, techniques);

  const flavorAdvice = analyzeFlavor(ingredientTokens);
  if (flavorAdvice.length > 0) {
    baseRecipe.chefTips = [...baseRecipe.chefTips, ...flavorAdvice].slice(0, 3);
  }

  return baseRecipe;
}
