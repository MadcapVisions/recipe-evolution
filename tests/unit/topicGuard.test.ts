import test from "node:test";
import assert from "node:assert/strict";
import { COOKING_SCOPE_MESSAGE, guardCookingTopic } from "../../lib/ai/topicGuard";

test("allows clearly cooking-related home prompt", () => {
  const result = guardCookingTopic({
    message: "I need a quick lemon chicken dinner with a crisp side.",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.reason, "cooking");
});

test("allows recipe-detail follow-up with recipe context", () => {
  const result = guardCookingTopic({
    message: "Make it spicier and a little faster.",
    recipeContext: {
      title: "Turkey Chili",
      ingredients: ["ground turkey", "beans", "cumin"],
      steps: ["Brown the turkey", "Simmer the chili"],
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.reason, "recipe_context");
});

test("blocks obvious general chat", () => {
  const result = guardCookingTopic({
    message: "Can you help me write a React component and fix a TypeScript error?",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "off_topic");
});

test("blocks finance request even when phrased conversationally", () => {
  const result = guardCookingTopic({
    message: "What stocks should I buy this month?",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "off_topic");
});

test("scope message points users back to cooking topics", () => {
  assert.match(COOKING_SCOPE_MESSAGE, /cooking-focused requests only/i);
  assert.match(COOKING_SCOPE_MESSAGE, /ingredients/i);
});
