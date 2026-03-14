"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const cache_1 = require("../../lib/ai/cache");
(0, node_test_1.default)("hashAiCacheInput is stable for equivalent object key order", () => {
    const first = {
        prompt: "lemon chicken",
        options: {
            count: 2,
            filters: ["quick", "healthy"],
        },
    };
    const second = {
        options: {
            filters: ["quick", "healthy"],
            count: 2,
        },
        prompt: "lemon chicken",
    };
    strict_1.default.equal((0, cache_1.hashAiCacheInput)(first), (0, cache_1.hashAiCacheInput)(second));
});
(0, node_test_1.default)("hashAiCacheInput changes when normalized content changes", () => {
    const base = {
        prompt: "lemon chicken",
        ingredients: ["chicken", "lemon"],
    };
    const changed = {
        prompt: "lemon chicken",
        ingredients: ["chicken", "lime"],
    };
    strict_1.default.notEqual((0, cache_1.hashAiCacheInput)(base), (0, cache_1.hashAiCacheInput)(changed));
});
(0, node_test_1.default)("hashAiCacheInput preserves array order significance", () => {
    const first = {
        ingredients: ["chicken", "lemon"],
    };
    const second = {
        ingredients: ["lemon", "chicken"],
    };
    strict_1.default.notEqual((0, cache_1.hashAiCacheInput)(first), (0, cache_1.hashAiCacheInput)(second));
});
