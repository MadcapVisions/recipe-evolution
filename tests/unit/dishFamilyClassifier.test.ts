// tests/unit/dishFamilyClassifier.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyDishFamilyHeuristic,
} from "../../lib/ai/intent/dishFamilyClassifier";

test("classifyDishFamilyHeuristic: 'Peanut Butter 100 Grand Bars' does not classify as beverage", () => {
  const result = classifyDishFamilyHeuristic({
    dishName: "Peanut Butter 100 Grand Bars",
    userMessage: "Make Peanut Butter 100 Grand Bars",
  });
  assert.notEqual(result.family, "beverage");
  assert.notEqual(result.family, "preserve");
  assert.notEqual(result.family, "sauce_condiment");
});

test("classifyDishFamilyHeuristic: 'Peanut Butter 100 Grand Bars' returns candy_confection or null", () => {
  const result = classifyDishFamilyHeuristic({
    dishName: "Peanut Butter 100 Grand Bars",
    userMessage: "Make Peanut Butter 100 Grand Bars",
  });
  assert.ok(
    result.family === "candy_confection" || result.family === null,
    `Expected candy_confection or null, got: ${result.family}`
  );
});

test("classifyDishFamilyHeuristic: 'Garlic Cheddar Sourdough' returns bread family", () => {
  const result = classifyDishFamilyHeuristic({
    dishName: "Garlic Cheddar Sourdough",
    userMessage: "I want to bake a garlic cheddar sourdough loaf",
  });
  assert.equal(result.family, "bread");
});

test("classifyDishFamilyHeuristic: unknown creative name returns null with low confidence", () => {
  const result = classifyDishFamilyHeuristic({
    dishName: "Xzyphon Dream Plate",
    userMessage: "Make a Xzyphon Dream Plate",
  });
  assert.equal(result.family, null);
  assert.ok(result.confidence <= 0.5, `Expected low confidence, got: ${result.confidence}`);
});

test("classifyDishFamilyHeuristic: forbidden bucket from advisory heuristic returns null", () => {
  const result = classifyDishFamilyHeuristic({
    dishName: "Something Preserve",
    userMessage: "Make a fruit jam preserve",
  });
  assert.notEqual(result.family, "preserve");
});

test("classifyDishFamilyHeuristic: currentFamily is trusted when valid and not a forbidden bucket", () => {
  const result = classifyDishFamilyHeuristic({
    dishName: "Pasta Something",
    userMessage: "pasta dish",
    currentFamily: "pasta",
  });
  assert.equal(result.family, "pasta");
  assert.equal(result.source, "unchanged");
});

test("classifyDishFamilyHeuristic: currentFamily as forbidden bucket is not trusted", () => {
  const result = classifyDishFamilyHeuristic({
    dishName: "Some dish",
    userMessage: "make something",
    currentFamily: "beverage",
  });
  assert.notEqual(result.family, "beverage");
});

test("classifyDishFamilyHeuristic: result always includes confidence and reasoning", () => {
  const result = classifyDishFamilyHeuristic({
    dishName: "Chicken Tacos",
    userMessage: "chicken tacos",
  });
  assert.equal(typeof result.confidence, "number");
  assert.ok(result.confidence >= 0 && result.confidence <= 1);
  assert.equal(typeof result.reasoning, "string");
  assert.ok(result.reasoning.length > 0);
});
