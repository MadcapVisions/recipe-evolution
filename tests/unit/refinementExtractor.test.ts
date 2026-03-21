import test from "node:test";
import assert from "node:assert/strict";
import { extractRefinementDelta } from "../../lib/ai/refinementExtractor";

test("extractRefinementDelta captures explicit required and forbidden ingredients", () => {
  const result = extractRefinementDelta({
    userText: "lets add jalapeños and skip onions",
    assistantText: "Add diced jalapeños to the crema and leave out the onions.",
  });

  assert.ok(result.extracted_changes.required_ingredients.includes("jalapeños"));
  assert.ok(result.extracted_changes.forbidden_ingredients.includes("onions"));
  assert.equal(result.field_state.ingredients, "inferred");
  assert.equal(result.ambiguity_reason, null);
  assert.ok(result.confidence >= 0.8);
});

test("extractRefinementDelta captures style tags and preferred garnishes", () => {
  const result = extractRefinementDelta({
    userText: "keep it traditional but finish with parsley",
    assistantText: "Keep the classic structure and finish with chopped parsley.",
  });

  assert.ok(result.extracted_changes.style_tags.includes("traditional"));
  assert.ok(result.extracted_changes.preferred_ingredients.includes("parsley"));
  assert.equal(result.field_state.style, "inferred");
});

test("extractRefinementDelta marks vague prompts as ambiguous", () => {
  const result = extractRefinementDelta({
    userText: "make it better",
    assistantText: "Try a brighter finish and better contrast.",
  });

  assert.deepEqual(result.extracted_changes.required_ingredients, []);
  assert.equal(result.field_state.ingredients, "unknown");
  assert.equal(result.ambiguity_reason, "Refinement was too vague to convert into structured constraints.");
  assert.ok(result.confidence < 0.7);
});

test("extractRefinementDelta handles instead-of swaps without malformed ingredient strings", () => {
  const result = extractRefinementDelta({
    userText: "use chicken thighs instead of breasts",
    assistantText: "Chicken thighs will stay juicier here.",
  });

  assert.deepEqual(result.extracted_changes.required_ingredients, ["chicken thighs"]);
  assert.deepEqual(result.extracted_changes.forbidden_ingredients, ["breasts"]);
  assert.equal(result.ambiguity_reason, null);
});

test("extractRefinementDelta captures natural preference language", () => {
  const result = extractRefinementDelta({
    userText: "I'd love some jalapeños and more garlic please",
    assistantText: "Jalapeños and garlic will push the heat and savoriness.",
  });

  assert.ok(result.extracted_changes.required_ingredients.includes("jalapeños"));
  assert.ok(result.extracted_changes.preferred_ingredients.includes("garlic"));
});

test("extractRefinementDelta maps semantic style changes into structured tags", () => {
  const result = extractRefinementDelta({
    userText: "make it feel authentic and a bit heartier",
    assistantText: "Keep it traditional and make the filling richer.",
  });

  assert.ok(result.extracted_changes.style_tags.includes("traditional"));
  assert.ok(result.extracted_changes.style_tags.includes("richer"));
});
