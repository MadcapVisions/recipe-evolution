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
