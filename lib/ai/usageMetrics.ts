export type AiUsageMetrics = {
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  estimated_cost_usd: number | null;
};

const MODEL_PRICING_USD_PER_M_TOKEN: Array<{
  match: RegExp;
  input: number;
  output: number;
}> = [
  { match: /gpt-4o-mini/i, input: 0.15, output: 0.6 },
  { match: /gpt-4o(?!-mini)/i, input: 2.5, output: 10 },
  { match: /gpt-4\.1-mini/i, input: 0.4, output: 1.6 },
  { match: /gpt-4\.1(?!-mini)/i, input: 2, output: 8 },
  { match: /gemini-2\.5-flash/i, input: 0.15, output: 0.6 },
  { match: /gemini-2\.0-flash/i, input: 0.1, output: 0.4 },
  { match: /deepseek-chat(?:-v3)?/i, input: 0.27, output: 1.1 },
  { match: /deepseek-r1-distill-qwen-32b/i, input: 0.15, output: 0.6 },
  { match: /deepseek-r1-0528/i, input: 0.55, output: 2.19 },
  { match: /deepseek-r1(?!-distill|-0528)/i, input: 0.55, output: 2.19 },
  { match: /claude-3\.5-haiku/i, input: 0.8, output: 4 },
  { match: /claude-3\.5-sonnet/i, input: 3, output: 15 },
];

export function estimateUsageCostUsd(model: string | null | undefined, inputTokens: number | null, outputTokens: number | null) {
  if (!model || inputTokens == null || outputTokens == null) {
    return null;
  }

  const pricing = MODEL_PRICING_USD_PER_M_TOKEN.find((entry) => entry.match.test(model));
  if (!pricing) {
    return null;
  }

  const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
  return Number(cost.toFixed(6));
}

export function resolveUsageCostUsd(entry: {
  model: string | null | undefined;
  input_tokens: number | null | undefined;
  output_tokens: number | null | undefined;
  cost_usd: number | null | undefined;
}) {
  if (typeof entry.cost_usd === "number" && Number.isFinite(entry.cost_usd)) {
    return entry.cost_usd;
  }

  return estimateUsageCostUsd(entry.model, entry.input_tokens ?? null, entry.output_tokens ?? null);
}
