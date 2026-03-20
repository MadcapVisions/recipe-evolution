"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const recipeResult_1 = require("../../lib/ai/recipeResult");
(0, node_test_1.default)("createAiRecipeResult normalizes recipe payload and metadata", () => {
    const result = (0, recipeResult_1.createAiRecipeResult)({
        purpose: "home_recipe",
        source: "ai",
        provider: "openai",
        model: "gpt-test",
        inputHash: "abc123",
        createdAt: "2026-03-14T12:00:00.000Z",
        recipe: {
            title: "  Lemon Rice Bowl ",
            description: " bright and fast ",
            tags: [" dinner ", "quick"],
            servings: 4,
            prep_time_min: 15,
            cook_time_min: 20,
            difficulty: " easy ",
            ingredients: [{ name: " 1 lemon " }],
            steps: [{ text: " Cook the rice " }],
        },
    });
    strict_1.default.deepEqual(result, {
        recipe: {
            title: "Lemon Rice Bowl",
            description: "bright and fast",
            tags: ["dinner", "quick"],
            servings: 4,
            prep_time_min: 15,
            cook_time_min: 20,
            difficulty: "easy",
            ingredients: [{ name: "1 lemon" }],
            steps: [{ text: "Cook the rice" }],
            notes: null,
            change_log: null,
            ai_metadata_json: null,
        },
        explanation: null,
        meta: {
            purpose: "home_recipe",
            source: "ai",
            provider: "openai",
            model: "gpt-test",
            cached: false,
            input_hash: "abc123",
            created_at: "2026-03-14T12:00:00.000Z",
            input_tokens: null,
            output_tokens: null,
            estimated_cost_usd: null,
        },
    });
});
(0, node_test_1.default)("parseAiRecipeResult reads a stored envelope payload", () => {
    const parsed = (0, recipeResult_1.parseAiRecipeResult)({
        recipe: {
            title: " Tomato Soup ",
            description: " cozy ",
            tags: null,
            servings: 2,
            prep_time_min: 10,
            cook_time_min: 30,
            difficulty: " easy ",
            ingredients: [{ name: " 2 tomatoes " }],
            steps: [{ text: " simmer " }],
        },
        explanation: " smoother texture ",
        meta: {
            purpose: "refine",
            source: "cache",
            provider: "gemini",
            model: "gemini-test",
            cached: true,
            input_hash: "hash-1",
            created_at: "2026-03-14T12:00:00.000Z",
        },
    });
    strict_1.default.deepEqual(parsed, {
        recipe: {
            title: "Tomato Soup",
            description: "cozy",
            tags: null,
            servings: 2,
            prep_time_min: 10,
            cook_time_min: 30,
            difficulty: "easy",
            ingredients: [{ name: "2 tomatoes" }],
            steps: [{ text: "simmer" }],
            notes: null,
            change_log: null,
            ai_metadata_json: null,
        },
        explanation: "smoother texture",
        meta: {
            purpose: "refine",
            source: "cache",
            provider: "gemini",
            model: "gemini-test",
            cached: true,
            input_hash: "hash-1",
            created_at: "2026-03-14T12:00:00.000Z",
            input_tokens: null,
            output_tokens: null,
            estimated_cost_usd: null,
        },
    });
});
