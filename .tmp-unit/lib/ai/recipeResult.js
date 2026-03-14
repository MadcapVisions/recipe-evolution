"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAiRecipeResult = createAiRecipeResult;
exports.parseAiRecipeResult = parseAiRecipeResult;
const recipeDraft_1 = require("../recipes/recipeDraft");
function createAiRecipeResult(input) {
    return {
        recipe: (0, recipeDraft_1.normalizeRecipeDraft)(input.recipe),
        explanation: input.explanation?.trim() || null,
        meta: {
            purpose: input.purpose,
            source: input.source,
            provider: input.provider ?? null,
            model: input.model ?? null,
            cached: input.cached ?? input.source === "cache",
            input_hash: input.inputHash ?? null,
            created_at: input.createdAt ?? null,
        },
    };
}
function parseAiRecipeResult(value) {
    if (!value || typeof value !== "object") {
        return null;
    }
    const raw = value;
    if (!raw.recipe || typeof raw.meta !== "object" || raw.meta === null) {
        return null;
    }
    try {
        const recipe = (0, recipeDraft_1.normalizeRecipeDraft)(raw.recipe);
        const metaRaw = raw.meta;
        return {
            recipe,
            explanation: typeof raw.explanation === "string" && raw.explanation.trim().length > 0 ? raw.explanation.trim() : null,
            meta: {
                purpose: metaRaw.purpose === "structure" || metaRaw.purpose === "home_recipe" || metaRaw.purpose === "refine"
                    ? metaRaw.purpose
                    : "home_recipe",
                source: metaRaw.source === "cache" || metaRaw.source === "fallback" ? metaRaw.source : "ai",
                provider: typeof metaRaw.provider === "string" ? metaRaw.provider : null,
                model: typeof metaRaw.model === "string" ? metaRaw.model : null,
                cached: metaRaw.cached === true,
                input_hash: typeof metaRaw.input_hash === "string" ? metaRaw.input_hash : null,
                created_at: typeof metaRaw.created_at === "string" ? metaRaw.created_at : null,
            },
        };
    }
    catch {
        return null;
    }
}
