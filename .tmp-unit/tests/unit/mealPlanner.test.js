"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const mealPlanner_1 = require("../../lib/recipes/mealPlanner");
(0, node_test_1.default)("buildMealPlan combines grocery needs and prep plans across multiple recipes", () => {
    const result = (0, mealPlanner_1.buildMealPlan)([
        {
            recipeId: "r1",
            recipeTitle: "Pasta",
            versionId: "v1",
            versionLabel: "Original",
            servings: 2,
            targetServings: 2,
            ingredients: [{ name: "1 tbsp olive oil" }, { name: "1 onion, chopped" }],
            steps: [{ text: "Saute onion for 10 minutes." }],
        },
        {
            recipeId: "r2",
            recipeTitle: "Soup",
            versionId: "v2",
            versionLabel: "Original",
            servings: 4,
            targetServings: 4,
            ingredients: [{ name: "3 tsp olive oil" }, { name: "2 carrots, diced" }],
            steps: [{ text: "Simmer carrots for 20 minutes." }],
        },
    ], []);
    strict_1.default.equal(result.recipeCount, 2);
    strict_1.default.equal(result.prepPlans.length, 2);
    const oil = result.groceryPlan.groupedItems.flatMap((group) => group.items).find((item) => item.normalized_name.includes("olive oil"));
    strict_1.default.equal(oil?.quantity, 2);
    strict_1.default.equal(oil?.unit, "tbsp");
});
