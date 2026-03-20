"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.callAIWithMeta = callAIWithMeta;
exports.callAI = callAI;
const usageMetrics_1 = require("./usageMetrics");
class AIProviderError extends Error {
    provider;
    statusCode;
    retryable;
    constructor(provider, message, options) {
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
let openRouterClientPromise = null;
function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing ${name}`);
    }
    return value;
}
function getOpenRouterReferer() {
    return (process.env.OPENROUTER_HTTP_REFERER?.trim() ||
        process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
        "http://localhost:3000");
}
function getOpenRouterTitle() {
    return process.env.OPENROUTER_APP_TITLE?.trim() || "Recipe Evolution";
}
function shouldRetry(error) {
    if (error instanceof AIProviderError) {
        return error.retryable;
    }
    if (error instanceof Error && error.name === "AbortError") {
        return true;
    }
    return false;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function withRetry(task) {
    let attempt = 0;
    let lastError;
    while (attempt <= MAX_RETRIES) {
        try {
            return await task();
        }
        catch (error) {
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
async function getOpenRouterClient() {
    if (!openRouterClientPromise) {
        openRouterClientPromise = Promise.resolve().then(() => __importStar(require("openai"))).then(({ default: OpenAI }) => {
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
function uniqueModels(models) {
    return models.filter((value, index, list) => Boolean(value) && list.indexOf(value) === index);
}
function getModelOrder(options) {
    return uniqueModels([options.model, ...(options.fallback_models ?? []), DEFAULT_OPENROUTER_MODEL]);
}
async function callOpenRouter(messages, options, model) {
    try {
        const client = await getOpenRouterClient();
        const response = await client.chat.completions.create({
            model,
            messages,
            max_tokens: options.max_tokens || 400,
            temperature: options.temperature || 0.6,
        }, {
            timeout: DEFAULT_TIMEOUT_MS,
        });
        const promptTokens = typeof response.usage?.prompt_tokens === "number" ? response.usage.prompt_tokens : null;
        const completionTokens = typeof response.usage?.completion_tokens === "number" ? response.usage.completion_tokens : null;
        const totalTokens = typeof response.usage?.total_tokens === "number" ? response.usage.total_tokens : null;
        const costFromResponse = typeof response.usage?.cost === "number"
            ? response.usage?.cost ?? null
            : typeof response.usage?.cost === "string"
                ? Number(response.usage?.cost)
                : null;
        return {
            text: response.choices[0]?.message?.content ?? "",
            provider: "openrouter",
            model,
            finishReason: response.choices[0]?.finish_reason ?? null,
            usage: {
                input_tokens: promptTokens,
                output_tokens: completionTokens,
                total_tokens: totalTokens,
                estimated_cost_usd: typeof costFromResponse === "number" && Number.isFinite(costFromResponse)
                    ? costFromResponse
                    : (0, usageMetrics_1.estimateUsageCostUsd)(model, promptTokens, completionTokens),
            },
        };
    }
    catch (error) {
        const statusCode = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : undefined;
        const providerMessage = error instanceof Error && error.message.trim().length > 0
            ? error.message
            : `OpenRouter request failed for ${model}`;
        const message = statusCode === 402
            ? `OpenRouter account or API key has insufficient credits for ${model}. Add credits in OpenRouter billing and retry.`
            : providerMessage;
        throw new AIProviderError("openrouter", message, {
            cause: error,
            statusCode,
            retryable: typeof statusCode === "number" ? RETRYABLE_STATUS_CODES.has(statusCode) : true,
        });
    }
}
async function callAIWithMeta(messages, options = {}) {
    const modelOrder = getModelOrder(options);
    const errors = [];
    for (const model of modelOrder) {
        try {
            return await withRetry(() => callOpenRouter(messages, options, model));
        }
        catch (error) {
            const detail = error instanceof AIProviderError
                ? `${model}${error.statusCode ? ` (${error.statusCode})` : ""}: ${error.statusCode === 402
                    ? `OpenRouter account or API key has insufficient credits. Add credits and retry.`
                    : error.message}`
                : `${model}: ${error instanceof Error ? error.message : "Unknown error"}`;
            errors.push(detail);
            console.error("AI model attempt failed", { provider: "openrouter", model, detail });
        }
    }
    throw new Error(`All AI model attempts failed. ${errors.join(" | ")}`);
}
async function callAI(messages, options = {}) {
    const result = await callAIWithMeta(messages, options);
    return result.text;
}
