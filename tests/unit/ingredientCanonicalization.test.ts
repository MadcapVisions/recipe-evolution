import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDistilledIngredientIntent,
  ingredientCanonicalKey,
  ingredientPhraseMatches,
  normalizeIngredientPhrase,
} from "../../lib/ai/ingredientCanonicalization";

test("canonical ingredient registry normalizes white bean aliases deliberately", () => {
  assert.equal(normalizeIngredientPhrase("cannellini beans"), "white beans");
  assert.equal(normalizeIngredientPhrase("great northern beans"), "white beans");
  assert.equal(ingredientCanonicalKey("cannellini beans"), "white_bean");
  assert.equal(ingredientCanonicalKey("great northern beans"), "white_bean");
});

test("ingredient matching uses canonical registry aliases", () => {
  assert.equal(ingredientPhraseMatches("white beans", "cannellini beans"), true);
  assert.equal(ingredientPhraseMatches("white beans", "great northern beans"), true);
});

test("distilled ingredient intents preserve readable labels while using canonical keys", () => {
  assert.deepEqual(buildDistilledIngredientIntent("cannellini beans"), {
    label: "white beans",
    canonical_key: "white_bean",
  });
});
