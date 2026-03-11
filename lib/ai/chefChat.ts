import { callAI } from "./aiClient";
import { buildChefChatPrompt, type RecipeContext } from "./chatPromptBuilder";
import { TOKEN_LIMITS } from "./config/tokenLimits";

export async function chefChat(userMessage: string, recipeContext: RecipeContext): Promise<string> {
  const messages = buildChefChatPrompt(userMessage, recipeContext);
  return callAI(messages, TOKEN_LIMITS.chefChat);
}
