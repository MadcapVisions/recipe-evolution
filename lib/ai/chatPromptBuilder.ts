import { CHEF_SYSTEM_PROMPT } from "./chefSystemPrompt";
import { CHEF_CHAT_REGRESSION_EXAMPLES } from "./chefChatExamples";
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

function buildConversationRailsPrompt(conversationRails: string[]) {
  if (conversationRails.length === 0) {
    return null;
  }

  return `Active Conversation Rails:
${conversationRails.map((rail) => `- ${rail}`).join("\n")}

Rules for rails:
- Treat these rails as active constraints for the current conversation.
- If a rail already settles a choice, do not ask the user to choose outside that rail.
- Do not suggest contradictory directions unless the user explicitly changes the rail.
- If the rail says Chicken, stay in the chicken lane and do not ask whether they want vegetarian or another main protein.
- Prefer to move the dish forward inside these rails instead of reopening already-resolved decisions.`;
}

export function buildChefChatPrompt(
  userMessage: string,
  recipeContext: RecipeContext,
  conversationHistory: AIMessage[] = [],
  userTasteSummary?: string,
  conversationRails: string[] = []
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
  const railsPrompt = buildConversationRailsPrompt(
    conversationRails.map((rail) => rail.trim()).filter((rail) => rail.length > 0)
  );

  return [
    {
      role: "system",
      content: CHEF_SYSTEM_PROMPT,
    },
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

${railsPrompt ? `${railsPrompt}\n` : ""}

User Taste Profile:
${userTasteSummary?.trim() || "No user taste profile available."}

Flavor Suggestions From Chef Engine:
${flavorAdvice.length > 0 ? flavorAdvice.join("\n") : "None"}

${flavorGraphContext}

${substitutionContext}

${cookingContext}
`,
    },
    ...CHEF_CHAT_REGRESSION_EXAMPLES,
    ...conversationHistory,
    {
      role: "user",
      content: userMessage,
    },
  ];
}
