"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectSubstitutions = detectSubstitutions;
const substitutionDatabase_1 = require("./substitutionDatabase");
function detectSubstitutions(ingredients) {
    const suggestions = [];
    ingredients.forEach((item) => {
        const key = item.trim().toLowerCase().replace(/\s+/g, "_");
        const replacements = substitutionDatabase_1.SUBSTITUTION_DATABASE[key];
        if (replacements) {
            suggestions.push({
                ingredient: item,
                options: replacements.slice(0, 3),
            });
        }
    });
    return suggestions;
}
