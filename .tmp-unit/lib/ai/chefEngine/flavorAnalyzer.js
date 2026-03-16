"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeFlavor = analyzeFlavor;
const ingredientPairings_1 = require("./ingredientPairings");
function analyzeFlavor(ingredients) {
    const suggestions = [];
    ingredients.forEach((ingredient) => {
        const key = ingredient.trim().toLowerCase();
        const pairings = ingredientPairings_1.INGREDIENT_PAIRINGS[key];
        if (pairings) {
            suggestions.push(`Try pairing ${ingredient} with ${pairings.slice(0, 3).join(", ")}`);
        }
    });
    return suggestions;
}
