// tests/unit/buildCreateSuggestions.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapPatternsToSuggestions } from "../../lib/postcook/buildCreateSuggestions";
import type { LearnedPattern } from "../../lib/ai/learnedSignals";

function makePattern(key: string, direction: "positive" | "negative" = "positive"): LearnedPattern {
  return { key, label: key, confidence: "medium", direction };
}

describe("mapPatternsToSuggestions", () => {
  it("returns empty array for empty patterns", () => {
    assert.deepEqual(mapPatternsToSuggestions([]), []);
  });

  it("maps prefers_low_spice to mild suggestion", () => {
    const result = mapPatternsToSuggestions([makePattern("prefers_low_spice", "negative")]);
    assert.ok(result.some((s) => s.toLowerCase().includes("mild") || s.toLowerCase().includes("gentle")));
  });

  it("maps enjoys_spicy to bold suggestion", () => {
    const result = mapPatternsToSuggestions([makePattern("enjoys_spicy")]);
    assert.ok(result.some((s) => s.toLowerCase().includes("spicy") || s.toLowerCase().includes("bold")));
  });

  it("maps prefers_simpler_recipes to quick suggestion", () => {
    const result = mapPatternsToSuggestions([makePattern("prefers_simpler_recipes", "negative")]);
    assert.ok(result.some((s) => s.toLowerCase().includes("simple") || s.toLowerCase().includes("quick")));
  });

  it("maps cuisine pattern to cuisine suggestion", () => {
    const result = mapPatternsToSuggestions([makePattern("prefers_italian")]);
    assert.ok(result.some((s) => s.toLowerCase().includes("italian")));
  });

  it("caps output at 5 suggestions", () => {
    const many: LearnedPattern[] = [
      makePattern("prefers_low_spice", "negative"),
      makePattern("prefers_lighter_dishes", "negative"),
      makePattern("prefers_simpler_recipes", "negative"),
      makePattern("prefers_bold_flavors"),
      makePattern("prefers_italian"),
      makePattern("prefers_chicken"),
      makePattern("prefers_light_seasoning", "negative"),
    ];
    const result = mapPatternsToSuggestions(many);
    assert.ok(result.length <= 5);
  });

  it("ignores unknown pattern keys gracefully", () => {
    const result = mapPatternsToSuggestions([makePattern("unknown_future_key")]);
    assert.deepEqual(result, []);
  });
});
