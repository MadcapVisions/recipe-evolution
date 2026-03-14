"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const servings_1 = require("../../lib/recipes/servings");
(0, node_test_1.default)("scaleQuantityForServings scales ingredient quantities proportionally", () => {
    strict_1.default.equal((0, servings_1.scaleQuantityForServings)(2, 4, 6), 3);
    strict_1.default.equal((0, servings_1.scaleQuantityForServings)(1.5, 4, 2), 0.75);
});
(0, node_test_1.default)("formatScaledQuantity trims trailing zeros for display", () => {
    strict_1.default.equal((0, servings_1.formatScaledQuantity)(2), "2");
    strict_1.default.equal((0, servings_1.formatScaledQuantity)(1.5), "1.5");
    strict_1.default.equal((0, servings_1.formatScaledQuantity)(0.75), "0.75");
});
(0, node_test_1.default)("scaleCanonicalIngredientLine rewrites the displayed quantity while preserving the ingredient text", () => {
    strict_1.default.equal((0, servings_1.scaleCanonicalIngredientLine)("2 tbsp olive oil", 4, 6), "3 tbsp olive oil");
    strict_1.default.equal((0, servings_1.scaleCanonicalIngredientLine)("1 onion, chopped", 2, 4), "2 onion, chopped");
    strict_1.default.equal((0, servings_1.scaleCanonicalIngredientLine)("fresh basil", 2, 4), "fresh basil");
});
(0, node_test_1.default)("scaleGroceryItemsForServings adjusts quantities without changing checked state", () => {
    strict_1.default.deepEqual((0, servings_1.scaleGroceryItemsForServings)([
        {
            id: "1",
            name: "olive oil",
            normalized_name: "olive oil",
            quantity: 2,
            unit: "tbsp",
            prep: null,
            checked: true,
        },
    ], 4, 8), [
        {
            id: "1",
            name: "olive oil",
            normalized_name: "olive oil",
            quantity: 4,
            unit: "tbsp",
            prep: null,
            checked: true,
        },
    ]);
});
(0, node_test_1.default)("formatGroceryItemDisplay avoids duplicating parsed quantity and unit", () => {
    strict_1.default.deepEqual((0, servings_1.formatGroceryItemDisplay)({ name: "24 oz bread", quantity: 24, unit: "oz" }), {
        primary: "24 oz bread",
        secondary: null,
    });
    strict_1.default.deepEqual((0, servings_1.formatGroceryItemDisplay)({ name: "3 cups onion", quantity: 3, unit: "cup" }), {
        primary: "3 cups onion",
        secondary: null,
    });
});
(0, node_test_1.default)("formatGroceryItemDisplay flags items with no parsed amount", () => {
    strict_1.default.deepEqual((0, servings_1.formatGroceryItemDisplay)({ name: "broth", quantity: null, unit: null }), {
        primary: "Broth",
        secondary: null,
    });
});
(0, node_test_1.default)("formatGroceryItemDisplay normalizes leading capitalization", () => {
    strict_1.default.deepEqual((0, servings_1.formatGroceryItemDisplay)({ name: "quick-pickled shallots", quantity: null, unit: null }), {
        primary: "Quick-pickled shallots",
        secondary: null,
    });
});
