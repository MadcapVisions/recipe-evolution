import type { AIMessage } from "./chatPromptBuilder";

type HomeChatMessage = {
  role: "user" | "ai";
  text: string;
  kind?: "message" | "direction_selected";
};

function toAiMessages(messages: HomeChatMessage[]): AIMessage[] {
  return messages
    .filter((message) => message.kind !== "direction_selected")
    .map((message) => ({
      role: message.role === "user" ? "user" : "assistant",
      content: message.text,
    }));
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
  return toAiMessages(messages.slice(start).slice(-6));
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
  return relevantMessages.slice(start);
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
