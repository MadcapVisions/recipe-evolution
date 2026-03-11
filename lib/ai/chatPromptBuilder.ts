import { CHEF_SYSTEM_PROMPT } from "./chefSystemPrompt";
import { analyzeFlavor } from "./chefEngine/flavorAnalyzer";
import { generateFlavorContext } from "./flavorGraph/flavorGraphEngine";
import { generateSubstitutionContext } from "./substitutionEngine/substitutionEngine";
import { buildCookingContext } from "./preprocessing/buildCookingContext";

export type RecipeContext = {
  title?: string;
  ingredients?: string[];
  steps?: string[];
} | null;

export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function buildChefChatPrompt(userMessage: string, recipeContext: RecipeContext): AIMessage[] {
  let contextText = "";

  if (recipeContext) {
    contextText = `
Current Recipe Context

Title: ${recipeContext.title ?? "Unknown"}

Ingredients:
${recipeContext.ingredients?.join(", ") ?? "None provided"}

Steps:
${recipeContext.steps?.join("\n") ?? "None provided"}
`;
  }

  const flavorAdvice = analyzeFlavor(recipeContext?.ingredients || []);
  const flavorGraphContext = generateFlavorContext(recipeContext?.ingredients || []);
  const substitutionContext = generateSubstitutionContext(recipeContext?.ingredients || []);
  const cookingContext = buildCookingContext(recipeContext?.ingredients || []);

  return [
    {
      role: "system",
      content: CHEF_SYSTEM_PROMPT,
    },
    {
      role: "system",
      content:
        "You are currently in conversation mode only. Provide guidance and suggestions only. Never provide a full recipe or full ingredient/instruction blocks in this mode.",
    },
    {
      role: "user",
      content: `
${contextText}

Flavor Suggestions From Chef Engine:
${flavorAdvice.length > 0 ? flavorAdvice.join("\n") : "None"}

${flavorGraphContext}

${substitutionContext}

${cookingContext}

User question:

${userMessage}
`,
    },
  ];
}
