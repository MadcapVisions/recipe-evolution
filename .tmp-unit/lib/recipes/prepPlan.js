"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPrepPlan = buildPrepPlan;
const canonicalEnrichment_1 = require("./canonicalEnrichment");
const MAKE_AHEAD_PATTERNS = [
    /\bovernight\b/i,
    /\bmake ahead\b/i,
    /\bmarinat/i,
    /\bchill\b/i,
    /\brefrigerat/i,
    /\blet rest\b/i,
];
function normalizeTask(value) {
    return value.replace(/\s+/g, " ").trim();
}
function stripLeadIn(text) {
    return normalizeTask(text).replace(/^(start with:\s*)/i, "");
}
function ingredientCoreName(name, prep) {
    return name
        .replace(/^((?:about|approx\.?|approximately)\s+)?(\d+(?:\.\d+)?(?:\/\d+)?(?:\s+\d+\/\d+)?|[\d¼½¾⅐⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]+(?:\s*(?:-|to)\s*[\d¼½¾⅐⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞/. ]+)?)\s+/i, "")
        .replace(/^(pinch|pinches|dash|dashes|tsp|teaspoon|teaspoons|tbsp|tablespoon|tablespoons|cup|cups|oz|ounce|ounces|lb|lbs|pound|pounds|g|kg|ml|l|clove|cloves|can|cans|package|packages)\s+/i, "")
        .replace(prep ? new RegExp(`,?\\s*${prep}\\b`, "i") : /^$/, "")
        .replace(/\s+/g, " ")
        .trim();
}
function buildPrepPlan(input) {
    const prepTasks = input.ingredientNames
        .map((name) => {
        const details = (0, canonicalEnrichment_1.deriveIngredientDetails)(name);
        if (!details.prep) {
            return null;
        }
        const ingredientCore = ingredientCoreName(details.name, details.prep);
        return normalizeTask(`${details.prep[0].toUpperCase()}${details.prep.slice(1)} ${ingredientCore}`);
    })
        .filter((task) => Boolean(task));
    const makeAheadTasks = input.stepTexts
        .map((text) => normalizeTask(text))
        .filter((text) => MAKE_AHEAD_PATTERNS.some((pattern) => pattern.test(text)));
    const cookingWindows = input.stepTexts
        .map((text) => {
        const details = (0, canonicalEnrichment_1.deriveStepDetails)(text);
        if (!details.timer_seconds || details.timer_seconds < 8 * 60) {
            return null;
        }
        const minutes = Math.round(details.timer_seconds / 60);
        if (minutes >= 60) {
            return `You have about ${Math.round(minutes / 60)} hour(s) during: ${normalizeTask(text)}`;
        }
        return `You have about ${minutes} minutes during: ${normalizeTask(text)}`;
    })
        .filter((task) => Boolean(task));
    const firstMoves = input.stepTexts
        .slice(0, 3)
        .map((text) => normalizeTask(text))
        .filter((text) => text.length > 0)
        .map((text) => stripLeadIn(text));
    const ingredientTokens = input.ingredientNames
        .map((name) => {
        const details = (0, canonicalEnrichment_1.deriveIngredientDetails)(name);
        return ingredientCoreName(name, details.prep).toLowerCase();
    })
        .filter((value) => value.length >= 3);
    const stepHighlights = input.stepTexts
        .map((text) => {
        const normalizedStep = normalizeTask(text);
        const ingredients = ingredientTokens.filter((ingredient) => normalizedStep.toLowerCase().includes(ingredient)).slice(0, 3);
        return ingredients.length > 0 ? { step: normalizedStep, ingredients } : null;
    })
        .filter((value) => Boolean(value))
        .slice(0, 4);
    const checklist = [
        ...prepTasks.map((task, index) => ({ id: `mise-${index}`, phase: "mise", title: task })),
        ...firstMoves.map((task, index) => ({ id: `first-${index}`, phase: "first-moves", title: task })),
        ...makeAheadTasks.map((task, index) => ({ id: `ahead-${index}`, phase: "make-ahead", title: task })),
        ...cookingWindows.map((task, index) => ({ id: `window-${index}`, phase: "cook-window", title: task })),
    ].slice(0, 10);
    return {
        prepTasks: Array.from(new Set(prepTasks)).slice(0, 6),
        makeAheadTasks: Array.from(new Set(makeAheadTasks)).slice(0, 4),
        cookingWindows: Array.from(new Set(cookingWindows)).slice(0, 4),
        firstMoves: Array.from(new Set(firstMoves)).slice(0, 3),
        checklist,
        stepHighlights,
    };
}
