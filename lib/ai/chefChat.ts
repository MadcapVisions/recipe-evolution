import { callAIForJson } from "./jsonResponse";
import { buildChefChatPrompt, type AIMessage, type RecipeContext } from "./chatPromptBuilder";
import { buildChefChatEnvelope, normalizeChefChatEnvelope, optionsTooSimilar, type ChefChatEnvelope } from "./chefOptions";
import { TOKEN_LIMITS } from "./config/tokenLimits";
import type { AiTaskSettingRecord } from "./taskSettings";

export type ChefChatResult = {
  envelope: ChefChatEnvelope;
  repaired: boolean;
  initialReply: string;
  provider: string;
  finishReason?: string | null;
};

function buildFallbackRefineReply(userMessage: string) {
  const normalized = userMessage.toLowerCase();
  const dislikeMatch = normalized.match(/i (?:don't|do not) like ([a-z][a-z -]+)/i);

  if (dislikeMatch?.[1]) {
    const ingredient = dislikeMatch[1].trim();
    return `Leave out ${ingredient} and rebalance with another ingredient that fills the same role. If you want, I can suggest the best swap while keeping the same flavor direction.`;
  }

  return `Keep refining this same dish and adjust the flavor, heat, texture, or ingredients from here.`;
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
  sessionMemory?: string | null
): AIMessage[] {
  return [
    ...buildChefChatPrompt(userMessage, recipeContext, conversationHistory, userTasteSummary, sessionMemory),
    {
      role: "system",
      content: `Return ONLY valid JSON with this shape:
{
  "mode": "options" | "refine",
  "reply": string,
  "options": [{
    "id": string,
    "title": string,
    "summary": string,
    "tags": string[],
    "dish_family": string | null,
    "primary_anchor": string | null,
    "primary_anchor_type": "dish" | "protein" | "ingredient" | "format" | null
  }],
  "recommended_option_id": string | null
}

Rules:
- Use mode "options" only when the user explicitly asked for multiple ideas, options, directions, or variations.
- If the conversation already has a locked or chosen direction, stay in refine mode unless the user explicitly asks for new options again.
- If the user rejects the presented options (for example "none of these" or "not quite right"), stay in options mode and offer a revised set of distinct options instead of treating it as a refinement.
- In options mode, return exactly 2 or 3 options. Each option must have a distinct flavor angle — do not return minor variations of the same idea.
- In refine mode, return no options and recommended_option_id must be null.
- The "reply" field MUST always be a complete, non-empty chef response — it is the main text the user reads. NEVER leave it empty or null.
- In refine mode, "reply" is the full chef response.
- In options mode, "reply" is a 1-2 sentence intro that frames the options (e.g. "Three strong directions for a bright chicken dinner:").
- Keep reply concise and cooking-specific.
- For each option: set dish_family to the recipe category (e.g. "pasta", "soup", "pizza", "tacos", "salad", "braised", "stir_fry"), primary_anchor to the main ingredient or protein (e.g. "chicken", "mushrooms", "salmon"), and primary_anchor_type to one of: "protein" (for meat/fish/eggs), "ingredient" (for produce/legumes), "dish" (when the format is the anchor, e.g. risotto), "format" (when the cooking method is the anchor, e.g. sheet-pan). Set to null when not applicable.
- Do not include markdown fences or any text outside the JSON object.`,
    },
  ];
}

function normalizeOrBuildEnvelope(parsed: unknown, rawText: string) {
  const normalized = normalizeChefChatEnvelope(parsed);
  if (normalized) {
    return normalized;
  }

  if (parsed && typeof parsed === "object") {
    // The AI returned a valid JSON object but with an empty/missing reply field.
    // Try rescuing a reply from common alternative field names before giving up.
    const raw = parsed as Record<string, unknown>;
    const rescuedReply =
      (typeof raw.response === "string" && raw.response.trim()) ||
      (typeof raw.content === "string" && raw.content.trim()) ||
      (typeof raw.message === "string" && raw.message.trim()) ||
      "";
    return {
      mode: "refine" as const,
      reply: rescuedReply,
      options: [],
      recommended_option_id: null,
    };
  }

  return buildChefChatEnvelope(rawText);
}

export async function chefChat(
  userMessage: string,
  recipeContext: RecipeContext,
  conversationHistory: AIMessage[] = [],
  userTasteSummary?: string,
  taskSetting?: AiTaskSettingRecord,
  sessionMemory?: string | null
): Promise<ChefChatResult> {
  const messages = buildStructuredMessages(
    userMessage,
    recipeContext,
    conversationHistory,
    userTasteSummary,
    sessionMemory
  );
  const aiOptions = {
    max_tokens: taskSetting?.maxTokens ?? TOKEN_LIMITS.chefChat.max_tokens,
    temperature: taskSetting?.temperature ?? TOKEN_LIMITS.chefChat.temperature,
    model: taskSetting?.primaryModel,
    fallback_models: taskSetting?.fallbackModel ? [taskSetting.fallbackModel] : [],
  };

  const firstAttempt = await callAIForJson(messages, aiOptions);
  const firstEnvelope = normalizeOrBuildEnvelope(firstAttempt.parsed, firstAttempt.text);
  const firstReply = firstEnvelope.reply;

  const hasWeakOptions =
    firstEnvelope.mode === "options" &&
    firstEnvelope.options.length >= 2 &&
    optionsTooSimilar(firstEnvelope.options);

  if (!looksIncompleteEnvelope(firstEnvelope) && !hasWeakOptions) {
    return {
      envelope: firstEnvelope,
      repaired: false,
      initialReply: firstReply,
      provider: firstAttempt.provider,
      finishReason: firstAttempt.finishReason ?? null,
    };
  }

  const repairReason = hasWeakOptions && !looksIncompleteEnvelope(firstEnvelope)
    ? "Two or more of your option titles share too many words — they read as the same direction with minor wording variation. Return new options where each has a clearly different flavor angle, technique, or key ingredient. Keep the reply and recommended_option_id."
    : "Your previous JSON reply was incomplete or weak. Return a complete JSON response now. If mode is options, include exactly 2 or 3 concrete options with distinct flavor angles and a recommended_option_id. If mode is refine, return no options.";

  const repairMessages: AIMessage[] = [
    ...messages,
    {
      role: "assistant",
      content: JSON.stringify(firstEnvelope),
    },
    {
      role: "user",
      content: repairReason,
    },
  ];

  const repairedAttempt = await callAIForJson(repairMessages, aiOptions);
  const repairedEnvelope = normalizeOrBuildEnvelope(repairedAttempt.parsed, repairedAttempt.text);
  const repairedUsable = !looksIncompleteEnvelope(repairedEnvelope);
  const firstUsable = !looksIncompleteEnvelope(firstEnvelope);

  const emptyReplyFallback =
    repairedEnvelope.reply.trim().length === 0
      ? {
          mode: "refine" as const,
          reply: buildFallbackRefineReply(userMessage),
          options: [],
          recommended_option_id: null,
        }
      : null;

  return {
    envelope: repairedUsable
      ? repairedEnvelope
      : emptyReplyFallback ?? (firstUsable ? firstEnvelope : repairedEnvelope.reply.trim().length > 0 ? repairedEnvelope : firstEnvelope),
    repaired: true,
    initialReply: firstReply,
    provider: repairedAttempt.provider,
    finishReason: repairedAttempt.finishReason ?? null,
  };
}
