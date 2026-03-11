import type { AIMessage } from "./chatPromptBuilder";

type AICallOptions = {
  max_tokens?: number;
  temperature?: number;
};

type AIProvider = "openai" | "gemini" | "claude";

type ProviderCallContext = {
  timeoutMs: number;
};

export type AICallResult = {
  text: string;
  provider: AIProvider;
  finishReason?: string | null;
};

class AIProviderError extends Error {
  provider: AIProvider;
  statusCode?: number;
  retryable: boolean;

  constructor(provider: AIProvider, message: string, options?: { statusCode?: number; retryable?: boolean; cause?: unknown }) {
    super(message);
    this.name = "AIProviderError";
    this.provider = provider;
    this.statusCode = options?.statusCode;
    this.retryable = options?.retryable ?? false;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

const DEFAULT_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 20_000);
const MAX_RETRIES = Number(process.env.AI_MAX_RETRIES ?? 2);
const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-3-5-sonnet-latest";
const RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

let openAIClientPromise: Promise<OpenAIClient> | null = null;

type OpenAIClient = InstanceType<typeof import("openai").default>;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function parseProvider(value: string | undefined): AIProvider | null {
  if (!value) {
    return null;
  }
  if (value === "openai" || value === "gemini" || value === "claude") {
    return value;
  }
  return null;
}

function getProviderOrder(): AIProvider[] {
  const primary = parseProvider(process.env.AI_PROVIDER) ?? "openai";
  const configuredFallbacks =
    process.env.AI_FALLBACK_PROVIDERS?.split(",")
      .map((item) => parseProvider(item.trim()))
      .filter((item): item is AIProvider => item !== null) ?? [];

  const defaults: AIProvider[] = ["openai", "gemini", "claude"];
  return [primary, ...configuredFallbacks, ...defaults].filter(
    (provider, index, list) => list.indexOf(provider) === index
  );
}

function shouldRetry(error: unknown): boolean {
  if (error instanceof AIProviderError) {
    return error.retryable;
  }
  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }
  return false;
}

function isAbortLikeError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(task: () => Promise<T>) {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= MAX_RETRIES) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt >= MAX_RETRIES || !shouldRetry(error)) {
        throw error;
      }
      await sleep(250 * 2 ** attempt);
      attempt += 1;
    }
  }

  throw lastError;
}

async function getOpenAIClient(): Promise<OpenAIClient> {
  if (!openAIClientPromise) {
    openAIClientPromise = import("openai").then(({ default: OpenAI }) => {
      return new OpenAI({
        apiKey: requireEnv("OPENAI_API_KEY"),
      });
    });
  }

  return openAIClientPromise;
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortLikeError(error)) {
      throw new AIProviderError("gemini", `Request timed out after ${timeoutMs}ms`, { retryable: true, cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithTimeoutForProvider(provider: AIProvider, input: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortLikeError(error)) {
      throw new AIProviderError(provider, `Request timed out after ${timeoutMs}ms`, { retryable: true, cause: error });
    }
    throw new AIProviderError(provider, `${provider} request failed`, { retryable: true, cause: error });
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAI(messages: AIMessage[], options: AICallOptions, context: ProviderCallContext): Promise<AICallResult> {
  try {
    const client = await getOpenAIClient();
    const response = await client.chat.completions.create(
      {
        model: OPENAI_MODEL,
        messages,
        max_tokens: options.max_tokens || 400,
        temperature: options.temperature || 0.6,
      },
      {
        timeout: context.timeoutMs,
      }
    );

    return {
      text: response.choices[0]?.message?.content ?? "",
      provider: "openai",
      finishReason: response.choices[0]?.finish_reason ?? null,
    };
  } catch (error) {
    const statusCode = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : undefined;
    throw new AIProviderError("openai", "OpenAI request failed", {
      statusCode,
      retryable: typeof statusCode === "number" ? RETRYABLE_STATUS_CODES.has(statusCode) : true,
      cause: error,
    });
  }
}

async function callGemini(messages: AIMessage[], options: AICallOptions, context: ProviderCallContext): Promise<AICallResult> {
  const prompt = messages.map((message) => message.content).join("\n");
  const apiKey = requireEnv("GEMINI_API_KEY");

  const response = await fetchWithTimeoutForProvider(
    "gemini",
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: options.max_tokens || 400,
          temperature: options.temperature || 0.6,
        },
      }),
    },
    context.timeoutMs
  );

  if (!response.ok) {
    const text = await response.text();
    throw new AIProviderError("gemini", `Gemini (${GEMINI_MODEL}) error (${response.status})`, {
      statusCode: response.status,
      retryable: RETRYABLE_STATUS_CODES.has(response.status),
      cause: text,
    });
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const candidate = data.candidates?.[0];
  const finishReason = candidate?.finishReason ?? null;
  const text = candidate?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";

  const suspiciousFinishReason =
    finishReason &&
    finishReason !== "STOP" &&
    finishReason !== "MAX_TOKENS";

  const suspiciousText =
    !text ||
    /:\s*$/.test(text) ||
    /:\s*\d+[\.\)]?\s*$/.test(text) ||
    /\b\d+\.\s*$/.test(text);

  if (suspiciousFinishReason || suspiciousText) {
    throw new AIProviderError("gemini", `Gemini returned incomplete content${finishReason ? ` (${finishReason})` : ""}`, {
      retryable: true,
      cause: data,
    });
  }

  return {
    text,
    provider: "gemini",
    finishReason,
  };
}

async function callClaude(messages: AIMessage[], options: AICallOptions, context: ProviderCallContext): Promise<AICallResult> {
  const prompt = messages.map((message) => message.content).join("\n");

  const response = await fetchWithTimeoutForProvider(
    "claude",
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "x-api-key": requireEnv("ANTHROPIC_API_KEY"),
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: options.max_tokens || 400,
        temperature: options.temperature || 0.6,
        messages: [{ role: "user", content: prompt }],
      }),
    },
    context.timeoutMs
  );

  if (!response.ok) {
    const text = await response.text();
    throw new AIProviderError("claude", `Claude error (${response.status})`, {
      statusCode: response.status,
      retryable: RETRYABLE_STATUS_CODES.has(response.status),
      cause: text,
    });
  }

  const data = (await response.json()) as {
    content?: Array<{ text?: string }>;
    stop_reason?: string;
  };

  return {
    text: data.content?.[0]?.text ?? "",
    provider: "claude",
    finishReason: data.stop_reason ?? null,
  };
}

const providerCallers: Record<AIProvider, (messages: AIMessage[], options: AICallOptions, context: ProviderCallContext) => Promise<AICallResult>> = {
  openai: callOpenAI,
  gemini: callGemini,
  claude: callClaude,
};

export async function callAIWithMeta(messages: AIMessage[], options: AICallOptions = {}): Promise<AICallResult> {
  const providerOrder = getProviderOrder();
  const timeoutMs = DEFAULT_TIMEOUT_MS;
  const errors: string[] = [];

  for (const provider of providerOrder) {
    try {
      return await withRetry(() => providerCallers[provider](messages, options, { timeoutMs }));
    } catch (error) {
      const detail =
        error instanceof AIProviderError
          ? `${provider}${error.statusCode ? ` (${error.statusCode})` : ""}: ${error.message}`
          : `${provider}: ${error instanceof Error ? error.message : "Unknown error"}`;
      errors.push(detail);
      console.error("AI provider attempt failed", { provider, detail });
    }
  }

  throw new Error(`All AI providers failed. ${errors.join(" | ")}`);
}

export async function callAI(messages: AIMessage[], options: AICallOptions = {}): Promise<string> {
  const result = await callAIWithMeta(messages, options);
  return result.text;
}
