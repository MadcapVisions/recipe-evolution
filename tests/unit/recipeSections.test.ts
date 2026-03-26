import test from "node:test";
import assert from "node:assert/strict";
import { assembleRecipeDraftFromSections, buildGeneratedRecipeFromSectionPayloads, buildRecipeSections } from "../../lib/ai/recipeSections";

test("buildRecipeSections keeps generated recipe content but falls back to outline summary and tips when needed", () => {
  const sections = buildRecipeSections({
    recipe: {
      title: "Pineapple Chicken Tacos",
      description: null,
      servings: null,
      prep_time_min: null,
      cook_time_min: null,
      difficulty: null,
      ingredients: [
        { name: "chicken thighs" },
        { name: "2 cups pineapple salsa" },
      ],
      steps: [
        { text: "Cook the chicken until lightly charred." },
        { text: "Serve in tortillas with the salsa." },
      ],
      chefTips: [],
    },
    outline: {
      title: "Pineapple Chicken Tacos",
      summary: "Smoky chicken tacos with bright pineapple heat.",
      dish_family: "tacos",
      primary_ingredient: "chicken",
      ingredient_groups: [{ name: "Main", items: ["chicken", "pineapple", "tortillas"] }],
      step_outline: ["Cook the chicken", "Assemble the tacos"],
      chef_tip_topics: ["char the pineapple for deeper sweetness", "rest the chicken before slicing"],
    },
  });

  assert.equal(sections.header.description, "Smoky chicken tacos with bright pineapple heat.");
  assert.equal(sections.header.servings, 4);
  assert.equal(sections.header.prep_time_min, 15);
  assert.equal(sections.header.cook_time_min, 30);
  assert.equal(sections.header.difficulty, "Easy");
  assert.deepEqual(sections.ingredients, ["1 lb chicken thighs", "2 cups pineapple salsa"]);
  assert.deepEqual(sections.tips, [
    "Char the pineapple for deeper sweetness.",
    "Rest the chicken before slicing.",
  ]);
});

test("assembleRecipeDraftFromSections deterministically builds the final recipe draft", () => {
  const draft = assembleRecipeDraftFromSections({
    sections: {
      header: {
        title: "Pineapple Chicken Tacos",
        description: "Sweet-spicy chicken tacos.",
        servings: 4,
        prep_time_min: 20,
        cook_time_min: 15,
        difficulty: "Intermediate",
      },
      ingredients: ["1 lb chicken thighs", "8 tortillas"],
      steps: ["Cook the chicken.", "Serve in warm tortillas."],
      tips: ["Warm the tortillas before serving.", "Finish with lime for brightness."],
    },
    ai_metadata_json: { outline_source: "ai" },
  });

  assert.equal(draft.title, "Pineapple Chicken Tacos");
  assert.deepEqual(draft.ingredients, [{ name: "1 lb chicken thighs" }, { name: "8 tortillas" }]);
  assert.deepEqual(draft.steps, [{ text: "Cook the chicken." }, { text: "Serve in warm tortillas." }]);
  assert.equal(draft.notes, "• Warm the tortillas before serving.\n• Finish with lime for brightness.");
  assert.deepEqual(draft.ai_metadata_json, { outline_source: "ai" });
});

test("buildGeneratedRecipeFromSectionPayloads combines typed section payloads into a coherent recipe", () => {
  const recipe = buildGeneratedRecipeFromSectionPayloads({
    title: "Pineapple Chicken Tacos",
    outline: {
      title: "Pineapple Chicken Tacos",
      summary: "Bright chicken tacos with pineapple heat.",
      dish_family: "tacos",
      primary_ingredient: "chicken",
      ingredient_groups: [{ name: "Main", items: ["chicken", "pineapple", "tortillas"] }],
      step_outline: ["Cook the chicken", "Assemble the tacos"],
      chef_tip_topics: ["char the pineapple lightly"],
    },
    ingredientSection: {
      servings: 4,
      prep_time_min: 20,
      cook_time_min: 15,
      difficulty: "intermediate",
      ingredients: [
        { name: "chicken thighs", quantity: 1.5, unit: "lb", prep: null },
        { name: "pineapple", quantity: 2, unit: "cups", prep: "diced" },
      ],
    },
    instructionSection: {
      description: null,
      steps: [
        { text: "Cook the chicken until lightly charred." },
        { text: "Serve in tortillas with the pineapple." },
      ],
      chefTips: [],
    },
  });

  assert.equal(recipe.title, "Pineapple Chicken Tacos");
  assert.equal(recipe.description, "Bright chicken tacos with pineapple heat.");
  assert.equal(recipe.difficulty, "Intermediate");
  assert.deepEqual(recipe.ingredients, [{ name: "1.5 lb chicken thighs" }, { name: "2 cups pineapple diced" }]);
  assert.deepEqual(recipe.steps, [
    { text: "Cook the chicken until lightly charred.", methodTag: null },
    { text: "Serve in tortillas with the pineapple.", methodTag: null },
  ]);
  assert.deepEqual(recipe.chefTips, ["Char the pineapple lightly."]);
});
