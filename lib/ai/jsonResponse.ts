import { callAIWithMeta, type AICallOptions } from "./aiClient";
import type { AIMessage } from "./chatPromptBuilder";
import { parseJsonResponse, validateJsonContract } from "./jsonContract";

export class AIJsonParseError extends Error {
  readonly response: ReturnType<typeof buildJsonResponseEnvelope>;

  constructor(message: string, response: ReturnType<typeof buildJsonResponseEnvelope>) {
    super(message);
    this.name = "AIJsonParseError";
    this.response = response;
  }
}

function buildJsonResponseEnvelope(result: Awaited<ReturnType<typeof callAIWithMeta>>) {
  return {
    text: result.text,
    provider: result.provider,
    model: result.model ?? null,
    finishReason: result.finishReason ?? null,
    usage: result.usage,
  };
}

export async function callAIForJson(messages: AIMessage[], options: AICallOptions = {}) {
  const result = await callAIWithMeta(messages, options);
  const parsed = parseJsonResponse(result.text);

  if (parsed == null) {
    const preview = result.text.trim().slice(0, 200).replace(/\n/g, " ");
    throw new AIJsonParseError(
      `AI returned invalid JSON (${result.provider}${result.model ? `:${result.model}` : ""}). Response preview: ${preview}`,
      buildJsonResponseEnvelope(result)
    );
  }

  return {
    ...result,
    parsed,
  };
}

export { parseJsonResponse, validateJsonContract } from "./jsonContract";

export async function callAIForJsonWithContract<T>(
  messages: AIMessage[],
  validator: (parsed: unknown) => { value: T | null; error: string | null },
  options: AICallOptions = {}
) {
  const result = await callAIForJson(messages, options);
  const contract = validateJsonContract(result.parsed, validator);

  return {
    ...result,
    contract,
  };
}
