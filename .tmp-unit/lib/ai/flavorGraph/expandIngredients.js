"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expandIngredients = expandIngredients;
const flavorGraphData_1 = require("./flavorGraphData");
function expandIngredients(ingredients) {
    const expansions = [];
    ingredients.forEach((i) => {
        const key = i.trim().toLowerCase();
        const related = flavorGraphData_1.FLAVOR_GRAPH[key];
        if (related) {
            expansions.push(...related);
        }
    });
    return [...new Set(expansions)];
}
