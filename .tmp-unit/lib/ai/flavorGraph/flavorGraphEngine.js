"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFlavorContext = generateFlavorContext;
const expandIngredients_1 = require("./expandIngredients");
function generateFlavorContext(ingredients) {
    const expanded = (0, expandIngredients_1.expandIngredients)(ingredients);
    return `

Flavor Pairing Suggestions:

${expanded.join(", ")}

Use these ingredients to improve flavor combinations.

`;
}
