import test from "node:test";
import assert from "node:assert/strict";
import { applyPostCookFeedback } from "../../lib/ai/feedback/applyPostCookFeedback";
import type { PostCookFeedback } from "../../lib/ai/feedback/postCookFeedbackTypes";
import type { RecipeFeatures } from "../../lib/ai/tasteModel";

const sampleFeatures: RecipeFeatures = {
  cuisines: ["italian"],
  proteins: ["chicken"],
  flavors: ["creamy", "savory"],
  dishFamily: "pasta",
  ingredients: ["chicken", "cream", "garlic", "parmesan"],
};

function feedback(overrides: Partial<PostCookFeedback> = {}): PostCookFeedback {
  return {
    overall_outcome: "great",
    would_make_again: null,
    issue_tags: [],
    notes: null,
    ...overrides,
  };
}

test("great outcome reinforces cuisine, protein, and dish family", () => {
  const result = applyPostCookFeedback(null, feedback({ overall_outcome: "great" }), sampleFeatures);
  assert.ok((result.cuisines["italian"]?.score ?? 0) > 0, "italian cuisine score should increase");
  assert.ok((result.proteins["chicken"]?.score ?? 0) > 0, "chicken protein score should increase");
  assert.ok((result.dishFamilies["pasta"]?.score ?? 0) > 0, "pasta dish family score should increase");
});

test("disappointing outcome downranks dish family", () => {
  const result = applyPostCookFeedback(null, feedback({ overall_outcome: "disappointing" }), sampleFeatures);
  assert.ok((result.dishFamilies["pasta"]?.score ?? 0) < 0, "pasta dish family score should decrease");
});

test("failed outcome applies stronger downrank than disappointing", () => {
  const disappointing = applyPostCookFeedback(null, feedback({ overall_outcome: "disappointing" }), sampleFeatures);
  const failed = applyPostCookFeedback(null, feedback({ overall_outcome: "failed" }), sampleFeatures);
  assert.ok(
    (failed.dishFamilies["pasta"]?.score ?? 0) < (disappointing.dishFamilies["pasta"]?.score ?? 0),
    "failed should produce a lower dish family score than disappointing"
  );
});

test("too_spicy tag reduces spiceTolerance score", () => {
  const result = applyPostCookFeedback(
    null,
    feedback({ overall_outcome: "good_with_changes", issue_tags: ["too_spicy"] }),
    sampleFeatures
  );
  assert.ok((result.spiceTolerance?.score ?? 0) < 0, "spiceTolerance should decrease");
  assert.ok((result.flavors["spicy"]?.score ?? 0) < 0, "spicy flavor score should decrease");
});

test("too_heavy tag reduces richnessPreference score", () => {
  const result = applyPostCookFeedback(
    null,
    feedback({ overall_outcome: "good_with_changes", issue_tags: ["too_heavy"] }),
    sampleFeatures
  );
  assert.ok((result.richnessPreference?.score ?? 0) < 0, "richnessPreference should decrease");
});

test("too_bland tag increases flavorIntensityPreference", () => {
  const result = applyPostCookFeedback(
    null,
    feedback({ overall_outcome: "good_with_changes", issue_tags: ["too_bland"] }),
    sampleFeatures
  );
  assert.ok((result.flavorIntensityPreference?.score ?? 0) > 0, "flavorIntensityPreference should increase");
});

test("too_salty tag decreases flavorIntensityPreference", () => {
  const result = applyPostCookFeedback(
    null,
    feedback({ overall_outcome: "good_with_changes", issue_tags: ["too_salty"] }),
    sampleFeatures
  );
  assert.ok((result.flavorIntensityPreference?.score ?? 0) < 0, "flavorIntensityPreference should decrease");
});

test("too_many_steps tag decreases complexityTolerance", () => {
  const result = applyPostCookFeedback(
    null,
    feedback({ overall_outcome: "good_with_changes", issue_tags: ["too_many_steps"] }),
    sampleFeatures
  );
  assert.ok((result.complexityTolerance?.score ?? 0) < 0, "complexityTolerance should decrease");
});

test("too_complex and too_many_steps both reduce complexityTolerance", () => {
  const r1 = applyPostCookFeedback(null, feedback({ issue_tags: ["too_complex"] }), sampleFeatures);
  const r2 = applyPostCookFeedback(null, feedback({ issue_tags: ["too_many_steps"] }), sampleFeatures);
  assert.ok((r1.complexityTolerance?.score ?? 0) < 0);
  assert.ok((r2.complexityTolerance?.score ?? 0) < 0);
});

test("would_make_again false does not create a broad cuisine dislike", () => {
  const result = applyPostCookFeedback(
    null,
    feedback({ overall_outcome: "disappointing", would_make_again: false }),
    sampleFeatures
  );
  // Cuisine score should be negative but not collapse — would_make_again is version-level only
  const cuisineScore = result.cuisines["italian"]?.score ?? 0;
  assert.ok(cuisineScore > -0.6, `cuisine score (${cuisineScore}) should not collapse from would_make_again alone`);
});

test("all scores remain within [-1, 1] after a single event", () => {
  const result = applyPostCookFeedback(
    null,
    feedback({ overall_outcome: "failed", issue_tags: ["too_spicy", "too_heavy", "too_bland"] }),
    sampleFeatures
  );
  const scores = [
    result.spiceTolerance?.score,
    result.richnessPreference?.score,
    result.flavorIntensityPreference?.score,
    ...Object.values(result.cuisines).map((s) => s.score),
    ...Object.values(result.flavors).map((s) => s.score),
  ].filter((s): s is number => s !== undefined && s !== null);

  for (const s of scores) {
    assert.ok(s >= -1 && s <= 1, `score ${s} is out of bounds`);
  }
});

test("null model initializes cleanly without throwing", () => {
  const result = applyPostCookFeedback(null, feedback(), sampleFeatures);
  assert.ok(typeof result.cuisines === "object");
  assert.ok(typeof result.proteins === "object");
});

test("texture_off tag does not throw (no score dim, silently skipped)", () => {
  assert.doesNotThrow(() => {
    applyPostCookFeedback(null, feedback({ issue_tags: ["texture_off"] }), sampleFeatures);
  });
});
