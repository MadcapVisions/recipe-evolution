"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const prepPlan_1 = require("../../lib/recipes/prepPlan");
(0, node_test_1.default)("buildPrepPlan derives prep, make-ahead, and cooking window cues", () => {
    strict_1.default.deepEqual((0, prepPlan_1.buildPrepPlan)({
        ingredientNames: ["1 onion, chopped", "2 carrots, diced", "olive oil"],
        stepTexts: [
            "Marinate overnight in the refrigerator.",
            "Simmer onion and carrots for 20 minutes until the sauce thickens.",
            "Serve warm.",
        ],
    }), {
        prepTasks: ["Chopped onion", "Diced carrots"],
        makeAheadTasks: ["Marinate overnight in the refrigerator."],
        cookingWindows: ["You have about 20 minutes during: Simmer onion and carrots for 20 minutes until the sauce thickens."],
        firstMoves: ["Marinate overnight in the refrigerator.", "Simmer onion and carrots for 20 minutes until the sauce thickens.", "Serve warm."],
        checklist: [
            { id: "mise-0", phase: "mise", title: "Chopped onion" },
            { id: "mise-1", phase: "mise", title: "Diced carrots" },
            { id: "first-0", phase: "first-moves", title: "Marinate overnight in the refrigerator." },
            { id: "first-1", phase: "first-moves", title: "Simmer onion and carrots for 20 minutes until the sauce thickens." },
            { id: "first-2", phase: "first-moves", title: "Serve warm." },
            { id: "ahead-0", phase: "make-ahead", title: "Marinate overnight in the refrigerator." },
            { id: "window-0", phase: "cook-window", title: "You have about 20 minutes during: Simmer onion and carrots for 20 minutes until the sauce thickens." },
        ],
        stepHighlights: [
            {
                step: "Simmer onion and carrots for 20 minutes until the sauce thickens.",
                ingredients: ["onion", "carrots"],
            },
        ],
    });
});
