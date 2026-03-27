import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeRecipeTurn,
  normalizeRecipeEditInstruction,
  wantsRecipeDirectionOptions,
} from "../../lib/ai/recipeOrchestrator";

test("normalizeRecipeEditInstruction converts question-shaped edit requests into rewrite instructions", () => {
  assert.equal(
    normalizeRecipeEditInstruction("can I add chocolate chips to this"),
    "Add chocolate chips to the recipe."
  );
});

test("analyzeRecipeTurn marks conversational edit questions as buildable recipe updates", () => {
  const result = analyzeRecipeTurn({ userMessage: "can I add chocolate chips to this" });

  assert.equal(result.intent, "edit_request");
  assert.equal(result.action, "suggest_recipe_update");
  assert.equal(result.canBuildLatestRequest, true);
  assert.equal(result.shouldIncludeSuggestion, true);
  assert.equal(result.normalizedRecipeInstruction, "Add chocolate chips to the recipe.");
});

test("analyzeRecipeTurn treats recipe-specific method questions as buildable when recipe context exists", () => {
  const result = analyzeRecipeTurn({
    userMessage: "can we roast the potatoes for extra flavor",
    hasRecipeContext: true,
  });

  assert.equal(result.intent, "edit_request");
  assert.equal(result.action, "suggest_recipe_update");
  assert.equal(result.canBuildLatestRequest, true);
  assert.equal(result.shouldIncludeSuggestion, true);
  assert.equal(result.normalizedRecipeInstruction, "Roast the potatoes for extra flavor in the recipe.");
});

test("analyzeRecipeTurn keeps pure technique questions in reply-only mode", () => {
  const result = analyzeRecipeTurn({ userMessage: "what temperature should I bake this at?" });

  assert.equal(result.intent, "question");
  assert.equal(result.action, "reply_only");
  assert.equal(result.canBuildLatestRequest, false);
  assert.equal(result.shouldIncludeSuggestion, false);
  assert.equal(result.normalizedRecipeInstruction, null);
});

test("analyzeRecipeTurn treats short contextual edit fragments as buildable when recipe context exists", () => {
  const result = analyzeRecipeTurn({ userMessage: "more eggs and rum", hasRecipeContext: true });

  assert.equal(result.intent, "edit_request");
  assert.equal(result.action, "suggest_recipe_update");
  assert.equal(result.canBuildLatestRequest, true);
  assert.equal(result.shouldIncludeSuggestion, true);
  assert.equal(result.normalizedRecipeInstruction, "more eggs and rum");
});

test("analyzeRecipeTurn keeps short fragments in clarify mode when there is no recipe context", () => {
  const result = analyzeRecipeTurn({ userMessage: "more eggs and rum" });

  assert.equal(result.intent, "clarify");
  assert.equal(result.action, "ask_clarifying_question");
  assert.equal(result.canBuildLatestRequest, false);
});

test("wantsRecipeDirectionOptions detects option-seeking prompts", () => {
  assert.equal(wantsRecipeDirectionOptions("give me 3 options for this"), true);
  assert.equal(wantsRecipeDirectionOptions("make this spicier"), false);
});
