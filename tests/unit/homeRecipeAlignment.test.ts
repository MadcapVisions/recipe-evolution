import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveIdeaTitleFromConversationContext,
  detectRequestedDishFamily,
  recipeMatchesRequestedDirection,
} from "../../lib/ai/homeRecipeAlignment";

test("detectRequestedDishFamily prioritizes pasta over bowl when pasta is explicitly requested", () => {
  assert.equal(detectRequestedDishFamily("I want a pasta dish, not a bowl."), "pasta");
});

test("detectRequestedDishFamily keeps braises out of sauce_condiment", () => {
  assert.equal(
    detectRequestedDishFamily("Spanish-style braised chicken with tomato sauce, peppers, and mushrooms."),
    "braised"
  );
});

test("deriveIdeaTitleFromConversationContext keeps pasta direction from chef conversation", () => {
  assert.equal(
    deriveIdeaTitleFromConversationContext(
      "For the sauce, saute diced eggplant in olive oil and toss with pasta water. Yes to both cooking the pasta and preparing the sauce."
    ),
    "Eggplant Pasta"
  );
});

test("deriveIdeaTitleFromConversationContext names focaccia pizza requests directly", () => {
  assert.equal(
    deriveIdeaTitleFromConversationContext("I want a focaccia pizza with tomato sauce, mozzarella, and crisp edges."),
    "Focaccia Pizza"
  );
});

test("detectRequestedDishFamily catches cake at the end of a phrase", () => {
  assert.equal(detectRequestedDishFamily("I would like to make a sourdough discard granny cake"), "cake");
});

test("deriveIdeaTitleFromConversationContext preserves descriptive cake names from conversation text", () => {
  assert.equal(
    deriveIdeaTitleFromConversationContext(
      "I would like to make a sourdough discard granny cake. Incorporating cinnamon and nutmeg will enhance the warmth of the sourdough discard granny cake."
    ),
    "Sourdough Discard Granny Cake"
  );
});

test("recipeMatchesRequestedDirection rejects rice bowl drift when pasta was requested", () => {
  assert.equal(
    recipeMatchesRequestedDirection(
      {
        title: "Smoky Shrimp Rice Bowl",
        description: "A layered bowl with rice and shrimp.",
        ingredients: [{ name: "1 lb shrimp" }, { name: "1 cup rice" }],
        steps: [{ text: "Cook the rice and build the bowl." }],
      },
      "Build a pasta dish with eggplant sauce. Yes to both cooking the pasta and preparing the sauce."
    ),
    false
  );
});

test("recipeMatchesRequestedDirection accepts a pasta recipe when pasta was requested", () => {
  assert.equal(
    recipeMatchesRequestedDirection(
      {
        title: "Eggplant Pasta",
        description: "A light tomato-eggplant pasta.",
        ingredients: [{ name: "12 oz pasta" }, { name: "1 medium eggplant" }],
        steps: [{ text: "Cook the pasta and toss it with the eggplant sauce." }],
      },
      "Build a pasta dish with eggplant sauce. Yes to both cooking the pasta and preparing the sauce."
    ),
    true
  );
});

test("recipeMatchesRequestedDirection rejects skillet drift when focaccia pizza was requested", () => {
  assert.equal(
    recipeMatchesRequestedDirection(
      {
        title: "Mexican Chicken Skillet",
        description: "Chicken, rice, peppers, and a chipotle-lime sauce.",
        ingredients: [{ name: "1 lb chicken" }, { name: "1 cup rice" }],
        steps: [{ text: "Cook the rice and finish the chicken in the skillet sauce." }],
      },
      "I want a focaccia pizza with mozzarella and tomato sauce."
    ),
    false
  );
});
