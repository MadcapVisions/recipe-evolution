import { callAI } from "./aiClient";
import { buildChefChatPrompt, type AIMessage, type RecipeContext } from "./chatPromptBuilder";
import { TOKEN_LIMITS } from "./config/tokenLimits";

export async function chefChat(userMessage: string, recipeContext: RecipeContext, conversationHistory: AIMessage[] = []): Promise<string> {
  const messages = buildChefChatPrompt(userMessage, recipeContext, conversationHistory);
  return callAI(messages, TOKEN_LIMITS.chefChat);
}
