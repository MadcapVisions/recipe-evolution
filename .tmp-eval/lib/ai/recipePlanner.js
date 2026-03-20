"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRecipePlanFromBrief = buildRecipePlanFromBrief;
const recipePlan_1 = require("./contracts/recipePlan");
function unique(values) {
    return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}
function inferCoreComponents(brief) {
    const family = brief.dish.dish_family;
    if (family === "pizza") {
        return unique(["dough", "sauce", "cheese", ...brief.ingredients.required]);
    }
    if (family === "pasta") {
        return unique(["pasta", "sauce", ...brief.ingredients.required]);
    }
    if (family === "tacos") {
        return unique(["tortillas", "filling", "topping", ...brief.ingredients.required]);
    }
    if (family === "dip") {
        return unique(["main ingredient", "acid", "fat", ...brief.ingredients.required]);
    }
    return unique([...brief.ingredients.required, ...brief.directives.must_have]);
}
function inferTechniqueOutline(brief) {
    const family = brief.dish.dish_family;
    if (family === "pizza") {
        return [
            "Prepare or stretch the dough into the intended shape.",
            "Add sauce and toppings with restraint so the crust stays crisp.",
            "Bake at high heat until the crust is deeply golden.",
            "Finish with herbs, acid, or oil only after baking if needed.",
        ];
    }
    if (family === "pasta") {
        return [
            "Cook the pasta in well-salted water to the correct doneness.",
            "Build the sauce separately and reserve pasta water.",
            "Combine pasta and sauce at the end to finish cohesively.",
        ];
    }
    if (family === "tacos") {
        return [
            "Prepare the filling with concentrated seasoning.",
            "Warm the tortillas separately.",
            "Assemble with fresh toppings at the end for contrast.",
        ];
    }
    return [
        "Build the main flavor base first.",
        "Cook the central component to the right texture.",
        "Finish with balancing acid, herbs, or garnish if needed.",
    ];
}
function inferExpectedTextures(brief) {
    return unique([...brief.style.texture_tags, ...brief.style.tags.filter((tag) => ["crispy", "airy", "creamy", "delicate"].includes(tag))]);
}
function inferExpectedFlavors(brief) {
    return unique(brief.directives.must_have.filter((item) => ["bright", "savory", "spicy", "herby", "traditional"].some((token) => item.toLowerCase().includes(token))));
}
function buildRecipePlanFromBrief(brief) {
    const plan = (0, recipePlan_1.createEmptyRecipePlan)();
    plan.title_direction = brief.dish.normalized_name ?? brief.dish.raw_user_phrase ?? "Chef recipe";
    plan.dish_family = brief.dish.dish_family ?? "dish";
    plan.style_tags = unique([...brief.style.tags, ...brief.style.format_tags]);
    plan.core_components = inferCoreComponents(brief);
    plan.key_ingredients = unique([
        ...brief.ingredients.required,
        ...(brief.ingredients.centerpiece ? [brief.ingredients.centerpiece] : []),
    ]);
    plan.blocked_ingredients = unique(brief.ingredients.forbidden);
    plan.technique_outline = inferTechniqueOutline(brief);
    plan.expected_texture = inferExpectedTextures(brief);
    plan.expected_flavor = inferExpectedFlavors(brief);
    plan.confidence = Math.max(0.5, brief.confidence);
    plan.notes = unique([
        ...(brief.dish.authenticity_target ? [`Honor the ${brief.dish.authenticity_target} direction.`] : []),
        ...(brief.constraints.time_max_minutes ? [`Aim for roughly ${brief.constraints.time_max_minutes} minutes total.`] : []),
        ...(brief.ingredients.forbidden.length > 0 ? [`Avoid: ${brief.ingredients.forbidden.join(", ")}.`] : []),
    ]);
    return plan;
}
