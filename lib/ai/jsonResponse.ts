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

  // Try every { position (left to right) against the last }.
  // Handles models that prepend reasoning text containing {placeholder} before the real JSON object.
  const lastBrace = withoutFences.lastIndexOf("}");
  if (lastBrace >= 0) {
    let searchPos = 0;
    while (true) {
      const bracePos = withoutFences.indexOf("{", searchPos);
      if (bracePos < 0 || bracePos >= lastBrace) break;
      try {
        return JSON.parse(withoutFences.slice(bracePos, lastBrace + 1));
      } catch {
        searchPos = bracePos + 1;
      }
    }
  }

  return null;
}

export async function callAIForJson(messages: AIMessage[], options: AICallOptions = {}) {
  const result = await callAIWithMeta(messages, options);
  const parsed = parseJsonResponse(result.text);

  if (parsed == null) {
    const preview = result.text.trim().slice(0, 200).replace(/\n/g, " ");
    throw new Error(`AI returned invalid JSON (${result.provider}${result.model ? `:${result.model}` : ""}). Response preview: ${preview}`);
  }

  return {
    ...result,
    parsed,
  };
}
