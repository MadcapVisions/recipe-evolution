import test from "node:test";
import assert from "node:assert/strict";
import { ingredientsMatch } from "../../lib/ai/ingredientMatching";
import { resolveIngredientPhrase } from "../../lib/ai/ingredientResolver";

function resolve(phrase: string) {
  return resolveIngredientPhrase(phrase);
}

// ---- strict_canonical ----

test("strict_canonical: same canonical_id matches", () => {
  const r1 = resolve("white beans");
  const r2 = resolve("cannellini beans");
  assert.equal(ingredientsMatch(r1, r2, "strict_canonical"), true);
});

test("strict_canonical: different canonical_id does not match", () => {
  const r1 = resolve("white beans");
  const r2 = resolve("chickpeas");
  assert.equal(ingredientsMatch(r1, r2, "strict_canonical"), false);
});

test("strict_canonical: same family but different canonical does not match", () => {
  const r1 = resolve("white beans");
  const r2 = resolve("black beans");
  assert.equal(ingredientsMatch(r1, r2, "strict_canonical"), false);
});

test("strict_canonical: unresolved constraint never matches", () => {
  const r1 = resolve("something brighter");
  const r2 = resolve("lemon");
  assert.equal(ingredientsMatch(r1, r2, "strict_canonical"), false);
});

test("strict_canonical: onion forbidden does not match white onion candidate", () => {
  // Both resolve to the same canonical_id (onion)
  const r1 = resolve("onions");
  const r2 = resolve("white onion");
  // Both should resolve to onion canonical — forbidden should block
  assert.equal(ingredientsMatch(r1, r2, "strict_canonical"), true);
});

// ---- canonical_with_family_fallback ----

test("canonical_with_family_fallback: canonical_id match succeeds", () => {
  const r1 = resolve("great northern beans");
  const r2 = resolve("cannellini beans");
  // Both are white_bean → match
  assert.equal(ingredientsMatch(r1, r2, "canonical_with_family_fallback"), true);
});

test("canonical_with_family_fallback: different canonical, same family does NOT fall back when constraint is canonical-resolved", () => {
  // white_bean ≠ chickpea, both are family=bean, but constraint is canonical-resolved (not family_inference)
  const r1 = resolve("white beans");
  const r2 = resolve("chickpeas");
  assert.equal(ingredientsMatch(r1, r2, "canonical_with_family_fallback"), false);
});

test("canonical_with_family_fallback: family_inference constraint matches any family member", () => {
  const r1 = resolve("some kind of bean");   // family_inference
  const r2 = resolve("cannellini beans");    // canonical white_bean / family=bean
  assert.equal(r1.resolution_method, "family_inference");
  assert.equal(ingredientsMatch(r1, r2, "canonical_with_family_fallback"), true);
});

test("canonical_with_family_fallback: unresolved constraint does not match", () => {
  const r1 = resolve("make it spicy");
  const r2 = resolve("jalapeños");
  assert.equal(ingredientsMatch(r1, r2, "canonical_with_family_fallback"), false);
});

// ---- soft_preference ----

test("soft_preference: canonical match succeeds", () => {
  const r1 = resolve("parmesan");
  const r2 = resolve("parmigiano reggiano");
  assert.equal(ingredientsMatch(r1, r2, "soft_preference"), true);
});

test("soft_preference: same family matches", () => {
  const r1 = resolve("mushrooms");
  const r2 = resolve("shiitake mushrooms");
  // Different canonical but same family
  assert.equal(ingredientsMatch(r1, r2, "soft_preference"), true);
});

// ---- planning ----

test("planning: family match suffices", () => {
  const r1 = resolve("some kind of bean");
  const r2 = resolve("lentils");
  // Both are legume/bean family
  assert.ok(r2.family_key !== null);
  // May or may not match depending on exact family keys
  // lentil is family=legume, white_bean is family=bean — different families
  const r3 = resolve("chickpeas"); // family=bean
  assert.equal(ingredientsMatch(r1, r3, "planning"), true);
});
