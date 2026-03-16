import { callAIWithMeta } from "./aiClient";
import { buildChefChatPrompt, type AIMessage, type RecipeContext } from "./chatPromptBuilder";
import { TOKEN_LIMITS } from "./config/tokenLimits";
import type { AiTaskSettingRecord } from "./taskSettings";

export type ChefChatResult = {
  reply: string;
  repaired: boolean;
  initialReply: string;
  provider: string;
  finishReason?: string | null;
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

  if (/:\s*\d+[\.\)]?\s*$/.test(normalized)) {
    return true;
  }

  if (/\b\d+\.\s*$/.test(normalized)) {
    return true;
  }

  if (/:\s*$/.test(normalized)) {
    return true;
  }

  if (!/[.!?]$/.test(normalized) && !normalized.includes("\n")) {
    const trailingFragments = [
      "with",
      "and",
      "or",
      "to",
      "for",
      "into",
      "over",
      "using",
      "plus",
      "pan-sear",
      "sear",
      "roast",
      "saute",
      "then",
      "thin",
      "thick",
    ];
    const lastWord = normalized.split(/\s+/).filter(Boolean).at(-1) ?? "";
    if (trailingFragments.includes(lastWord)) {
      return true;
    }
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
  conversationHistory: AIMessage[] = [],
  userTasteSummary?: string,
  taskSetting?: AiTaskSettingRecord
): Promise<ChefChatResult> {
  const messages = buildChefChatPrompt(userMessage, recipeContext, conversationHistory, userTasteSummary);
  const aiOptions = {
    max_tokens: taskSetting?.maxTokens ?? TOKEN_LIMITS.chefChat.max_tokens,
    temperature: taskSetting?.temperature ?? TOKEN_LIMITS.chefChat.temperature,
    model: taskSetting?.primaryModel,
    fallback_models: taskSetting?.fallbackModel ? [taskSetting.fallbackModel] : [],
  };
  const firstAttempt = await callAIWithMeta(messages, aiOptions);
  const firstReply = firstAttempt.text;

  if (!looksIncomplete(firstReply)) {
    return {
      reply: firstReply,
      repaired: false,
      initialReply: firstReply,
      provider: firstAttempt.provider,
      finishReason: firstAttempt.finishReason ?? null,
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

  const repairedAttempt = await callAIWithMeta(repairMessages, aiOptions);
  const repairedReply = repairedAttempt.text;

  if (looksIncomplete(repairedReply)) {
    throw new Error("Chef chat returned incomplete content after repair.");
  }

  return {
    reply: repairedReply.trim().length > 0 ? repairedReply : firstReply,
    repaired: true,
    initialReply: firstReply,
    provider: repairedAttempt.provider,
    finishReason: repairedAttempt.finishReason ?? null,
  };
}
