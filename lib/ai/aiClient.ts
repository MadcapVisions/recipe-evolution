import type { AIMessage } from "./chatPromptBuilder";
import { estimateUsageCostUsd, type AiUsageMetrics } from "./usageMetrics";
import { logCallUsage } from "./usageLogger";
import {
  getDowngradedResponseFormat,
  shouldDowngradeStructuredOutputError,
  type AIResponseFormat,
} from "./responseFormat";

export type AICallOptions = {
  max_tokens?: number;
  temperature?: number;
  model?: string;
  fallback_models?: string[];
  /** When true, skip appending DEFAULT_OPENROUTER_MODEL as a last-resort fallback. */
  strict_model?: boolean;
  /** Force JSON output mode. Only pass for calls that require JSON responses. */
  response_format?: AIResponseFormat;
  /** Downgrade unsupported json_schema requests to json_object and retry once on the same model. */
  allow_response_format_downgrade?: boolean;
};

type AIProvider = "openrouter";

export type AICallResult = {
  text: string;
  provider: AIProvider;
  model?: string;
  finishReason?: string | null;
  usage: AiUsageMetrics;
};

class AIProviderError extends Error {
  provider: AIProvider;
  statusCode?: number;
  retryable: boolean;
  cause?: unknown;

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
const DEFAULT_OPENROUTER_MODEL = process.env.OPENROUTER_DEFAULT_MODEL?.trim() || "openai/gpt-4o-mini";
const RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

let openRouterClientPromise: Promise<OpenRouterClient> | null = null;

type OpenRouterClient = InstanceType<typeof import("openai").default>;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function getOpenRouterReferer() {
  return (
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000"
  );
}

function getOpenRouterTitle() {
  return process.env.OPENROUTER_APP_TITLE?.trim() || "Recipe Evolution";
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

async function getOpenRouterClient(): Promise<OpenRouterClient> {
  if (!openRouterClientPromise) {
    openRouterClientPromise = import("openai").then(({ default: OpenAI }) => {
      return new OpenAI({
        apiKey: requireEnv("OPENROUTER_API_KEY"),
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": getOpenRouterReferer(),
          "X-Title": getOpenRouterTitle(),
        },
      });
    });
  }

  return openRouterClientPromise;
}

function uniqueModels(models: Array<string | null | undefined>) {
  return models.filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index);
}

function getModelOrder(options: AICallOptions) {
  const models = uniqueModels([options.model, ...(options.fallback_models ?? [])]);
  if (!options.strict_model && !models.includes(DEFAULT_OPENROUTER_MODEL)) {
    models.push(DEFAULT_OPENROUTER_MODEL);
  }
  return models;
}

async function callOpenRouter(messages: AIMessage[], options: AICallOptions, model: string): Promise<AICallResult> {
  const attemptRequest = async (responseFormat: AIResponseFormat | undefined) => {
    const client = await getOpenRouterClient();
    return client.chat.completions.create(
      {
        model,
        messages,
        max_tokens: options.max_tokens || 400,
        temperature: options.temperature || 0.6,
        ...(responseFormat ? { response_format: responseFormat } : {}),
      },
      {
        timeout: DEFAULT_TIMEOUT_MS,
      }
    );
  };

  try {
    let response;
    try {
      response = await attemptRequest(options.response_format);
    } catch (error) {
      if (options.allow_response_format_downgrade && shouldDowngradeStructuredOutputError(error, options.response_format)) {
        const downgraded = getDowngradedResponseFormat(options.response_format);
        response = await attemptRequest(downgraded);
      } else {
        throw error;
      }
    }

    const promptTokens = typeof response.usage?.prompt_tokens === "number" ? response.usage.prompt_tokens : null;
    const completionTokens = typeof response.usage?.completion_tokens === "number" ? response.usage.completion_tokens : null;
    const totalTokens = typeof response.usage?.total_tokens === "number" ? response.usage.total_tokens : null;
    const costFromResponse =
      typeof (response as { usage?: { cost?: number | string | null } }).usage?.cost === "number"
        ? (response as { usage?: { cost?: number } }).usage?.cost ?? null
        : typeof (response as { usage?: { cost?: number | string | null } }).usage?.cost === "string"
          ? Number((response as { usage?: { cost?: string } }).usage?.cost)
          : null;
    const callResult = {
      text: response.choices[0]?.message?.content ?? "",
      provider: "openrouter" as const,
      model,
      finishReason: response.choices[0]?.finish_reason ?? null,
      usage: {
        input_tokens: promptTokens,
        output_tokens: completionTokens,
        total_tokens: totalTokens,
        estimated_cost_usd:
          typeof costFromResponse === "number" && Number.isFinite(costFromResponse)
            ? costFromResponse
            : estimateUsageCostUsd(model, promptTokens, completionTokens),
      },
    };
    await logCallUsage(model, callResult.usage);
    return callResult;
  } catch (error) {
    const statusCode = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : undefined;
    const providerMessage =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : `OpenRouter request failed for ${model}`;
    const message =
      statusCode === 402
        ? `OpenRouter account or API key has insufficient credits for ${model}. Add credits in OpenRouter billing and retry.`
        : providerMessage;
    throw new AIProviderError("openrouter", message, {
      cause: error,
      statusCode,
      retryable: typeof statusCode === "number" ? RETRYABLE_STATUS_CODES.has(statusCode) : true,
    });
  }
}

export async function callAIWithMeta(messages: AIMessage[], options: AICallOptions = {}): Promise<AICallResult> {
  const modelOrder = getModelOrder(options);
  const errors: string[] = [];

  for (const model of modelOrder) {
    try {
      return await withRetry(() => callOpenRouter(messages, options, model));
    } catch (error) {
      const detail =
        error instanceof AIProviderError
          ? `${model}${error.statusCode ? ` (${error.statusCode})` : ""}: ${
              error.statusCode === 402
                ? `OpenRouter account or API key has insufficient credits. Add credits and retry.`
                : error.message
            }`
          : `${model}: ${error instanceof Error ? error.message : "Unknown error"}`;
      errors.push(detail);
      console.error("AI model attempt failed", { provider: "openrouter", model, detail });
    }
  }

  throw new Error(`All AI model attempts failed. ${errors.join(" | ")}`);
}

export async function callAI(messages: AIMessage[], options: AICallOptions = {}): Promise<string> {
  const result = await callAIWithMeta(messages, options);
  return result.text;
}
