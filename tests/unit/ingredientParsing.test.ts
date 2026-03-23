import test from "node:test";
import assert from "node:assert/strict";
import { parseIngredientPhrase, isConversationalFiller } from "../../lib/ai/ingredientParsing";

// ---- Core extraction ----

test("parseIngredientPhrase strips quantity and unit", () => {
  assert.equal(parseIngredientPhrase("2 cans great northern beans, drained"), "great northern beans");
});

test("parseIngredientPhrase strips 'some fresh' prefix", () => {
  assert.equal(parseIngredientPhrase("some fresh Thai basil"), "thai basil");
});

test("parseIngredientPhrase strips conversational lead-in 'can we add ... to this'", () => {
  assert.equal(parseIngredientPhrase("can we add white beans to this"), "white beans");
});

test("parseIngredientPhrase strips 'maybe a little ... on top'", () => {
  assert.equal(parseIngredientPhrase("maybe a little pecorino on top"), "pecorino");
});

test("parseIngredientPhrase strips 'fresh' but preserves identity modifier 'thai'", () => {
  assert.equal(parseIngredientPhrase("fresh thai basil"), "thai basil");
});

test("parseIngredientPhrase strips 'chopped' prep word", () => {
  assert.equal(parseIngredientPhrase("fresh chopped cilantro"), "cilantro");
});

test("parseIngredientPhrase preserves 'dark' in 'dark soy sauce'", () => {
  assert.equal(parseIngredientPhrase("dark soy sauce"), "dark soy sauce");
});

test("parseIngredientPhrase preserves 'smoked' in 'smoked paprika'", () => {
  assert.equal(parseIngredientPhrase("smoked paprika"), "smoked paprika");
});

test("parseIngredientPhrase preserves 'extra virgin olive oil' as a complete phrase so the resolver can alias-match it", () => {
  // "extra" here is part of the product name, not a filler — keep it
  assert.equal(parseIngredientPhrase("extra virgin olive oil"), "extra virgin olive oil");
});

test("parseIngredientPhrase strips 'add' lead-in", () => {
  assert.equal(parseIngredientPhrase("add jalapeños"), "jalapeños");
});

test("parseIngredientPhrase strips trailing 'please'", () => {
  assert.equal(parseIngredientPhrase("garlic please"), "garlic");
});

test("parseIngredientPhrase strips 'I'd love some'", () => {
  assert.equal(parseIngredientPhrase("I'd love some jalapeños"), "jalapeños");
});

test("parseIngredientPhrase strips trailing 'on top'", () => {
  assert.equal(parseIngredientPhrase("parmesan on top"), "parmesan");
});

test("parseIngredientPhrase strips written quantity", () => {
  assert.equal(parseIngredientPhrase("a handful of pine nuts"), "pine nuts");
});

test("parseIngredientPhrase strips 'drained' prep word", () => {
  assert.equal(parseIngredientPhrase("drained chickpeas"), "chickpeas");
});

// ---- Invalid / filler phrases ----

test("parseIngredientPhrase returns null for 'something brighter'", () => {
  assert.equal(parseIngredientPhrase("something brighter"), null);
});

test("parseIngredientPhrase returns null for 'make it spicy'", () => {
  assert.equal(parseIngredientPhrase("make it spicy"), null);
});

test("parseIngredientPhrase returns null for 'keep it crispy'", () => {
  assert.equal(parseIngredientPhrase("keep it crispy"), null);
});

test("parseIngredientPhrase returns null for empty string", () => {
  assert.equal(parseIngredientPhrase(""), null);
});

test("parseIngredientPhrase returns null for bare 'protein'", () => {
  assert.equal(parseIngredientPhrase("protein"), null);
});

test("parseIngredientPhrase returns null for 'depth of flavor'", () => {
  assert.equal(parseIngredientPhrase("depth of flavor"), null);
});

// ---- isConversationalFiller ----

test("isConversationalFiller returns true for vague style requests", () => {
  assert.equal(isConversationalFiller("something brighter"), true);
  assert.equal(isConversationalFiller("make it spicy"), true);
  assert.equal(isConversationalFiller("maybe something a little brighter"), true);
});

test("isConversationalFiller returns false for real ingredient phrases", () => {
  assert.equal(isConversationalFiller("white beans"), false);
  assert.equal(isConversationalFiller("can we add garlic to this"), false);
  assert.equal(isConversationalFiller("jalapeños"), false);
});
