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
(0, node_test_1.default)("allows pantry ingredient list prompts", () => {
    const result = (0, topicGuard_1.guardCookingTopic)({
        message: "eggs, spinach, feta, potatoes",
    });
    strict_1.default.equal(result.allowed, true);
    strict_1.default.equal(result.reason, "cooking");
});
(0, node_test_1.default)("allows meal prep planning prompts", () => {
    const result = (0, topicGuard_1.guardCookingTopic)({
        message: "What should I meal prep on Sunday for 3 lunches this week?",
    });
    strict_1.default.equal(result.allowed, true);
    strict_1.default.equal(result.reason, "cooking");
});
(0, node_test_1.default)("allows grocery and budget prompts", () => {
    const result = (0, topicGuard_1.guardCookingTopic)({
        message: "What can I make for under $20 with chicken thighs and rice?",
    });
    strict_1.default.equal(result.allowed, true);
    strict_1.default.equal(result.reason, "cooking");
});
(0, node_test_1.default)("allows sauce and snack option requests", () => {
    const result = (0, topicGuard_1.guardCookingTopic)({
        message: "Give me 3 options for dipping sauces for tortilla chips.",
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
    strict_1.default.equal(result.reason, "cooking");
});
(0, node_test_1.default)("allows ingredient exclusion follow-up with active recipe context", () => {
    const result = (0, topicGuard_1.guardCookingTopic)({
        message: "I don't like cabbage or corn.",
        recipeContext: {
            title: "Shrimp Bacon Pasta",
            ingredients: ["shrimp", "bacon", "pasta", "cabbage", "corn"],
            steps: ["Cook the pasta", "Saute the bacon and vegetables", "Finish with shrimp"],
        },
    });
    strict_1.default.equal(result.allowed, true);
    strict_1.default.equal(result.reason, "cooking");
});
(0, node_test_1.default)("allows scaling follow-up with active recipe context", () => {
    const result = (0, topicGuard_1.guardCookingTopic)({
        message: "Double this for 8.",
        recipeContext: {
            title: "Baked Ziti",
            ingredients: ["ziti", "ricotta", "mozzarella"],
            steps: ["Boil the pasta", "Bake until bubbling"],
        },
    });
    strict_1.default.equal(result.allowed, true);
    strict_1.default.equal(result.reason, "cooking");
});
(0, node_test_1.default)("allows short ingredient-addition follow-up with active recipe context", () => {
    const result = (0, topicGuard_1.guardCookingTopic)({
        message: "lets add jalapeños",
        recipeContext: {
            title: "Crispy Chicken Tostadas with Avocado Crema",
            ingredients: ["chicken", "tostada shells", "avocado", "lime"],
            steps: ["Pile the chicken onto tostada shells and finish with avocado crema."],
        },
    });
    strict_1.default.equal(result.allowed, true);
    strict_1.default.equal(result.reason, "cooking");
});
(0, node_test_1.default)("allows short natural refinements with active recipe context even without explicit cooking keywords", () => {
    const recipeContext = {
        title: "Crispy Chicken Tostadas with Avocado Crema",
        ingredients: ["chicken", "tostada shells", "avocado", "lime"],
        steps: ["Pile the chicken onto tostada shells and finish with avocado crema."],
    };
    strict_1.default.deepEqual((0, topicGuard_1.guardCookingTopic)({ message: "more lime", recipeContext }), { allowed: true, reason: "cooking" });
    strict_1.default.deepEqual((0, topicGuard_1.guardCookingTopic)({ message: "skip the crema", recipeContext }), { allowed: true, reason: "cooking" });
    strict_1.default.deepEqual((0, topicGuard_1.guardCookingTopic)({ message: "use thighs instead", recipeContext }), { allowed: true, reason: "cooking" });
    strict_1.default.deepEqual((0, topicGuard_1.guardCookingTopic)({ message: "make it crunchier", recipeContext }), { allowed: true, reason: "cooking" });
});
(0, node_test_1.default)("blocks obvious programming requests", () => {
    const result = (0, topicGuard_1.guardCookingTopic)({
        message: "Can you help me write a React component and fix a TypeScript error?",
    });
    strict_1.default.equal(result.allowed, false);
    strict_1.default.equal(result.reason, "off_topic");
});
(0, node_test_1.default)("blocks airline ticket searches", () => {
    const result = (0, topicGuard_1.guardCookingTopic)({
        message: "Can you search for airline tickets to Denver next week?",
    });
    strict_1.default.equal(result.allowed, false);
    strict_1.default.equal(result.reason, "off_topic");
});
(0, node_test_1.default)("blocks mortgage rate requests", () => {
    const result = (0, topicGuard_1.guardCookingTopic)({
        message: "What are today's mortgage rates?",
    });
    strict_1.default.equal(result.allowed, false);
    strict_1.default.equal(result.reason, "off_topic");
});
(0, node_test_1.default)("blocks generic non-cooking chat", () => {
    const result = (0, topicGuard_1.guardCookingTopic)({
        message: "Tell me a joke.",
    });
    strict_1.default.equal(result.allowed, false);
    strict_1.default.equal(result.reason, "off_topic");
});
(0, node_test_1.default)("scope message points users back to cooking topics", () => {
    strict_1.default.match(topicGuard_1.COOKING_SCOPE_MESSAGE, /cooking-focused requests only/i);
    strict_1.default.match(topicGuard_1.COOKING_SCOPE_MESSAGE, /sauces/i);
    strict_1.default.match(topicGuard_1.COOKING_SCOPE_MESSAGE, /meal prep/i);
});
