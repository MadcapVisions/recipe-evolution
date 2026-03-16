import { callAIWithMeta, type AICallOptions } from "./aiClient";
import type { AIMessage } from "./chatPromptBuilder";

export function parseJsonResponse(text: string): unknown {
  if (typeof text !== "string" || text.trim().length === 0) {
    return null;
  }

  const direct = text.trim();

  try {
    return JSON.parse(direct);
  } catch {
    // Fall through to fence/substring extraction.
  }

  const withoutFences = direct.replace(/```json/gi, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(withoutFences);
  } catch {
    // Fall through to brace slice extraction.
  }

  const firstBrace = withoutFences.indexOf("{");
  const lastBrace = withoutFences.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const sliced = withoutFences.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(sliced);
    } catch {
      return null;
    }
  }

  return null;
}

export async function callAIForJson(messages: AIMessage[], options: AICallOptions = {}) {
  const result = await callAIWithMeta(messages, options);
  const parsed = parseJsonResponse(result.text);

  if (parsed == null) {
    throw new Error(`AI returned invalid JSON (${result.provider}${result.model ? `:${result.model}` : ""}).`);
  }

  return {
    ...result,
    parsed,
  };
}
