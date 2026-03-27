import test from "node:test";
import assert from "node:assert/strict";
import { compileCookingBrief } from "../../lib/ai/briefCompiler";
import { buildRecipePlanFromBrief } from "../../lib/ai/recipePlanner";

test("buildRecipePlanFromBrief creates pizza-focused plan", () => {
  const brief = compileCookingBrief({
    userMessage: "I want focaccia pizza with crisp edges",
    assistantReply: "Locked direction: Focaccia Pizza. Sheet-pan focaccia-style pizza with tomato sauce and mozzarella.",
    recipeContext: {
      title: "Focaccia Pizza",
      ingredients: ["pizza dough", "mozzarella", "tomato sauce"],
      steps: ["Bake until golden."],
    },
  });

  const plan = buildRecipePlanFromBrief(brief);
  assert.equal(plan.dish_family, "pizza");
  assert.ok(plan.core_components.includes("dough"));
  assert.ok(plan.technique_outline.some((step) => step.toLowerCase().includes("bake")));
  assert.ok(plan.key_ingredients.includes("pizza dough"));
});

test("buildRecipePlanFromBrief carries blocked ingredients forward", () => {
  const brief = compileCookingBrief({
    userMessage: "No onions, no garlic, high-protein dinner in 30 minutes",
    assistantReply: "A high-protein dinner without onions or garlic is doable.",
  });

  const plan = buildRecipePlanFromBrief(brief);
  assert.ok(plan.blocked_ingredients.includes("onions"));
  assert.ok(plan.blocked_ingredients.includes("garlic"));
  assert.ok(plan.notes.some((note) => note.includes("30 minutes")));
});

test("buildRecipePlanFromBrief adapts bread pudding technique for slow cooker requests", () => {
  const brief = compileCookingBrief({
    userMessage: "I want banana bread pudding in a slow cooker with sourdough discard",
    conversationHistory: [],
  });

  const plan = buildRecipePlanFromBrief(brief);
  assert.ok(plan.technique_outline.some((step) => step.toLowerCase().includes("slow cooker")));
  assert.ok(plan.notes.some((note) => note.includes("slow cooker")));
});
