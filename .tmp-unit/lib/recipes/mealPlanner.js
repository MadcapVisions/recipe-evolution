"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMealPlan = buildMealPlan;
const groceryPlanning_1 = require("./groceryPlanning");
const prepPlan_1 = require("./prepPlan");
const canonicalEnrichment_1 = require("./canonicalEnrichment");
const measurements_1 = require("./measurements");
const servings_1 = require("./servings");
function normalizeIngredientName(name) {
    const details = (0, canonicalEnrichment_1.deriveIngredientDetails)(name);
    const unit = (0, measurements_1.normalizeMeasurementUnit)(details.unit);
    return name
        .toLowerCase()
        .replace(/[(),]/g, " ")
        .replace(/^((?:about|approx\.?|approximately)\s+)?(\d+(?:\.\d+)?(?:\/\d+)?(?:\s+\d+\/\d+)?|[\d¼½¾⅐⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]+(?:\s*(?:-|to)\s*[\d¼½¾⅐⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞/. ]+)?)\s+/i, "")
        .replace(unit ? new RegExp(`^${unit}\\s+`, "i") : /^$/, "")
        .replace(/\s+/g, " ")
        .trim();
}
function toPlanningItems(recipes) {
    const aggregations = new Map();
    for (const recipe of recipes) {
        const baseServings = typeof recipe.servings === "number" && recipe.servings > 0 ? recipe.servings : null;
        const targetServings = typeof recipe.targetServings === "number" && recipe.targetServings > 0 ? recipe.targetServings : null;
        const scaledIngredients = baseServings != null && targetServings != null
            ? recipe.ingredients.map((ingredient) => ({
                name: (0, servings_1.scaleCanonicalIngredientLine)(ingredient.name, baseServings, targetServings),
            }))
            : recipe.ingredients;
        for (const ingredient of scaledIngredients) {
            const details = (0, canonicalEnrichment_1.deriveIngredientDetails)(ingredient.name);
            const normalizedName = normalizeIngredientName(ingredient.name);
            const key = normalizedName;
            const existing = aggregations.get(key);
            if (!existing) {
                aggregations.set(key, {
                    id: `${recipe.versionId}-${normalizedName}`,
                    name: ingredient.name,
                    normalized_name: normalizedName,
                    quantity: details.quantity,
                    unit: (0, measurements_1.normalizeMeasurementUnit)(details.unit),
                    prep: details.prep,
                    checked: false,
                });
                continue;
            }
            const combined = (0, measurements_1.combineMeasuredQuantities)({ quantity: existing.quantity, unit: existing.unit }, { quantity: details.quantity, unit: details.unit });
            existing.quantity = combined.quantity;
            existing.unit = combined.unit;
        }
    }
    return Array.from(aggregations.values());
}
function buildMealPlan(recipes, pantryStaples) {
    const groceryItems = toPlanningItems(recipes);
    const groceryPlan = (0, groceryPlanning_1.buildGroceryPlan)(groceryItems, pantryStaples);
    const prepPlans = recipes.map((recipe) => {
        const baseServings = typeof recipe.servings === "number" && recipe.servings > 0 ? recipe.servings : null;
        const targetServings = typeof recipe.targetServings === "number" && recipe.targetServings > 0 ? recipe.targetServings : null;
        const scaledIngredientNames = baseServings != null && targetServings != null
            ? recipe.ingredients.map((item) => (0, servings_1.scaleCanonicalIngredientLine)(item.name, baseServings, targetServings))
            : recipe.ingredients.map((item) => item.name);
        return {
            recipeId: recipe.recipeId,
            recipeTitle: recipe.recipeTitle,
            versionId: recipe.versionId,
            versionLabel: recipe.versionLabel,
            prepPlan: (0, prepPlan_1.buildPrepPlan)({
                ingredientNames: scaledIngredientNames,
                stepTexts: recipe.steps.map((item) => item.text),
            }),
        };
    });
    return {
        groceryPlan,
        prepPlans,
        recipeCount: recipes.length,
    };
}
