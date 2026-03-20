"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEED_RECIPE_EVAL_CASES = void 0;
exports.buildSeedEvalContext = buildSeedEvalContext;
exports.evaluateSeedDishFamily = evaluateSeedDishFamily;
const homeRecipeAlignment_1 = require("../homeRecipeAlignment");
exports.SEED_RECIPE_EVAL_CASES = [
    {
        id: "focaccia-pizza",
        label: "Focaccia pizza request",
        tier: "baseline",
        prompt: "I want focaccia pizza",
        conversation: "User: I want focaccia pizza with tomato sauce, mozzarella, and crisp edges.",
        expected: {
            dishFamily: "pizza",
            normalizedNameHint: "focaccia pizza",
        },
    },
    {
        id: "traditional-carbonara",
        label: "Traditional carbonara",
        tier: "baseline",
        prompt: "I want traditional spaghetti carbonara, no cream",
        conversation: "User: I want traditional spaghetti carbonara, no cream.",
        expected: {
            dishFamily: "pasta",
            normalizedNameHint: "spaghetti carbonara",
        },
    },
    {
        id: "chicken-ravioli-sauce",
        label: "Chicken-filled ravioli sauce idea",
        tier: "baseline",
        prompt: "I have chicken-filled ravioli, give me a sauce idea",
        conversation: "User: I have chicken-filled ravioli and want a sauce idea that fits it.",
        expected: {
            dishFamily: null,
            normalizedNameHint: "ravioli",
        },
    },
    {
        id: "salata-de-vinete",
        label: "Delicate salata de vinete",
        tier: "baseline",
        prompt: "Make a delicate Romanian salata de vinete with olive oil",
        conversation: "User: Make a delicate Romanian salata de vinete with olive oil.",
        expected: {
            dishFamily: "dip",
            normalizedNameHint: "salata de vinete",
        },
    },
    {
        id: "tacos-not-bowl",
        label: "Tacos not a bowl",
        tier: "baseline",
        prompt: "I want tacos, not a bowl",
        conversation: "User: I want tacos, not a bowl.",
        expected: {
            dishFamily: "tacos",
            normalizedNameHint: "tacos",
        },
    },
    {
        id: "vegetarian-same-pasta-shape",
        label: "Vegetarian same pasta shape",
        tier: "baseline",
        prompt: "Make it vegetarian but keep the same pasta shape",
        conversation: "User: Make it vegetarian but keep the same pasta shape.",
        expected: {
            dishFamily: "pasta",
            normalizedNameHint: "pasta",
        },
    },
    {
        id: "crispy-flatbread-pizza",
        label: "Crispy flatbread-style pizza",
        tier: "baseline",
        prompt: "I want a crispy flatbread-style pizza with mushrooms",
        conversation: "User: I want a crispy flatbread-style pizza with mushrooms.",
        expected: {
            dishFamily: "pizza",
            normalizedNameHint: "flatbread pizza",
        },
    },
    {
        id: "high-protein-dinner-30-min",
        label: "High-protein dinner with exclusions",
        tier: "baseline",
        prompt: "No onions, no garlic, high-protein dinner in 30 minutes",
        conversation: "User: No onions, no garlic, high-protein dinner in 30 minutes.",
        expected: {
            dishFamily: null,
            normalizedNameHint: "high-protein dinner",
        },
    },
    {
        id: "okonomiyaki",
        label: "Okonomiyaki",
        tier: "exploratory",
        prompt: "I want Osaka-style okonomiyaki with cabbage and pork belly",
        conversation: "User: I want Osaka-style okonomiyaki with cabbage and pork belly.",
        expected: {
            dishFamily: null,
            normalizedNameHint: "okonomiyaki",
        },
    },
    {
        id: "khachapuri",
        label: "Adjarian khachapuri",
        tier: "exploratory",
        prompt: "Make adjarian khachapuri with a runny egg center",
        conversation: "User: Make adjarian khachapuri with a runny egg center.",
        expected: {
            dishFamily: null,
            normalizedNameHint: "khachapuri",
        },
    },
    {
        id: "socca",
        label: "Socca",
        tier: "exploratory",
        prompt: "I want socca with lots of black pepper and olive oil",
        conversation: "User: I want socca with lots of black pepper and olive oil.",
        expected: {
            dishFamily: null,
            normalizedNameHint: "socca",
        },
    },
    {
        id: "pupusas",
        label: "Pupusas",
        tier: "exploratory",
        prompt: "I want pupusas revueltas with curtido",
        conversation: "User: I want pupusas revueltas with curtido.",
        expected: {
            dishFamily: null,
            normalizedNameHint: "pupusas",
        },
    },
    {
        id: "dosa",
        label: "Masala dosa",
        tier: "exploratory",
        prompt: "I want a masala dosa with crisp edges and potato filling",
        conversation: "User: I want a masala dosa with crisp edges and potato filling.",
        expected: {
            dishFamily: null,
            normalizedNameHint: "dosa",
        },
    },
    {
        id: "gozleme",
        label: "Gozleme",
        tier: "exploratory",
        prompt: "Make gozleme stuffed with spinach and feta",
        conversation: "User: Make gozleme stuffed with spinach and feta.",
        expected: {
            dishFamily: null,
            normalizedNameHint: "gozleme",
        },
    },
    {
        id: "injera-platter",
        label: "Injera platter",
        tier: "exploratory",
        prompt: "I want injera with misir wot and gomen",
        conversation: "User: I want injera with misir wot and gomen.",
        expected: {
            dishFamily: null,
            normalizedNameHint: "injera",
        },
    },
    {
        id: "congee-century-egg",
        label: "Century egg congee",
        tier: "exploratory",
        prompt: "Make century egg and pork congee",
        conversation: "User: Make century egg and pork congee.",
        expected: {
            dishFamily: null,
            normalizedNameHint: "congee",
        },
    },
    {
        id: "manti-yogurt",
        label: "Manti with yogurt sauce",
        tier: "exploratory",
        prompt: "I want Turkish manti with garlicky yogurt and chili butter",
        conversation: "User: I want Turkish manti with garlicky yogurt and chili butter.",
        expected: {
            dishFamily: null,
            normalizedNameHint: "manti",
        },
    },
    {
        id: "moqueca",
        label: "Brazilian moqueca",
        tier: "exploratory",
        prompt: "Make Brazilian moqueca with coconut milk and fish",
        conversation: "User: Make Brazilian moqueca with coconut milk and fish.",
        expected: {
            dishFamily: "soup",
            normalizedNameHint: "moqueca",
        },
    },
];
function buildSeedEvalContext(testCase) {
    return `${testCase.prompt}\n${testCase.conversation}`.trim();
}
function evaluateSeedDishFamily(testCase) {
    return (0, homeRecipeAlignment_1.detectRequestedDishFamily)(buildSeedEvalContext(testCase));
}
