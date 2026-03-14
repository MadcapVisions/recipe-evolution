"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const groceryPlanning_1 = require("../../lib/recipes/groceryPlanning");
(0, node_test_1.default)("classifyGroceryAisle assigns common ingredients to useful aisles", () => {
    strict_1.default.equal((0, groceryPlanning_1.classifyGroceryAisle)("yellow onion"), "Produce");
    strict_1.default.equal((0, groceryPlanning_1.classifyGroceryAisle)("olive oil"), "Spices & Oils");
    strict_1.default.equal((0, groceryPlanning_1.classifyGroceryAisle)("chicken thighs"), "Meat & Seafood");
});
(0, node_test_1.default)("buildGroceryPlan separates pantry staples from needed items and groups by aisle", () => {
    const result = (0, groceryPlanning_1.buildGroceryPlan)([
        { id: "1", name: "olive oil", normalized_name: "olive oil", quantity: 2, unit: "tbsp", prep: null, checked: false },
        { id: "2", name: "yellow onion", normalized_name: "yellow onion", quantity: 1, unit: null, prep: null, checked: false },
        { id: "3", name: "chicken thighs", normalized_name: "chicken thighs", quantity: 1, unit: "lb", prep: null, checked: false },
    ], ["olive oil"]);
    strict_1.default.equal(result.pantryItems.length, 1);
    strict_1.default.equal(result.pantryItems[0]?.name, "olive oil");
    strict_1.default.deepEqual(result.groupedItems.map((group) => group.aisle), ["Meat & Seafood", "Produce"]);
});
(0, node_test_1.default)("buildGroceryPlan matches pantry staples through normalized ingredient names and consolidates convertible units", () => {
    const result = (0, groceryPlanning_1.buildGroceryPlan)([
        { id: "1", name: "fresh basil", normalized_name: "fresh basil", quantity: 1, unit: "cup", prep: null, checked: false },
        { id: "2", name: "basil leaves", normalized_name: "basil leaves", quantity: 2, unit: "cups", prep: null, checked: false },
        { id: "3", name: "extra virgin olive oil", normalized_name: "extra virgin olive oil", quantity: 2, unit: "tablespoons", prep: null, checked: false },
    ], ["basil", "olive oil"]);
    strict_1.default.equal(result.pantryItems.length, 3);
    strict_1.default.equal(result.groupedItems.length, 0);
});
