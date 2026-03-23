import test from "node:test";
import assert from "node:assert/strict";
import { resolveIngredientPhrase } from "../../lib/ai/ingredientResolver";

// ---- Exact and normalized alias resolution ----

test("resolveIngredientPhrase resolves 'cannellini beans' to white_bean", () => {
  const result = resolveIngredientPhrase("cannellini beans");
  assert.equal(result.canonical_key, "white_bean");
  assert.equal(result.family_key, "bean");
  assert.ok(result.confidence >= 0.9, `expected confidence >= 0.9, got ${result.confidence}`);
  assert.ok(["exact_alias", "normalized_alias"].includes(result.resolution_method));
});

test("resolveIngredientPhrase resolves 'great northern beans' to white_bean", () => {
  const result = resolveIngredientPhrase("great northern beans");
  assert.equal(result.canonical_key, "white_bean");
  assert.ok(result.confidence >= 0.9);
});

test("resolveIngredientPhrase resolves 'cannellini' alone to white_bean", () => {
  // "cannellini" is a direct alias entry, so it resolves at high confidence
  const result = resolveIngredientPhrase("cannellini");
  assert.equal(result.canonical_key, "white_bean");
  assert.ok(result.confidence >= 0.75, `expected >= 0.75, got ${result.confidence}`);
});

test("resolveIngredientPhrase resolves 'green onions' to scallion", () => {
  const result = resolveIngredientPhrase("green onions");
  assert.equal(result.canonical_key, "scallion");
  assert.ok(result.confidence >= 0.9);
});

test("resolveIngredientPhrase resolves 'spring onion' to scallion", () => {
  const result = resolveIngredientPhrase("spring onion");
  assert.equal(result.canonical_key, "scallion");
  assert.ok(result.confidence >= 0.9);
});

test("resolveIngredientPhrase resolves 'pecorino romano' to pecorino", () => {
  const result = resolveIngredientPhrase("pecorino romano");
  assert.equal(result.canonical_key, "pecorino");
  assert.ok(result.confidence >= 0.9);
});

test("resolveIngredientPhrase resolves 'garbanzo beans' to chickpea", () => {
  const result = resolveIngredientPhrase("garbanzo beans");
  assert.equal(result.canonical_key, "chickpea");
  assert.ok(result.confidence >= 0.9);
});

test("resolveIngredientPhrase resolves 'parmigiano reggiano' to parmesan", () => {
  const result = resolveIngredientPhrase("parmigiano reggiano");
  assert.equal(result.canonical_key, "parmesan");
  assert.ok(result.confidence >= 0.9);
});

// ---- Identity preservation ----

test("resolveIngredientPhrase keeps thai_basil distinct from basil", () => {
  const thai = resolveIngredientPhrase("thai basil");
  const regular = resolveIngredientPhrase("basil");
  assert.equal(thai.canonical_key, "thai_basil");
  assert.equal(regular.canonical_key, "basil");
  assert.notEqual(thai.canonical_key, regular.canonical_key);
});

test("resolveIngredientPhrase resolves 'sweet potato' separately from 'potato'", () => {
  const sweet = resolveIngredientPhrase("sweet potato");
  const regular = resolveIngredientPhrase("potato");
  assert.equal(sweet.canonical_key, "sweet_potato");
  assert.equal(regular.canonical_key, "potato");
});

// ---- With filler stripping ----

test("resolveIngredientPhrase strips lead-in before resolving", () => {
  const result = resolveIngredientPhrase("can we add white beans to this");
  assert.equal(result.canonical_key, "white_bean");
  assert.ok(result.confidence >= 0.9);
});

test("resolveIngredientPhrase strips 'some fresh' before resolving", () => {
  const result = resolveIngredientPhrase("some fresh garlic");
  assert.equal(result.canonical_key, "garlic");
});

// ---- Family inference ----

test("resolveIngredientPhrase infers family for partial phrase with family token", () => {
  const result = resolveIngredientPhrase("some kind of bean");
  assert.equal(result.resolution_method, "family_inference");
  assert.equal(result.family_key, "bean");
  assert.ok(result.confidence >= 0.75);
  assert.equal(result.canonical_key, null);
});

test("resolveIngredientPhrase infers mushroom family", () => {
  const result = resolveIngredientPhrase("a mushroom");
  assert.equal(result.family_key, "mushroom");
  assert.ok(["exact_alias", "normalized_alias", "fuzzy_alias", "family_inference"].includes(result.resolution_method));
});

// ---- Unresolved ----

test("resolveIngredientPhrase returns unresolved for 'something brighter'", () => {
  const result = resolveIngredientPhrase("something brighter");
  assert.equal(result.resolution_method, "unresolved");
  assert.ok(result.confidence < 0.75);
  assert.equal(result.canonical_key, null);
});

test("resolveIngredientPhrase returns unresolved for vague filler", () => {
  const result = resolveIngredientPhrase("make it spicy");
  assert.equal(result.resolution_method, "unresolved");
  assert.equal(result.canonical_id, null);
});

// ---- Confidence thresholds ----

test("resolveIngredientPhrase has confidence >= 0.9 for exact alias matches", () => {
  const result = resolveIngredientPhrase("chickpeas");
  assert.ok(result.confidence >= 0.9, `got ${result.confidence}`);
});

test("resolveIngredientPhrase returns display_label for resolved entries", () => {
  const result = resolveIngredientPhrase("cannellini beans");
  assert.equal(result.display_label, "white beans");
});
