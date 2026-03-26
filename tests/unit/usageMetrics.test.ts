import test from "node:test";
import assert from "node:assert/strict";
import { estimateUsageCostUsd, resolveUsageCostUsd } from "../../lib/ai/usageMetrics";

test("estimateUsageCostUsd recognizes recommended OpenRouter models", () => {
  assert.equal(estimateUsageCostUsd("openai/gpt-4o-mini", 100_000, 50_000), 0.045);
  assert.equal(estimateUsageCostUsd("google/gemini-2.5-flash", 100_000, 50_000), 0.045);
  assert.equal(estimateUsageCostUsd("deepseek/deepseek-chat", 100_000, 50_000), 0.082);
});

test("estimateUsageCostUsd recognizes legacy anthropic task defaults", () => {
  assert.equal(estimateUsageCostUsd("anthropic/claude-3.5-sonnet", 100_000, 50_000), 1.05);
  assert.equal(estimateUsageCostUsd("anthropic/claude-3.5-haiku", 100_000, 50_000), 0.28);
});

test("resolveUsageCostUsd falls back to token-based estimation when stored cost is null", () => {
  assert.equal(
    resolveUsageCostUsd({
      model: "anthropic/claude-3.5-sonnet",
      input_tokens: 100_000,
      output_tokens: 50_000,
      cost_usd: null,
    }),
    1.05
  );
});

test("resolveUsageCostUsd preserves explicit stored cost", () => {
  assert.equal(
    resolveUsageCostUsd({
      model: "anthropic/claude-3.5-sonnet",
      input_tokens: 100_000,
      output_tokens: 50_000,
      cost_usd: 0.123456,
    }),
    0.123456
  );
});
