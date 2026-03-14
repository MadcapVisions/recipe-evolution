"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const canonicalEnrichment_1 = require("../../lib/recipes/canonicalEnrichment");
(0, node_test_1.default)("deriveIngredientDetails parses quantity, unit, and prep from canonical ingredient text", () => {
    strict_1.default.deepEqual((0, canonicalEnrichment_1.deriveIngredientDetails)("1 1/2 cups onion, diced"), {
        name: "1 1/2 cups onion, diced",
        quantity: 1.5,
        unit: "cups",
        prep: "diced",
    });
});
(0, node_test_1.default)("deriveIngredientDetails leaves plain ingredient names simple", () => {
    strict_1.default.deepEqual((0, canonicalEnrichment_1.deriveIngredientDetails)("fresh basil"), {
        name: "fresh basil",
        quantity: null,
        unit: null,
        prep: null,
    });
});
(0, node_test_1.default)("deriveIngredientDetails handles unicode fractions and range quantities", () => {
    strict_1.default.deepEqual((0, canonicalEnrichment_1.deriveIngredientDetails)("1½ cups broth"), {
        name: "1½ cups broth",
        quantity: 1.5,
        unit: "cups",
        prep: null,
    });
    strict_1.default.deepEqual((0, canonicalEnrichment_1.deriveIngredientDetails)("2-3 tbsp olive oil"), {
        name: "2-3 tbsp olive oil",
        quantity: 2.5,
        unit: "tbsp",
        prep: null,
    });
});
(0, node_test_1.default)("deriveIngredientDetails keeps qualitative ingredients unquantified", () => {
    strict_1.default.deepEqual((0, canonicalEnrichment_1.deriveIngredientDetails)("salt to taste"), {
        name: "salt to taste",
        quantity: null,
        unit: null,
        prep: null,
    });
});
(0, node_test_1.default)("deriveStepDetails extracts timer information from canonical step text", () => {
    strict_1.default.deepEqual((0, canonicalEnrichment_1.deriveStepDetails)("Simmer for 12 minutes until thickened."), {
        text: "Simmer for 12 minutes until thickened.",
        timer_seconds: 720,
    });
});
(0, node_test_1.default)("buildCanonicalEnrichment creates enrichment payload from simple canonical recipe text", () => {
    strict_1.default.deepEqual((0, canonicalEnrichment_1.buildCanonicalEnrichment)({
        ingredientNames: ["2 tbsp olive oil", "1 onion, chopped"],
        stepTexts: ["Roast for 20 minutes.", "Serve warm."],
        preferredUnits: "metric",
    }), {
        ingredient_details: [
            { name: "2 tbsp olive oil", quantity: 2, unit: "tbsp", prep: null },
            { name: "1 onion, chopped", quantity: 1, unit: null, prep: "chopped" },
        ],
        step_details: [
            { text: "Roast for 20 minutes.", timer_seconds: 1200 },
            { text: "Serve warm.", timer_seconds: null },
        ],
        preferred_units: "metric",
    });
});
