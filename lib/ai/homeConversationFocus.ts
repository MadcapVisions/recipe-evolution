import type { AIMessage } from "./chatPromptBuilder";

type HomeChatMessage = {
  role: "user" | "ai";
  text: string;
  kind?: "message" | "direction_selected";
};

const OPTION_FOLLOW_UP_PATTERNS = [
  /\bother options?\b/i,
  /\bdifferent options?\b/i,
  /\bnew options?\b/i,
  /\bmore options?\b/i,
  /\banother option\b/i,
  /\bnone of (?:these|those)\b/i,
  /\bnot (?:these|those)\b/i,
  /\bthe same options?\b/i,
  /\bother directions?\b/i,
  /\bdifferent directions?\b/i,
];

function toAiMessages(messages: HomeChatMessage[]): AIMessage[] {
  return messages
    .filter((message) => message.kind !== "direction_selected")
    .map((message) => ({
      role: message.role === "user" ? "user" : "assistant",
      content: message.text,
    }));
}

function isOptionFollowUpMessage(message: HomeChatMessage | undefined) {
  if (!message || message.role !== "user") {
    return false;
  }

  return OPTION_FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(message.text));
}

function buildAnchoredTail(messages: HomeChatMessage[], tailStart: number) {
  const tail = messages.slice(tailStart);
  if (tail.length <= 6) {
    const firstUserIndex = messages.findIndex((message) => message.role === "user");
    if (firstUserIndex <= -1 || firstUserIndex >= tailStart) {
      return tail;
    }
    const anchorEnd = Math.min(firstUserIndex + 2, messages.length);
    return [...messages.slice(firstUserIndex, anchorEnd), ...tail];
  }

  const firstUserIndex = messages.findIndex((message) => message.role === "user");
  if (firstUserIndex === -1) {
    return tail.slice(-6);
  }

  const anchorEnd = Math.min(firstUserIndex + 2, messages.length);
  const anchor = messages.slice(firstUserIndex, anchorEnd);
  const tailBudget = Math.max(0, 6 - anchor.length);
  const tailSlice = messages.slice(-tailBudget);
  const dedupedTail = tailSlice.filter((message, index) => {
    const tailIndex = messages.length - tailSlice.length + index;
    return tailIndex >= anchorEnd;
  });

  return [...anchor, ...dedupedTail];
}

export function buildFocusedChatHistory(messages: HomeChatMessage[]): AIMessage[] {
  if (messages.length === 0) {
    return [];
  }

  const lastAiIndex = [...messages].reverse().findIndex((message) => message.role === "ai");
  const resolvedLastAiIndex = lastAiIndex === -1 ? -1 : messages.length - 1 - lastAiIndex;

  if (resolvedLastAiIndex === -1) {
    return toAiMessages(messages.slice(-3));
  }

  const start = Math.max(0, resolvedLastAiIndex - 1);
  const focusedTail = messages.slice(start);
  if (isOptionFollowUpMessage(messages[resolvedLastAiIndex - 1])) {
    return toAiMessages(buildAnchoredTail(messages, start));
  }

  return toAiMessages(focusedTail.slice(-6));
}

export function buildFocusedRecipeConversation(messages: HomeChatMessage[]): HomeChatMessage[] {
  const relevantMessages = messages.filter((message) => message.kind !== "direction_selected");
  if (relevantMessages.length === 0) {
    return [];
  }

  const lastAiIndex = [...relevantMessages].reverse().findIndex((message) => message.role === "ai");
  const resolvedLastAiIndex = lastAiIndex === -1 ? -1 : relevantMessages.length - 1 - lastAiIndex;

  if (resolvedLastAiIndex === -1) {
    return relevantMessages.slice(-2);
  }

  const start = Math.max(0, resolvedLastAiIndex - 1);
  const focusedTail = relevantMessages.slice(start);
  if (isOptionFollowUpMessage(relevantMessages[resolvedLastAiIndex - 1])) {
    return buildAnchoredTail(relevantMessages, start);
  }

  return focusedTail;
}

export function buildReplyBranch(messages: HomeChatMessage[], replyIndex: number): HomeChatMessage[] {
  if (replyIndex < 0 || replyIndex >= messages.length || messages[replyIndex]?.role !== "ai") {
    return [];
  }

  let start = replyIndex;
  for (let index = replyIndex - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      start = index;
      break;
    }
  }

  return messages.slice(start, replyIndex + 1);
}

export function buildReplyThread(messages: HomeChatMessage[], replyIndex: number): HomeChatMessage[] {
  if (replyIndex < 0 || replyIndex >= messages.length || messages[replyIndex]?.role !== "ai") {
    return [];
  }

  return messages
    .slice(0, replyIndex + 1)
    .filter((message) => message.kind !== "direction_selected");
}

export function buildSelectedDirectionConversation(messages: HomeChatMessage[], replyIndex: number) {
  if (replyIndex < 0 || replyIndex >= messages.length) {
    return buildFocusedRecipeConversation(messages);
  }

  let start = replyIndex;
  for (let index = replyIndex - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      start = index;
      break;
    }
  }

  return messages.slice(start).filter((message) => message.kind !== "direction_selected");
}

export function buildDirectionSummary(messages: HomeChatMessage[]) {
  const focused = buildFocusedRecipeConversation(messages);
  const latestAi =
    [...focused]
      .reverse()
      .find((message) => message.role === "ai")
      ?.text.trim() ?? "";
  return latestAi;
}
