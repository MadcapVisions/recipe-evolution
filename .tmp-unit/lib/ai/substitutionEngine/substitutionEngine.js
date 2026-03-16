"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSubstitutionContext = generateSubstitutionContext;
const substitutionDetector_1 = require("./substitutionDetector");
function generateSubstitutionContext(ingredients) {
    const substitutions = (0, substitutionDetector_1.detectSubstitutions)(ingredients);
    if (!substitutions.length) {
        return "";
    }
    let text = "Ingredient Substitution Options:\n";
    substitutions.forEach((s) => {
        text += `
${s.ingredient} can be replaced with:
${s.options.join(", ")}
`;
    });
    return text;
}
