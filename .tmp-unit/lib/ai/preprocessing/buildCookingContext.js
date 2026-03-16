"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCookingContext = buildCookingContext;
const expandIngredients_1 = require("../flavorGraph/expandIngredients");
const techniqueDetector_1 = require("../chefEngine/techniqueDetector");
const substitutionDetector_1 = require("../substitutionEngine/substitutionDetector");
function buildCookingContext(ingredients) {
    const flavorExpansion = (0, expandIngredients_1.expandIngredients)(ingredients);
    const techniques = (0, techniqueDetector_1.detectTechniques)(ingredients);
    const substitutions = (0, substitutionDetector_1.detectSubstitutions)(ingredients);
    return `

Cooking Context:

Ingredients:
${ingredients.join(", ")}

Flavor Pairings:
${flavorExpansion.join(", ")}

Recommended Techniques:
${techniques.join(", ")}

Possible Substitutions:
${JSON.stringify(substitutions)}

`;
}
