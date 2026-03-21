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

test("allows pantry ingredient list prompts", () => {
  const result = guardCookingTopic({
    message: "eggs, spinach, feta, potatoes",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.reason, "cooking");
});

test("allows meal prep planning prompts", () => {
  const result = guardCookingTopic({
    message: "What should I meal prep on Sunday for 3 lunches this week?",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.reason, "cooking");
});

test("allows grocery and budget prompts", () => {
  const result = guardCookingTopic({
    message: "What can I make for under $20 with chicken thighs and rice?",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.reason, "cooking");
});

test("allows sauce and snack option requests", () => {
  const result = guardCookingTopic({
    message: "Give me 3 options for dipping sauces for tortilla chips.",
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
  assert.equal(result.reason, "cooking");
});

test("allows ingredient exclusion follow-up with active recipe context", () => {
  const result = guardCookingTopic({
    message: "I don't like cabbage or corn.",
    recipeContext: {
      title: "Shrimp Bacon Pasta",
      ingredients: ["shrimp", "bacon", "pasta", "cabbage", "corn"],
      steps: ["Cook the pasta", "Saute the bacon and vegetables", "Finish with shrimp"],
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.reason, "cooking");
});

test("allows scaling follow-up with active recipe context", () => {
  const result = guardCookingTopic({
    message: "Double this for 8.",
    recipeContext: {
      title: "Baked Ziti",
      ingredients: ["ziti", "ricotta", "mozzarella"],
      steps: ["Boil the pasta", "Bake until bubbling"],
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.reason, "cooking");
});

test("allows short ingredient-addition follow-up with active recipe context", () => {
  const result = guardCookingTopic({
    message: "lets add jalapeños",
    recipeContext: {
      title: "Crispy Chicken Tostadas with Avocado Crema",
      ingredients: ["chicken", "tostada shells", "avocado", "lime"],
      steps: ["Pile the chicken onto tostada shells and finish with avocado crema."],
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.reason, "cooking");
});

test("allows short natural refinements with active recipe context even without explicit cooking keywords", () => {
  const recipeContext = {
    title: "Crispy Chicken Tostadas with Avocado Crema",
    ingredients: ["chicken", "tostada shells", "avocado", "lime"],
    steps: ["Pile the chicken onto tostada shells and finish with avocado crema."],
  };

  assert.deepEqual(guardCookingTopic({ message: "more lime", recipeContext }), { allowed: true, reason: "cooking" });
  assert.deepEqual(guardCookingTopic({ message: "skip the crema", recipeContext }), { allowed: true, reason: "cooking" });
  assert.deepEqual(guardCookingTopic({ message: "use thighs instead", recipeContext }), { allowed: true, reason: "cooking" });
  assert.deepEqual(guardCookingTopic({ message: "make it crunchier", recipeContext }), { allowed: true, reason: "cooking" });
});

test("blocks obvious programming requests", () => {
  const result = guardCookingTopic({
    message: "Can you help me write a React component and fix a TypeScript error?",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "off_topic");
});

test("blocks airline ticket searches", () => {
  const result = guardCookingTopic({
    message: "Can you search for airline tickets to Denver next week?",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "off_topic");
});

test("blocks mortgage rate requests", () => {
  const result = guardCookingTopic({
    message: "What are today's mortgage rates?",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "off_topic");
});

test("blocks generic non-cooking chat", () => {
  const result = guardCookingTopic({
    message: "Tell me a joke.",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "off_topic");
});

test("scope message points users back to cooking topics", () => {
  assert.match(COOKING_SCOPE_MESSAGE, /cooking-focused requests only/i);
  assert.match(COOKING_SCOPE_MESSAGE, /sauces/i);
  assert.match(COOKING_SCOPE_MESSAGE, /meal prep/i);
});
