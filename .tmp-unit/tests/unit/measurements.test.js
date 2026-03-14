"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const measurements_1 = require("../../lib/recipes/measurements");
(0, node_test_1.default)("normalizeMeasurementUnit maps common aliases", () => {
    strict_1.default.equal((0, measurements_1.normalizeMeasurementUnit)("tablespoons"), "tbsp");
    strict_1.default.equal((0, measurements_1.normalizeMeasurementUnit)("cups"), "cup");
});
(0, node_test_1.default)("combineMeasuredQuantities converts compatible volume units", () => {
    strict_1.default.deepEqual((0, measurements_1.combineMeasuredQuantities)({ quantity: 1, unit: "tbsp" }, { quantity: 3, unit: "tsp" }), { quantity: 2, unit: "tbsp" });
});
