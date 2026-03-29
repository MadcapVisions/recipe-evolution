import test from "node:test";
import assert from "node:assert/strict";
import { compileCookingBrief } from "../../lib/ai/briefCompiler";
import { verifyRecipeAgainstBrief } from "../../lib/ai/recipeVerifier";
import type { CanonicalRecipeSessionState } from "../../lib/ai/contracts/sessionState";

function createLockedSessionState(): CanonicalRecipeSessionState {
  return {
    conversation_key: "home-1",
    scope: "home_hub",
    recipe_id: null,
    version_id: null,
    active_dish: {
      title: "Slow Cooker Banana Bread Pudding",
      dish_family: "bread_pudding",
      locked: true,
    },
    selected_direction: {
      id: "opt-1",
      title: "Slow Cooker Banana Bread Pudding",
      summary: "Custardy banana bread pudding made in the slow cooker.",
      tags: ["dessert"],
    },
    hard_constraints: {
      required_named_ingredients: ["sourdough discard"],
      required_ingredients: [],
      forbidden_ingredients: [],
      required_techniques: ["slow_cook"],
      equipment_limits: ["slow cooker"],
    },
    soft_preferences: {
      preferred_ingredients: [],
      style_tags: [],
      nice_to_have: [],
    },
    rejected_branches: [],
    recipe_context: null,
    conversation: {
      last_user_message: "Make banana bread pudding in a slow cooker with sourdough discard.",
      last_assistant_message: null,
      turn_count: 2,
    },
    source: {
      updated_by: "test",
      brief_confidence: 0.93,
    },
  };
}

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
      steps: [{ text: "Simmer the fish gently in the coconut milk broth until the moqueca is fragrant and tender." }],
    },
  });

  assert.equal(result.passes, true);
});

test("verifyRecipeAgainstBrief allows refined titles that preserve the locked direction tokens", () => {
  const brief = compileCookingBrief({
    userMessage: "this sounds great, lets make sure it has jalapeños and make it nice and spicy",
    assistantReply: "Locked direction: Chicken Fajita Bowls with Bell Peppers and Crispy Rice. Bright, crunchy Mexican-style chicken bowl.",
    recipeContext: {
      title: "Chicken Fajita Bowls with Bell Peppers and Crispy Rice",
      ingredients: ["chicken", "bell peppers", "rice", "jalapeños"],
      steps: ["Cook the chicken and peppers, then serve over crispy rice."],
    },
  });

  const result = verifyRecipeAgainstBrief({
    brief,
    recipe: {
      title: "Spicy Chicken Fajita Bowl with Jalapeños",
      description: "A bright chicken fajita bowl with crispy rice, peppers, and extra heat.",
      ingredients: [{ name: "1 lb chicken" }, { name: "2 bell peppers" }, { name: "2 jalapeños" }, { name: "2 cups cooked rice" }],
      steps: [{ text: "Cook the chicken and peppers, then pile them over crispy rice with sliced jalapeños." }],
    },
  });

  assert.equal(result.passes, true);
  assert.equal(result.checks.centerpiece_match, true);
});

test("verifyRecipeAgainstBrief fails mismatched named dishes even when family is unknown", () => {
  const brief = compileCookingBrief({
    userMessage: "make mushroom risotto",
    recipeContext: {
      title: "Mushroom Risotto",
      ingredients: ["mushrooms", "arborio rice"],
      steps: ["Stir the risotto until creamy."],
    },
  });

  const result = verifyRecipeAgainstBrief({
    brief,
    recipe: {
      title: "Chicken Skillet with Mushrooms",
      description: "A savory chicken skillet with sauteed mushrooms.",
      ingredients: [{ name: "1 lb chicken" }, { name: "8 oz mushrooms" }],
      steps: [{ text: "Cook the chicken and mushrooms in a skillet." }],
    },
  });

  assert.equal(result.passes, false);
  assert.equal(result.checks.dish_family_match, false);
});

test("verifyRecipeAgainstBrief matches normalized required ingredients semantically", () => {
  const brief = compileCookingBrief({
    userMessage: "make garlic butter shrimp pasta",
    recipeContext: {
      title: "Garlic Butter Shrimp Pasta",
      ingredients: ["shrimp", "white beans"],
      steps: ["Cook the pasta and toss it with shrimp and white beans."],
    },
  });

  brief.ingredients.required = ["white beans", "shrimp"];
  brief.ingredients.centerpiece = "shrimp";
  brief.directives.must_have = ["pasta", "white beans", "shrimp"];

  const result = verifyRecipeAgainstBrief({
    brief,
    recipe: {
      title: "Quick Garlic Butter Shrimp Pasta with White Beans",
      description: "A quick pasta with shrimp, white beans, and garlic butter sauce.",
      ingredients: [
        { name: "12 oz linguine" },
        { name: "1 lb shrimp" },
        { name: "1 can canned white beans" },
        { name: "4 tbsp butter" },
      ],
      steps: [{ text: "Cook the pasta, saute the shrimp, and toss with canned white beans and butter." }],
    },
  });

  assert.equal(result.checks.required_ingredients_present, true);
  assert.equal(result.passes, true);
});

test("verifyRecipeAgainstBrief fails when an explicit air fryer request drifts to oven baking", () => {
  const brief = compileCookingBrief({
    userMessage: "Make crispy chicken in the air fryer",
    conversationHistory: [],
  });

  const result = verifyRecipeAgainstBrief({
    brief,
    recipe: {
      title: "Crispy Chicken",
      description: "A crispy chicken dinner.",
      ingredients: [{ name: "1 lb chicken" }],
      steps: [{ text: "Bake the chicken in the oven until crisp and golden." }],
    },
  });

  assert.equal(result.passes, false);
  assert.equal(result.checks.required_techniques_present, false);
  assert.equal(result.checks.equipment_limits_present, false);
});

test("verifyRecipeAgainstBrief fails when a locked session title and method drift even if the brief is lossy", () => {
  const brief = compileCookingBrief({
    userMessage: "Make banana bread pudding",
    conversationHistory: [],
  });

  const result = verifyRecipeAgainstBrief({
    brief,
    sessionState: createLockedSessionState(),
    recipe: {
      title: "Baked Banana Casserole",
      description: "A baked banana casserole finished in the oven.",
      ingredients: [{ name: "stale bread" }, { name: "milk" }, { name: "eggs" }],
      steps: [{ text: "Bake the banana casserole in the oven until set." }],
    },
  });

  assert.equal(result.passes, false);
  assert.equal(result.checks.selected_direction_match, false);
  assert.equal(result.checks.required_techniques_present, false);
  assert.equal(result.checks.equipment_limits_present, false);
  assert.ok(result.reasons.some((reason) => reason.includes("locked direction")));
});
