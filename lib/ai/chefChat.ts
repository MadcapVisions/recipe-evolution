import { callAI } from "./aiClient";
import { buildChefChatPrompt, type AIMessage, type RecipeContext } from "./chatPromptBuilder";
import { TOKEN_LIMITS } from "./config/tokenLimits";

export type ChefChatResult = {
  reply: string;
  repaired: boolean;
  initialReply: string;
};

function looksIncomplete(reply: string): boolean {
  const normalized = reply.trim().toLowerCase();

  if (normalized.length < 40) {
    return true;
  }

  const incompleteEndings = [
    "consider these options",
    "here are some options",
    "your best options are",
    "i'd suggest these options",
    "you could try",
    "for example",
    "such as",
  ];

  if (incompleteEndings.some((ending) => normalized.endsWith(ending) || normalized.endsWith(`${ending}:`))) {
    return true;
  }

  const sentenceCount = normalized.split(/[.!?]+/).filter((part) => part.trim().length > 0).length;
  if (sentenceCount < 2 && !normalized.includes("\n")) {
    return true;
  }

  return false;
}

export async function chefChat(
  userMessage: string,
  recipeContext: RecipeContext,
  conversationHistory: AIMessage[] = []
): Promise<ChefChatResult> {
  const messages = buildChefChatPrompt(userMessage, recipeContext, conversationHistory);
  const firstReply = await callAI(messages, TOKEN_LIMITS.chefChat);

  if (!looksIncomplete(firstReply)) {
    return {
      reply: firstReply,
      repaired: false,
      initialReply: firstReply,
    };
  }

  const repairMessages: AIMessage[] = [
    ...messages,
    { role: "assistant", content: firstReply },
    {
      role: "user",
      content:
        "Your previous reply was incomplete. Give a complete answer now. If you mention options, explicitly list 2-3 concrete meal directions with flavor cues. Do not write an intro without finishing it.",
    },
  ];

  const repairedReply = await callAI(repairMessages, TOKEN_LIMITS.chefChat);
  return {
    reply: repairedReply.trim().length > 0 ? repairedReply : firstReply,
    repaired: true,
    initialReply: firstReply,
  };
}
