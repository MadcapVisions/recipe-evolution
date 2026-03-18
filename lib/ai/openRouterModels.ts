import "server-only";

export type OpenRouterModelOption = {
  id: string;
  label: string;
  provider: string;
  promptPricePerMillion: number | null;
  completionPricePerMillion: number | null;
  contextLength: number | null;
  isRecommended: boolean;
  recommendationRank: number | null;
};

type OpenRouterModelsResponse = {
  data?: Array<{
    id?: string;
    name?: string;
    context_length?: number;
    pricing?: {
      prompt?: string;
      completion?: string;
    };
  }>;
};

function toPerMillion(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed * 1_000_000;
}

function formatPrice(value: number | null) {
  if (value == null) {
    return "n/a";
  }
  if (value < 0.01) {
    return `<$0.01`;
  }
  return `$${value.toFixed(2)}`;
}

function buildLabel(option: {
  id: string;
  name: string;
  promptPricePerMillion: number | null;
  completionPricePerMillion: number | null;
  contextLength: number | null;
}) {
  const contextLabel = option.contextLength ? `${Math.round(option.contextLength / 1000)}k ctx` : "ctx n/a";
  return `${option.name} (${option.id}) · in ${formatPrice(option.promptPricePerMillion)}/M · out ${formatPrice(option.completionPricePerMillion)}/M · ${contextLabel}`;
}

function getRecommendationRank(id: string): number | null {
  const normalized = id.toLowerCase();
  const rankedPrefixes = [
    // Top 3 — benchmarked and recommended
    "openai/gpt-4o-mini",
    "google/gemini-2.5-flash",
    "deepseek/deepseek-chat",
    // Strong secondaries
    "deepseek/deepseek-chat-v3",
    "deepseek/deepseek-r1",
    "google/gemini-2.0-flash",
    "anthropic/claude-3.5-haiku",
    "meta-llama/llama-3.3-70b-instruct",
    "qwen/qwen-2.5-72b-instruct",
    "mistralai/mistral-small",
  ];

  const exactIndex = rankedPrefixes.findIndex((prefix) => normalized === prefix);
  if (exactIndex >= 0) {
    return exactIndex + 1;
  }

  const prefixIndex = rankedPrefixes.findIndex((prefix) => normalized.startsWith(prefix));
  if (prefixIndex >= 0) {
    return prefixIndex + 1;
  }

  return null;
}

export async function listOpenRouterModels(): Promise<OpenRouterModelOption[]> {
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Failed to load OpenRouter models (${response.status}).`);
  }

  const payload = (await response.json()) as OpenRouterModelsResponse;
  const options = (payload.data ?? [])
    .map((item) => {
      const id = item.id?.trim();
      if (!id) {
        return null;
      }

      const provider = id.split("/")[0] ?? "other";
      const name = item.name?.trim() || id;
      const promptPricePerMillion = toPerMillion(item.pricing?.prompt);
      const completionPricePerMillion = toPerMillion(item.pricing?.completion);

      return {
        id,
        label: buildLabel({
          id,
          name,
          promptPricePerMillion,
          completionPricePerMillion,
          contextLength: typeof item.context_length === "number" ? item.context_length : null,
        }),
        provider,
        promptPricePerMillion,
        completionPricePerMillion,
        contextLength: typeof item.context_length === "number" ? item.context_length : null,
        isRecommended: getRecommendationRank(id) !== null,
        recommendationRank: getRecommendationRank(id),
      } satisfies OpenRouterModelOption;
    })
    .filter((item): item is OpenRouterModelOption => item !== null)
    .sort((a, b) => a.id.localeCompare(b.id));

  return options;
}
