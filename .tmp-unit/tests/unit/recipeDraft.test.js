"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const recipeDraft_1 = require("../../lib/recipes/recipeDraft");
(0, node_test_1.default)("parseIngredientLines trims lines and drops blanks", () => {
    const parsed = (0, recipeDraft_1.parseIngredientLines)(" 1 lb chicken \n\n 2 lemons \n   ");
    strict_1.default.deepEqual(parsed, [{ name: "1 lb chicken" }, { name: "2 lemons" }]);
});
(0, node_test_1.default)("parseIngredientLines returns an empty list for blank input", () => {
    strict_1.default.deepEqual((0, recipeDraft_1.parseIngredientLines)(" \n \n "), []);
});
(0, node_test_1.default)("ingredientLineHasAmount requires an explicit amount", () => {
    strict_1.default.equal((0, recipeDraft_1.ingredientLineHasAmount)("2 tbsp olive oil"), true);
    strict_1.default.equal((0, recipeDraft_1.ingredientLineHasAmount)("1 onion"), true);
    strict_1.default.equal((0, recipeDraft_1.ingredientLineHasAmount)("olive oil"), false);
    strict_1.default.equal((0, recipeDraft_1.ingredientLineHasAmount)("broth"), false);
});
(0, node_test_1.default)("formatIngredientLine builds a shopping-ready ingredient line", () => {
    strict_1.default.equal((0, recipeDraft_1.formatIngredientLine)({ quantity: 2, unit: "tbsp", name: "olive oil" }), "2 tbsp olive oil");
    strict_1.default.equal((0, recipeDraft_1.formatIngredientLine)({ quantity: 1, name: "onion", prep: "diced" }), "1 onion diced");
});
(0, node_test_1.default)("coerceIngredientLineWithAmount adds amounts to common AI ingredient fragments", () => {
    strict_1.default.equal((0, recipeDraft_1.coerceIngredientLineWithAmount)("olive oil"), "2 tbsp olive oil");
    strict_1.default.equal((0, recipeDraft_1.coerceIngredientLineWithAmount)("garlic"), "2 cloves garlic, minced");
    strict_1.default.equal((0, recipeDraft_1.coerceIngredientLineWithAmount)("zucchini"), "2 medium zucchini, sliced");
    strict_1.default.equal((0, recipeDraft_1.coerceIngredientLineWithAmount)("salt to taste"), "1 tsp salt");
});
(0, node_test_1.default)("repairRecipeDraftIngredientLines converts bare ingredient names into measured lines", () => {
    strict_1.default.deepEqual((0, recipeDraft_1.repairRecipeDraftIngredientLines)([{ name: "turkey breast" }, { name: "rice" }, { name: "black pepper" }]), [
        { name: "1 lb turkey breast" },
        { name: "1 cup rice" },
        { name: "1/2 tsp black pepper" },
    ]);
});
(0, node_test_1.default)("parseStepLines trims lines and drops blanks", () => {
    const parsed = (0, recipeDraft_1.parseStepLines)(" Preheat oven \n\n Roast for 20 minutes \n");
    strict_1.default.deepEqual(parsed, [{ text: "Preheat oven" }, { text: "Roast for 20 minutes" }]);
});
(0, node_test_1.default)("parseStepLines preserves step ordering", () => {
    const parsed = (0, recipeDraft_1.parseStepLines)("Step one\nStep two\nStep three");
    strict_1.default.deepEqual(parsed.map((step) => step.text), ["Step one", "Step two", "Step three"]);
});
(0, node_test_1.default)("normalizeRecipeDraft trims values and strips extra ingredient and step fields", () => {
    const draft = (0, recipeDraft_1.normalizeRecipeDraft)({
        title: "  Lemon Pasta  ",
        description: "  Bright and quick  ",
        tags: [" dinner ", "pasta", "dinner"],
        servings: 2,
        prep_time_min: 10,
        cook_time_min: 15,
        difficulty: " easy ",
        ingredients: [
            { name: " 200g spaghetti ", quantity: 200, unit: "g" },
            { name: " 1 lemon " },
        ],
        steps: [
            { text: " Boil pasta ", timer_seconds: 600 },
            { text: " Toss with lemon " },
        ],
        notes: "  Best fresh  ",
        change_log: "  Initial version  ",
        ai_metadata_json: { source: "test" },
    });
    strict_1.default.deepEqual(draft, {
        title: "Lemon Pasta",
        description: "Bright and quick",
        tags: ["dinner", "pasta"],
        servings: 2,
        prep_time_min: 10,
        cook_time_min: 15,
        difficulty: "easy",
        ingredients: [{ name: "200g spaghetti" }, { name: "1 lemon" }],
        steps: [{ text: "Boil pasta" }, { text: "Toss with lemon" }],
        notes: "Best fresh",
        change_log: "Initial version",
        ai_metadata_json: { source: "test" },
    });
});
(0, node_test_1.default)("normalizeRecipeDraft rejects missing ingredients", () => {
    strict_1.default.throws(() => (0, recipeDraft_1.normalizeRecipeDraft)({
        title: "Soup",
        description: null,
        tags: null,
        servings: null,
        prep_time_min: null,
        cook_time_min: null,
        difficulty: null,
        ingredients: [],
        steps: [{ text: "Heat" }],
    }), /At least one ingredient is required/);
});
(0, node_test_1.default)("normalizeRecipeDraft rejects ingredients without amounts", () => {
    strict_1.default.throws(() => (0, recipeDraft_1.normalizeRecipeDraft)({
        title: "Soup",
        description: null,
        tags: null,
        servings: null,
        prep_time_min: null,
        cook_time_min: null,
        difficulty: null,
        ingredients: [{ name: "broth" }],
        steps: [{ text: "Heat" }],
    }), /Each ingredient needs a quantity/);
});
(0, node_test_1.default)("normalizeRecipeVersionPayload trims values and strips extra fields", () => {
    const payload = (0, recipeDraft_1.normalizeRecipeVersionPayload)({
        version_label: "  V2  ",
        change_summary: "  Better texture  ",
        servings: 4,
        prep_time_min: 5,
        cook_time_min: 20,
        difficulty: " medium ",
        ingredients: [{ name: " 2 onions ", prep: "diced" }],
        steps: [{ text: " Roast onions ", timer_seconds: 1200 }],
        notes: "  Add salt at the end  ",
        change_log: "  Roasted the onions first  ",
        ai_metadata_json: { cached: true },
    });
    strict_1.default.deepEqual(payload, {
        version_label: "V2",
        change_summary: "Better texture",
        servings: 4,
        prep_time_min: 5,
        cook_time_min: 20,
        difficulty: "medium",
        ingredients: [{ name: "2 onions" }],
        steps: [{ text: "Roast onions" }],
        notes: "Add salt at the end",
        change_log: "Roasted the onions first",
        ai_metadata_json: { cached: true },
        sessionSeed: null,
    });
});
