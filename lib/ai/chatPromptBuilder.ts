import { CHEF_SYSTEM_PROMPT } from "./chefSystemPrompt";
import { CHEF_CHAT_REGRESSION_EXAMPLES, RECIPE_CHAT_EXAMPLES } from "./chefChatExamples";
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

export function buildChefChatPrompt(
  userMessage: string,
  recipeContext: RecipeContext,
  conversationHistory: AIMessage[] = [],
  userTasteSummary?: string,
  sessionMemory?: string | null
): AIMessage[] {
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
    ...(sessionMemory?.trim()
      ? [
          {
            role: "system" as const,
            content: sessionMemory.trim(),
          },
        ]
      : []),
    {
      role: "system",
      content: `
You are in conversation mode only.
Give the user concrete meal direction quickly.
If the user asks for "best options", "what would be flavorful", or something similar, respond with actual options instead of asking them to restate their goal.
When the user has already supplied meal type, main ingredients, or flavor direction, synthesize that information and move forward.
When the user explicitly asks for multiple options, give exactly 2-3 compact options.
Requests for sauces, dips, spreads, snack pairings, or appetizer ideas are cooking requests and should be answered directly.
Format each option on its own line as:
OPTION 1: ...
OPTION 2: ...
OPTION 3: ...
After that, add one short line that names the strongest option.
`,
    },
    {
      role: "system",
      content: `
${contextText}

User Taste Profile:
${userTasteSummary?.trim() || "No user taste profile available."}

Flavor Suggestions From Chef Engine:
${flavorAdvice.length > 0 ? flavorAdvice.join("\n") : "None"}

${flavorGraphContext}

${substitutionContext}

${cookingContext}
`,
    },
    // Home hub gets general meal-discovery examples; recipe-bound chat gets
    // recipe-modification examples that stay anchored to the current dish.
    ...(recipeContext ? RECIPE_CHAT_EXAMPLES : CHEF_CHAT_REGRESSION_EXAMPLES),
    ...conversationHistory,
    {
      role: "user",
      content: userMessage,
    },
  ];
}
