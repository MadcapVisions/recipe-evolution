import test from "node:test";
import assert from "node:assert/strict";
import { buildGroceryPlan, classifyGroceryAisle } from "../../lib/recipes/groceryPlanning";

test("classifyGroceryAisle assigns common ingredients to useful aisles", () => {
  assert.equal(classifyGroceryAisle("yellow onion"), "Produce");
  assert.equal(classifyGroceryAisle("olive oil"), "Spices & Oils");
  assert.equal(classifyGroceryAisle("chicken thighs"), "Meat & Seafood");
});

test("buildGroceryPlan separates pantry staples from needed items and groups by aisle", () => {
  const result = buildGroceryPlan(
    [
      { id: "1", name: "olive oil", normalized_name: "olive oil", quantity: 2, unit: "tbsp", prep: null, checked: false },
      { id: "2", name: "yellow onion", normalized_name: "yellow onion", quantity: 1, unit: null, prep: null, checked: false },
      { id: "3", name: "chicken thighs", normalized_name: "chicken thighs", quantity: 1, unit: "lb", prep: null, checked: false },
    ],
    ["olive oil"]
  );

  assert.equal(result.pantryItems.length, 1);
  assert.equal(result.pantryItems[0]?.name, "olive oil");
  assert.deepEqual(
    result.groupedItems.map((group) => group.aisle),
    ["Meat & Seafood", "Produce"]
  );
});

test("buildGroceryPlan matches pantry staples through normalized ingredient names and consolidates convertible units", () => {
  const result = buildGroceryPlan(
    [
      { id: "1", name: "fresh basil", normalized_name: "fresh basil", quantity: 1, unit: "cup", prep: null, checked: false },
      { id: "2", name: "basil leaves", normalized_name: "basil leaves", quantity: 2, unit: "cups", prep: null, checked: false },
      { id: "3", name: "extra virgin olive oil", normalized_name: "extra virgin olive oil", quantity: 2, unit: "tablespoons", prep: null, checked: false },
    ],
    ["basil", "olive oil"]
  );

  assert.equal(result.pantryItems.length, 3);
  assert.equal(result.groupedItems.length, 0);
});
