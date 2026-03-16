"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const topicGuard_1 = require("../../lib/ai/topicGuard");
(0, node_test_1.default)("allows clearly cooking-related home prompt", () => {
    const result = (0, topicGuard_1.guardCookingTopic)({
        message: "I need a quick lemon chicken dinner with a crisp side.",
    });
    strict_1.default.equal(result.allowed, true);
    strict_1.default.equal(result.reason, "cooking");
});
(0, node_test_1.default)("allows recipe-detail follow-up with recipe context", () => {
    const result = (0, topicGuard_1.guardCookingTopic)({
        message: "Make it spicier and a little faster.",
        recipeContext: {
            title: "Turkey Chili",
            ingredients: ["ground turkey", "beans", "cumin"],
            steps: ["Brown the turkey", "Simmer the chili"],
        },
    });
    strict_1.default.equal(result.allowed, true);
    strict_1.default.equal(result.reason, "recipe_context");
});
(0, node_test_1.default)("blocks obvious general chat", () => {
    const result = (0, topicGuard_1.guardCookingTopic)({
        message: "Can you help me write a React component and fix a TypeScript error?",
    });
    strict_1.default.equal(result.allowed, false);
    strict_1.default.equal(result.reason, "off_topic");
});
(0, node_test_1.default)("blocks finance request even when phrased conversationally", () => {
    const result = (0, topicGuard_1.guardCookingTopic)({
        message: "What stocks should I buy this month?",
    });
    strict_1.default.equal(result.allowed, false);
    strict_1.default.equal(result.reason, "off_topic");
});
(0, node_test_1.default)("scope message points users back to cooking topics", () => {
    strict_1.default.match(topicGuard_1.COOKING_SCOPE_MESSAGE, /cooking-focused requests only/i);
    strict_1.default.match(topicGuard_1.COOKING_SCOPE_MESSAGE, /ingredients/i);
});
