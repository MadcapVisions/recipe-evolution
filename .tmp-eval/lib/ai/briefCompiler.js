"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileCookingBrief = compileCookingBrief;
const cookingBrief_1 = require("./contracts/cookingBrief");
const homeRecipeAlignment_1 = require("./homeRecipeAlignment");
const briefStateMachine_1 = require("./briefStateMachine");
function normalizeText(value) {
    return value.toLowerCase().replace(/\s+/g, " ").trim();
}
function unique(values) {
    return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}
function extractForbiddenIngredients(text) {
    const normalized = normalizeText(text);
    const results = [];
    const noMatches = Array.from(normalized.matchAll(/\bno\s+([a-z][a-z\s-]{1,30}?)(?=(?:,| and | but | with |$))/g));
    for (const match of noMatches) {
        const candidate = (match[1] ?? "").trim();
        if (candidate.length > 1) {
            results.push(candidate);
        }
    }
    return unique(results);
}
function extractTimeMaxMinutes(text) {
    const match = text.match(/\b(?:in|under|within)\s+(\d{1,3})\s*(?:minutes|min)\b/i);
    return match ? Number(match[1]) : null;
}
function extractDietaryTags(text) {
    const normalized = normalizeText(text);
    const tags = ["vegetarian", "vegan", "gluten free", "dairy free", "high protein", "low carb"];
    return tags.filter((tag) => normalized.includes(tag) || normalized.includes(tag.replace(" ", "-")));
}
function extractFormatTags(text) {
    const normalized = normalizeText(text);
    const tags = ["sheet-pan", "focaccia-style", "flatbread-style", "traditional", "weeknight"];
    return tags.filter((tag) => normalized.includes(tag.replace("-", " ")) || normalized.includes(tag));
}
function extractTextureTags(text) {
    const normalized = normalizeText(text);
    const tags = ["crispy", "airy", "chewy", "creamy", "delicate", "bright"];
    return tags.filter((tag) => normalized.includes(tag));
}
function inferConfidence(input) {
    if (input.latestAssistantMessage.toLowerCase().includes("locked direction:"))
        return 0.92;
    if (input.recipeContext?.title && input.dishFamily)
        return 0.86;
    if (input.dishFamily && input.normalizedName)
        return 0.78;
    if (input.dishFamily)
        return 0.66;
    return 0.45;
}
function compileCookingBrief(input) {
    const conversationHistory = input.conversationHistory ?? [];
    const assistantReply = input.assistantReply?.trim() ?? "";
    const recipeContext = input.recipeContext ?? null;
    const conversationText = [
        ...conversationHistory.map((message) => `${message.role === "user" ? "User" : "Chef"}: ${message.content}`),
        input.userMessage ? `User: ${input.userMessage}` : "",
        assistantReply ? `Chef: ${assistantReply}` : "",
        recipeContext?.title ? `Recipe Context Title: ${recipeContext.title}` : "",
        recipeContext?.ingredients?.length ? `Recipe Context Ingredients: ${recipeContext.ingredients.join(", ")}` : "",
    ]
        .filter(Boolean)
        .join("\n");
    const dishFamily = (0, homeRecipeAlignment_1.detectRequestedDishFamily)(conversationText);
    const normalizedName = (0, homeRecipeAlignment_1.deriveIdeaTitleFromConversationContext)(conversationText);
    const forbiddenIngredients = extractForbiddenIngredients(conversationText);
    const brief = (0, cookingBrief_1.createEmptyCookingBrief)();
    const requestMode = (0, briefStateMachine_1.deriveBriefRequestMode)({
        latestUserMessage: input.userMessage,
        latestAssistantMessage: assistantReply,
        conversationHistory,
    });
    const confidence = inferConfidence({
        dishFamily,
        normalizedName,
        latestAssistantMessage: assistantReply,
        recipeContext,
    });
    brief.request_mode = requestMode;
    brief.confidence = confidence;
    brief.ambiguity_reason = confidence < 0.65 ? "Low-confidence dish interpretation." : null;
    brief.dish = {
        raw_user_phrase: input.userMessage.trim() || null,
        normalized_name: normalizedName === "Chef Conversation Recipe" ? recipeContext?.title?.trim() || null : normalizedName,
        dish_family: dishFamily,
        cuisine: null,
        course: null,
        authenticity_target: normalizeText(conversationText).includes("traditional") ? "traditional" : null,
    };
    brief.style = {
        tags: unique(extractFormatTags(conversationText)),
        texture_tags: unique(extractTextureTags(conversationText)),
        format_tags: unique(extractFormatTags(conversationText)),
    };
    brief.ingredients = {
        required: unique(recipeContext?.ingredients ?? []),
        preferred: [],
        forbidden: forbiddenIngredients,
        centerpiece: recipeContext?.title?.trim() || brief.dish.normalized_name,
    };
    brief.constraints = {
        servings: null,
        time_max_minutes: extractTimeMaxMinutes(conversationText),
        difficulty_target: null,
        dietary_tags: extractDietaryTags(conversationText),
        equipment_limits: [],
    };
    brief.directives = {
        must_have: unique([...(dishFamily ? [dishFamily] : []), ...brief.style.tags, ...brief.ingredients.required]),
        nice_to_have: [],
        must_not_have: forbiddenIngredients,
        required_techniques: dishFamily === "pizza" ? ["bake"] : [],
    };
    brief.field_state = {
        dish_family: dishFamily ? (requestMode === "locked" ? "locked" : "inferred") : "unknown",
        normalized_name: brief.dish.normalized_name ? (requestMode === "locked" ? "locked" : "inferred") : "unknown",
        cuisine: "unknown",
        ingredients: brief.ingredients.required.length > 0 || brief.ingredients.forbidden.length > 0 ? "inferred" : "unknown",
        constraints: brief.constraints.time_max_minutes != null || brief.constraints.dietary_tags.length > 0 ? "inferred" : "unknown",
    };
    brief.source_turn_ids = input.sourceTurnIds ?? [];
    brief.compiler_notes = [
        recipeContext?.title ? "Recipe context was included in brief compilation." : "Compiled from conversation text only.",
        assistantReply.toLowerCase().includes("locked direction:") ? "Locked direction signal detected." : "No explicit locked direction signal detected.",
        `Resolved request mode: ${requestMode}.`,
    ];
    return brief;
}
