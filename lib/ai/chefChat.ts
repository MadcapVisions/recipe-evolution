import { callAIForJson } from "./jsonResponse";
import { buildChefChatPrompt, type AIMessage, type RecipeContext } from "./chatPromptBuilder";
import { buildChefChatEnvelope, normalizeChefChatEnvelope, type ChefChatEnvelope } from "./chefOptions";
import { TOKEN_LIMITS } from "./config/tokenLimits";
import type { AiTaskSettingRecord } from "./taskSettings";

export type ChefChatResult = {
  envelope: ChefChatEnvelope;
  repaired: boolean;
  initialReply: string;
  provider: string;
  finishReason?: string | null;
};

function userExplicitlyRequestsNewOptions(message: string) {
  const normalized = message.toLowerCase();
  return (
    /\b(?:more|new|different|another)\s+(?:options?|ideas?|variations?|alternatives?|directions?|choices?)\b/.test(normalized) ||
    /\b(?:show|give)\s+me\b.+\b(?:options?|ideas?|variations?|alternatives?|directions?|choices?)\b/.test(normalized) ||
    /\b(?:2|3)\s+(?:options?|ideas?|variations?|alternatives?|directions?|choices?)\b/.test(normalized)
  );
}

function extractLockedDirectionTitle(conversationHistory: AIMessage[]) {
  const lockedMessage = conversationHistory.find(
    (message) => message.role === "assistant" && message.content.trim().toLowerCase().startsWith("locked direction:")
  );
  if (!lockedMessage) {
    return null;
  }

  const match = lockedMessage.content.match(/locked direction:\s*([^.\n]+)/i);
  return match?.[1]?.trim() ?? null;
}

function looksIncompleteEnvelope(envelope: ChefChatEnvelope): boolean {
  const normalized = envelope.reply.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  if (envelope.mode === "options") {
    if (envelope.options.length < 2) {
      return true;
    }

    if (normalized.length < 60) {
      return true;
    }

    return false;
  }

  if (normalized.length < 18) {
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
  if (sentenceCount < 1 && !normalized.includes("\n")) {
    return true;
  }

  return false;
}

function buildStructuredMessages(
  userMessage: string,
  recipeContext: RecipeContext,
  conversationHistory: AIMessage[],
  userTasteSummary?: string,
  forceRefine = false,
  lockedDirectionTitle?: string | null
): AIMessage[] {
  return [
    ...buildChefChatPrompt(userMessage, recipeContext, conversationHistory, userTasteSummary),
    {
      role: "system",
      content: `Return ONLY valid JSON with this shape:
{
  "mode": "options" | "refine",
  "reply": string,
  "options": [{ "id": string, "title": string, "summary": string, "tags": string[] }],
  "recommended_option_id": string | null
}

Rules:
- Use mode "options" only when the user explicitly asked for multiple ideas, options, directions, or variations.
- If the conversation already has a locked or chosen direction, stay in refine mode unless the user explicitly asks for new options again.
- In options mode, return exactly 2 or 3 options.
- In refine mode, return no options and recommended_option_id must be null.
- Keep reply concise and cooking-specific.
- The reply text should match the structured fields exactly.
- Do not include markdown fences or any text outside the JSON object.`,
    },
    ...(forceRefine
      ? [
          {
            role: "system" as const,
            content: `A direction is already locked${lockedDirectionTitle ? `: ${lockedDirectionTitle}` : ""}. You must stay on that exact dish and refine it. Do not return new dish options for this turn.`,
          },
        ]
      : []),
  ];
}

function normalizeOrBuildEnvelope(parsed: unknown, rawText: string) {
  return normalizeChefChatEnvelope(parsed) ?? buildChefChatEnvelope(rawText);
}

export async function chefChat(
  userMessage: string,
  recipeContext: RecipeContext,
  conversationHistory: AIMessage[] = [],
  userTasteSummary?: string,
  taskSetting?: AiTaskSettingRecord
): Promise<ChefChatResult> {
  const lockedDirectionTitle = extractLockedDirectionTitle(conversationHistory);
  const forceRefine = Boolean(lockedDirectionTitle) && !userExplicitlyRequestsNewOptions(userMessage);
  const messages = buildStructuredMessages(userMessage, recipeContext, conversationHistory, userTasteSummary, forceRefine, lockedDirectionTitle);
  const aiOptions = {
    max_tokens: taskSetting?.maxTokens ?? TOKEN_LIMITS.chefChat.max_tokens,
    temperature: taskSetting?.temperature ?? TOKEN_LIMITS.chefChat.temperature,
    model: taskSetting?.primaryModel,
    fallback_models: taskSetting?.fallbackModel ? [taskSetting.fallbackModel] : [],
  };

  const firstAttempt = await callAIForJson(messages, aiOptions);
  const firstEnvelope = normalizeOrBuildEnvelope(firstAttempt.parsed, firstAttempt.text);
  const firstReply = firstEnvelope.reply;
  const firstViolatedRefineLock = forceRefine && firstEnvelope.mode === "options";

  if (!looksIncompleteEnvelope(firstEnvelope) && !firstViolatedRefineLock) {
    return {
      envelope: firstEnvelope,
      repaired: false,
      initialReply: firstReply,
      provider: firstAttempt.provider,
      finishReason: firstAttempt.finishReason ?? null,
    };
  }

  const repairMessages: AIMessage[] = [
    ...messages,
    {
      role: "assistant",
      content: JSON.stringify(firstEnvelope),
    },
    {
      role: "user",
      content:
        forceRefine
          ? `You incorrectly returned new options. A direction is already locked${lockedDirectionTitle ? `: ${lockedDirectionTitle}` : ""}. Return one refine response about that chosen dish only. Do not return options.`
          : "Your previous JSON reply was incomplete or weak. Return a complete JSON response now. If mode is options, include exactly 2 or 3 concrete options and a recommended_option_id. If mode is refine, return no options.",
    },
  ];

  const repairedAttempt = await callAIForJson(repairMessages, aiOptions);
  const repairedEnvelope = normalizeOrBuildEnvelope(repairedAttempt.parsed, repairedAttempt.text);
  const repairedViolatedRefineLock = forceRefine && repairedEnvelope.mode === "options";
  const repairedUsable = !looksIncompleteEnvelope(repairedEnvelope) && !repairedViolatedRefineLock;
  const firstUsable = !looksIncompleteEnvelope(firstEnvelope);

  const forcedRefineFallback =
    forceRefine && repairedViolatedRefineLock
      ? {
          mode: "refine" as const,
          reply: `${lockedDirectionTitle ? `Stay with ${lockedDirectionTitle}. ` : ""}${(repairedEnvelope.options.find((option) => option.id === repairedEnvelope.recommended_option_id) ?? repairedEnvelope.options[0])?.summary ?? repairedEnvelope.reply}`,
          options: [],
          recommended_option_id: null,
        }
      : null;

  return {
    envelope: repairedUsable
      ? repairedEnvelope
      : forcedRefineFallback ?? (firstUsable ? firstEnvelope : repairedEnvelope.reply.trim().length > 0 ? repairedEnvelope : firstEnvelope),
    repaired: true,
    initialReply: firstReply,
    provider: repairedAttempt.provider,
    finishReason: repairedAttempt.finishReason ?? null,
  };
}
