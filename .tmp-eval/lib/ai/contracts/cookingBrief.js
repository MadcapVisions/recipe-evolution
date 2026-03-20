"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COOKING_BRIEF_REQUEST_MODES = exports.BRIEF_FIELD_STATES = void 0;
exports.createEmptyCookingBrief = createEmptyCookingBrief;
exports.isCookingBriefLocked = isCookingBriefLocked;
exports.BRIEF_FIELD_STATES = ["locked", "inferred", "unknown"];
exports.COOKING_BRIEF_REQUEST_MODES = ["explore", "compare", "locked", "generate", "revise"];
function createEmptyCookingBrief() {
    return {
        request_mode: "explore",
        confidence: 0,
        ambiguity_reason: null,
        dish: {
            raw_user_phrase: null,
            normalized_name: null,
            dish_family: null,
            cuisine: null,
            course: null,
            authenticity_target: null,
        },
        style: {
            tags: [],
            texture_tags: [],
            format_tags: [],
        },
        ingredients: {
            required: [],
            preferred: [],
            forbidden: [],
            centerpiece: null,
        },
        constraints: {
            servings: null,
            time_max_minutes: null,
            difficulty_target: null,
            dietary_tags: [],
            equipment_limits: [],
        },
        directives: {
            must_have: [],
            nice_to_have: [],
            must_not_have: [],
            required_techniques: [],
        },
        field_state: {
            dish_family: "unknown",
            normalized_name: "unknown",
            cuisine: "unknown",
            ingredients: "unknown",
            constraints: "unknown",
        },
        source_turn_ids: [],
        compiler_notes: [],
    };
}
function isCookingBriefLocked(brief) {
    return brief.request_mode === "locked" || brief.request_mode === "generate" || brief.field_state.dish_family === "locked";
}
