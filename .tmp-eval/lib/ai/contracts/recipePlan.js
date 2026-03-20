"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmptyRecipePlan = createEmptyRecipePlan;
function createEmptyRecipePlan() {
    return {
        title_direction: "",
        dish_family: "",
        style_tags: [],
        core_components: [],
        key_ingredients: [],
        blocked_ingredients: [],
        technique_outline: [],
        expected_texture: [],
        expected_flavor: [],
        confidence: 0,
        notes: [],
    };
}
