import test from "node:test";
import assert from "node:assert/strict";
import { compileCookingBrief } from "../../lib/ai/briefCompiler";

test("compileCookingBrief locks focaccia pizza requests into pizza family", () => {
  const brief = compileCookingBrief({
    userMessage: "I want focaccia pizza with crisp edges",
    assistantReply: "Locked direction: Focaccia Pizza. Sheet-pan focaccia-style pizza with tomato sauce and mozzarella.",
    conversationHistory: [],
    recipeContext: {
      title: "Focaccia Pizza",
      ingredients: ["pizza dough", "mozzarella", "tomato sauce"],
      steps: ["Bake until golden."],
    },
  });

  assert.equal(brief.request_mode, "locked");
  assert.equal(brief.dish.dish_family, "pizza");
  assert.equal(brief.dish.normalized_name, "Focaccia Pizza");
  assert.equal(brief.field_state.dish_family, "locked");
  assert.match(brief.directives.must_have.join(" "), /pizza/i);
});

test("compileCookingBrief captures exclusions and time limits", () => {
  const brief = compileCookingBrief({
    userMessage: "No onions, no garlic, high-protein dinner in 30 minutes",
    assistantReply: "A high-protein dinner without onions or garlic is doable.",
    conversationHistory: [],
  });

  assert.equal(brief.constraints.time_max_minutes, 30);
  assert.ok(brief.ingredients.forbidden.includes("onions"));
  assert.ok(brief.ingredients.forbidden.includes("garlic"));
  assert.ok(brief.constraints.dietary_tags.includes("high protein"));
});

test("compileCookingBrief keeps recipe-context ingredients as preferred and only extracts explicit hard requirements", () => {
  const brief = compileCookingBrief({
    userMessage: "this sounds great, lets make sure it has jalapeños and make it nice and spicy",
    assistantReply: "Locked direction: Chicken Fajita Bowls with Bell Peppers and Crispy Rice. Bright, crunchy Mexican-style chicken bowl.",
    conversationHistory: [],
    recipeContext: {
      title: "Chicken Fajita Bowls with Bell Peppers and Crispy Rice",
      ingredients: ["chicken", "bell peppers", "crispy rice"],
      steps: ["Cook the chicken and peppers, then serve over crispy rice."],
    },
  });

  assert.deepEqual(brief.ingredients.required, ["jalapeños"]);
  assert.deepEqual(brief.ingredients.preferred, ["chicken", "bell peppers", "crispy rice"]);
  assert.equal(brief.ingredients.centerpiece, "Chicken Fajita Bowl");
});

test("compileCookingBrief preserves obscure named dishes instead of collapsing to fallback protein titles", () => {
  const okonomiyakiBrief = compileCookingBrief({
    userMessage: "I want Osaka-style okonomiyaki with cabbage and pork belly",
    conversationHistory: [],
  });
  const congeeBrief = compileCookingBrief({
    userMessage: "Make century egg and pork congee",
    conversationHistory: [],
  });
  const moquecaBrief = compileCookingBrief({
    userMessage: "Make Brazilian moqueca with coconut milk and fish",
    conversationHistory: [],
  });

  assert.equal(okonomiyakiBrief.dish.normalized_name, "Okonomiyaki");
  assert.equal(okonomiyakiBrief.ingredients.centerpiece, "Okonomiyaki");

  assert.equal(congeeBrief.dish.normalized_name, "Century Egg and Pork Congee");
  assert.equal(congeeBrief.dish.dish_family, "soup");

  assert.equal(moquecaBrief.dish.normalized_name, "Brazilian Moqueca");
  assert.equal(moquecaBrief.dish.dish_family, "soup");
});

test("compileCookingBrief keeps tostada directions in the taco lane", () => {
  const brief = compileCookingBrief({
    userMessage: "lets add jalapeños",
    assistantReply: "Locked direction: Crispy Chicken Tostadas with Avocado Crema. Add jalapeños to the avocado crema or use them as a garnish.",
    conversationHistory: [],
    recipeContext: {
      title: "Crispy Chicken Tostadas with Avocado Crema",
      ingredients: ["chicken", "tostada shells", "avocado crema"],
      steps: ["Pile the chicken onto tostada shells and finish with avocado crema."],
    },
  });

  assert.equal(brief.dish.dish_family, "tacos");
  assert.equal(brief.dish.normalized_name, "Chicken Tostadas");
  assert.equal(brief.ingredients.centerpiece, "Chicken Tostadas");
});
