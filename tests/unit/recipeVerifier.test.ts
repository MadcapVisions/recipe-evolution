import test from "node:test";
import assert from "node:assert/strict";
import { compileCookingBrief } from "../../lib/ai/briefCompiler";
import { verifyRecipeAgainstBrief } from "../../lib/ai/recipeVerifier";

test("verifyRecipeAgainstBrief passes aligned focaccia pizza recipe", () => {
  const brief = compileCookingBrief({
    userMessage: "I want focaccia pizza with crisp edges",
    assistantReply: "Locked direction: Focaccia Pizza. Sheet-pan focaccia-style pizza with tomato sauce and mozzarella.",
    recipeContext: {
      title: "Focaccia Pizza",
      ingredients: ["pizza dough", "mozzarella", "tomato sauce"],
      steps: ["Bake until golden."],
    },
  });

  const result = verifyRecipeAgainstBrief({
    brief,
    recipe: {
      title: "Crispy Focaccia Pizza",
      description: "A focaccia-style pizza with crisp edges and tomato sauce.",
      ingredients: [{ name: "1 lb pizza dough" }, { name: "8 oz mozzarella" }, { name: "1/2 cup tomato sauce" }],
      steps: [{ text: "Bake the focaccia-style pizza until the crust is golden and crisp at the edges." }],
    },
  });

  assert.equal(result.passes, true);
});

test("verifyRecipeAgainstBrief fails generic drifting skillet recipe", () => {
  const brief = compileCookingBrief({
    userMessage: "I want focaccia pizza with crisp edges",
    assistantReply: "Locked direction: Focaccia Pizza. Sheet-pan focaccia-style pizza with tomato sauce and mozzarella.",
  });

  const result = verifyRecipeAgainstBrief({
    brief,
    recipe: {
      title: "Chef Conversation Recipe",
      description: "Chicken and rice skillet.",
      ingredients: [{ name: "1 lb chicken" }, { name: "1 cup rice" }],
      steps: [{ text: "Cook the chicken and rice in a skillet." }],
    },
  });

  assert.equal(result.passes, false);
  assert.ok(result.reasons.some((reason) => reason.toLowerCase().includes("dish family")));
  assert.equal(result.checks.title_quality_pass, false);
});

test("verifyRecipeAgainstBrief passes obscure named dish when title preserves the request", () => {
  const brief = compileCookingBrief({
    userMessage: "Make Brazilian moqueca with coconut milk and fish",
    conversationHistory: [],
  });

  const result = verifyRecipeAgainstBrief({
    brief,
    recipe: {
      title: "Brazilian Moqueca with Coconut Milk and Fish",
      description: "A gently simmered Brazilian fish stew with coconut milk, peppers, and lime.",
      ingredients: [{ name: "1 1/2 lb white fish" }, { name: "1 can coconut milk" }, { name: "1 bell pepper" }],
      steps: [{ text: "Simmer the moqueca gently until the fish is tender and the broth is fragrant." }],
    },
  });

  assert.equal(result.passes, true);
});
