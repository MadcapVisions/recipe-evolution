"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recipeVersionPayloadSchema = exports.createRecipePayloadSchema = exports.recipeDraftSchema = exports.recipeDraftStepSchema = exports.recipeDraftIngredientSchema = void 0;
exports.ingredientLineHasAmount = ingredientLineHasAmount;
exports.formatIngredientLine = formatIngredientLine;
exports.normalizeRecipeDraft = normalizeRecipeDraft;
exports.normalizeRecipeVersionPayload = normalizeRecipeVersionPayload;
exports.parseIngredientLines = parseIngredientLines;
exports.parseStepLines = parseStepLines;
const zod_1 = require("zod");
const canonicalEnrichment_1 = require("./canonicalEnrichment");
const nullableTrimmedString = zod_1.z
    .union([zod_1.z.string(), zod_1.z.null(), zod_1.z.undefined()])
    .transform((value) => {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
});
const optionalUnknown = zod_1.z.union([zod_1.z.unknown(), zod_1.z.undefined()]).transform((value) => value ?? null);
function formatIngredientQuantity(value) {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, "");
}
function ingredientLineHasAmount(value) {
    return (0, canonicalEnrichment_1.deriveIngredientDetails)(value).quantity != null;
}
function formatIngredientLine(input) {
    const amount = typeof input.quantity === "number" && Number.isFinite(input.quantity) ? formatIngredientQuantity(input.quantity) : null;
    const unit = input.unit?.trim() ? input.unit.trim() : null;
    const name = input.name.trim();
    const prep = input.prep?.trim() ? input.prep.trim() : null;
    const optional = input.optional === true ? "optional" : null;
    return [amount, unit, name, prep, optional].filter((part) => Boolean(part)).join(" ").replace(/\s+/g, " ").trim();
}
const measuredIngredientNameSchema = zod_1.z
    .string()
    .trim()
    .min(1, "Ingredient name is required")
    .refine((value) => ingredientLineHasAmount(value), "Each ingredient needs a quantity, like '2 tbsp olive oil' or '1 onion'.");
exports.recipeDraftIngredientSchema = zod_1.z.object({
    name: measuredIngredientNameSchema,
});
exports.recipeDraftStepSchema = zod_1.z.object({
    text: zod_1.z.string().trim().min(1, "Step text is required"),
});
exports.recipeDraftSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1, "Title is required"),
    description: nullableTrimmedString,
    tags: zod_1.z
        .array(zod_1.z.string().trim().min(1))
        .nullable()
        .optional()
        .transform((value) => {
        if (!value || value.length === 0) {
            return null;
        }
        return Array.from(new Set(value.map((item) => item.trim()).filter((item) => item.length > 0)));
    }),
    servings: zod_1.z.number().int().positive().nullable(),
    prep_time_min: zod_1.z.number().int().nonnegative().nullable(),
    cook_time_min: zod_1.z.number().int().nonnegative().nullable(),
    difficulty: nullableTrimmedString,
    ingredients: zod_1.z.array(exports.recipeDraftIngredientSchema).min(1, "At least one ingredient is required"),
    steps: zod_1.z.array(exports.recipeDraftStepSchema).min(1, "At least one step is required"),
    notes: nullableTrimmedString.optional().transform((value) => value ?? null),
    change_log: nullableTrimmedString.optional().transform((value) => value ?? null),
    ai_metadata_json: optionalUnknown.optional().transform((value) => value ?? null),
});
exports.createRecipePayloadSchema = zod_1.z.object({
    draft: exports.recipeDraftSchema,
});
exports.recipeVersionPayloadSchema = zod_1.z.object({
    version_label: nullableTrimmedString.optional().transform((value) => value ?? null),
    change_summary: nullableTrimmedString.optional().transform((value) => value ?? null),
    servings: zod_1.z.number().int().positive().nullable().optional().transform((value) => value ?? null),
    prep_time_min: zod_1.z.number().int().nonnegative().nullable().optional().transform((value) => value ?? null),
    cook_time_min: zod_1.z.number().int().nonnegative().nullable().optional().transform((value) => value ?? null),
    difficulty: nullableTrimmedString.optional().transform((value) => value ?? null),
    ingredients: zod_1.z.array(exports.recipeDraftIngredientSchema).min(1, "At least one ingredient is required"),
    steps: zod_1.z.array(exports.recipeDraftStepSchema).min(1, "At least one step is required"),
    notes: nullableTrimmedString.optional().transform((value) => value ?? null),
    change_log: nullableTrimmedString.optional().transform((value) => value ?? null),
    ai_metadata_json: optionalUnknown.optional().transform((value) => value ?? null),
});
function normalizeRecipeDraft(input) {
    return exports.recipeDraftSchema.parse(input);
}
function normalizeRecipeVersionPayload(input) {
    return exports.recipeVersionPayloadSchema.parse(input);
}
function parseIngredientLines(lines) {
    return lines
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((name) => ({ name }));
}
function parseStepLines(lines) {
    return lines
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((text) => ({ text }));
}
