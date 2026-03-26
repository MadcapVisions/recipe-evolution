import test from "node:test";
import assert from "node:assert/strict";
import { classifyImproveRecipeError } from "../../lib/ai/improveRecipeError";

test("classifyImproveRecipeError marks provider outages as transient", () => {
  const result = classifyImproveRecipeError(
    new Error("All AI model attempts failed. openai/gpt-4o-mini (503): OpenRouter request failed")
  );

  assert.equal(result.status, 503);
  assert.equal(result.message, "Recipe update AI was temporarily unavailable. Please try again.");
});

test("classifyImproveRecipeError marks task settings load failures as transient", () => {
  const result = classifyImproveRecipeError(new Error("Failed to load AI task settings: relation does not exist"));

  assert.equal(result.status, 503);
  assert.equal(result.message, "Recipe update settings could not be loaded. Please try again.");
});

test("classifyImproveRecipeError marks disabled tasks as unavailable", () => {
  const result = classifyImproveRecipeError(new Error("Recipe improvement AI task is disabled."));

  assert.equal(result.status, 503);
  assert.equal(result.message, "Recipe updates are temporarily unavailable.");
});

test("classifyImproveRecipeError leaves unknown failures as generic server errors", () => {
  const result = classifyImproveRecipeError(new Error("Unexpected normalization failure"));

  assert.equal(result.status, 500);
  assert.equal(result.message, "AI improvement failed. Please try again.");
});
