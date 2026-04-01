import test from "node:test";
import assert from "node:assert/strict";
import { deriveLearnedPatterns } from "../../lib/ai/learnedSignals";
import type { TasteModel, TasteScore } from "../../lib/ai/tasteModel";

function score(val: number, conf = 0.5): TasteScore {
  return { score: val, confidence: conf, evidenceCount: 3, lastUpdatedAt: new Date().toISOString() };
}

const emptyModel: TasteModel = {
  cuisines: {},
  proteins: {},
  flavors: {},
  dishFamilies: {},
  dislikedIngredients: {},
  spiceTolerance: null,
  richnessPreference: null,
};

test("deriveLearnedPatterns returns empty patterns for null model", () => {
  const result = deriveLearnedPatterns(null);
  assert.equal(result.patterns.length, 0);
  assert.equal(result.overallConfidence, "low");
});

test("deriveLearnedPatterns returns empty patterns for empty model", () => {
  const result = deriveLearnedPatterns(emptyModel);
  assert.equal(result.patterns.length, 0);
});

test("deriveLearnedPatterns detects low-spice preference", () => {
  const model: TasteModel = { ...emptyModel, spiceTolerance: score(-0.6) };
  const result = deriveLearnedPatterns(model);
  const pattern = result.patterns.find((p) => p.key === "prefers_low_spice");
  assert.ok(pattern, "should emit prefers_low_spice pattern");
  assert.equal(pattern!.direction, "negative");
});

test("deriveLearnedPatterns detects richness aversion", () => {
  const model: TasteModel = { ...emptyModel, richnessPreference: score(-0.5) };
  const result = deriveLearnedPatterns(model);
  const pattern = result.patterns.find((p) => p.key === "prefers_lighter_dishes");
  assert.ok(pattern, "should emit prefers_lighter_dishes pattern");
});

test("deriveLearnedPatterns detects complexity aversion", () => {
  const model: TasteModel = { ...emptyModel, complexityTolerance: score(-0.55) };
  const result = deriveLearnedPatterns(model);
  const pattern = result.patterns.find((p) => p.key === "prefers_simpler_recipes");
  assert.ok(pattern, "should emit prefers_simpler_recipes pattern");
});

test("deriveLearnedPatterns detects bold flavor preference", () => {
  const model: TasteModel = { ...emptyModel, flavorIntensityPreference: score(+0.5) };
  const result = deriveLearnedPatterns(model);
  const pattern = result.patterns.find((p) => p.key === "prefers_bold_flavors");
  assert.ok(pattern, "should emit prefers_bold_flavors pattern");
});

test("deriveLearnedPatterns does not emit patterns for weak scores (below threshold)", () => {
  const model: TasteModel = { ...emptyModel, spiceTolerance: score(-0.1) };
  const result = deriveLearnedPatterns(model);
  assert.equal(result.patterns.length, 0, "score too weak to emit a pattern");
});

test("deriveLearnedPatterns does not emit patterns for low confidence", () => {
  const model: TasteModel = { ...emptyModel, spiceTolerance: score(-0.8, 0.1) };
  const result = deriveLearnedPatterns(model);
  assert.equal(result.patterns.length, 0, "confidence too low to emit a pattern");
});

test("deriveLearnedPatterns includes cuisine and protein patterns when scored", () => {
  const model: TasteModel = {
    ...emptyModel,
    cuisines: { italian: score(0.7) },
    proteins: { chicken: score(0.6) },
  };
  const result = deriveLearnedPatterns(model);
  assert.ok(result.patterns.some((p) => p.key === "prefers_italian"));
  assert.ok(result.patterns.some((p) => p.key === "prefers_chicken"));
});

test("deriveLearnedPatterns always returns a valid generatedAt ISO timestamp", () => {
  const result = deriveLearnedPatterns(null);
  assert.ok(typeof result.generatedAt === "string");
  assert.ok(new Date(result.generatedAt).getTime() > 0);
});
