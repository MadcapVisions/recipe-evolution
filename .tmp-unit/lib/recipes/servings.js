"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatGroceryItemDisplay = formatGroceryItemDisplay;
exports.formatScaledQuantity = formatScaledQuantity;
exports.scaleQuantityForServings = scaleQuantityForServings;
exports.scaleCanonicalIngredientLine = scaleCanonicalIngredientLine;
exports.scaleGroceryItemsForServings = scaleGroceryItemsForServings;
const canonicalEnrichment_1 = require("./canonicalEnrichment");
function parseIngredientRemainder(name, unit) {
    const original = name.trim();
    const quantityMatch = original.match(/^((?:about|approx\.?|approximately)\s+)?(\d+(?:\.\d+)?(?:\/\d+)?(?:\s+\d+\/\d+)?|[\d¼½¾⅐⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]+(?:\s*(?:-|to)\s*[\d¼½¾⅐⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞/. ]+)?)\s+(.+)$/i);
    let remainder = quantityMatch ? quantityMatch[3].trim() : original;
    if (unit) {
        const [firstToken, ...restTokens] = remainder.split(/\s+/);
        const normalizedToken = firstToken?.toLowerCase().replace(/s$/, "");
        const normalizedUnit = unit.toLowerCase().replace(/s$/, "");
        if (normalizedToken === normalizedUnit) {
            remainder = restTokens.join(" ").trim();
        }
    }
    return remainder || original;
}
function capitalizeDisplayLabel(value) {
    const trimmed = value.trim();
    if (!trimmed) {
        return trimmed;
    }
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
function formatDisplayUnit(unit, quantity) {
    if (!unit) {
        return "";
    }
    const normalized = unit.trim().toLowerCase();
    const singular = quantity != null && Math.abs(quantity - 1) < 0.001;
    const displayUnits = {
        tsp: { singular: "tsp", plural: "tsp" },
        tbsp: { singular: "tbsp", plural: "tbsp" },
        cup: { singular: "cup", plural: "cups" },
        oz: { singular: "oz", plural: "oz" },
        lb: { singular: "lb", plural: "lb" },
        g: { singular: "g", plural: "g" },
        kg: { singular: "kg", plural: "kg" },
        ml: { singular: "ml", plural: "ml" },
        l: { singular: "l", plural: "l" },
        clove: { singular: "clove", plural: "cloves" },
        can: { singular: "can", plural: "cans" },
        package: { singular: "package", plural: "packages" },
    };
    const known = displayUnits[normalized];
    if (!known) {
        return normalized;
    }
    return singular ? known.singular : known.plural;
}
function formatGroceryItemDisplay(item) {
    const trimmedName = item.name.trim();
    if (item.quantity == null) {
        return {
            primary: capitalizeDisplayLabel(trimmedName),
            secondary: null,
        };
    }
    const quantityPart = formatScaledQuantity(item.quantity);
    const unitPart = formatDisplayUnit(item.unit, item.quantity);
    const remainder = parseIngredientRemainder(trimmedName, item.unit);
    const measured = [quantityPart, unitPart, remainder].filter(Boolean).join(" ").trim();
    return {
        primary: capitalizeDisplayLabel(measured || trimmedName),
        secondary: null,
    };
}
function formatScaledQuantity(value) {
    if (!Number.isFinite(value)) {
        return "";
    }
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, "");
}
function scaleQuantityForServings(quantity, baseServings, targetServings) {
    if (quantity == null || !Number.isFinite(quantity) || baseServings <= 0 || targetServings <= 0) {
        return quantity;
    }
    return Math.round((quantity * targetServings * 100) / baseServings) / 100;
}
function scaleCanonicalIngredientLine(name, baseServings, targetServings) {
    const details = (0, canonicalEnrichment_1.deriveIngredientDetails)(name);
    if (details.quantity == null) {
        return name.trim();
    }
    const scaledQuantity = scaleQuantityForServings(details.quantity, baseServings, targetServings);
    const quantityPart = scaledQuantity != null ? formatScaledQuantity(scaledQuantity) : "";
    const unitPart = details.unit ? ` ${details.unit}` : "";
    const remainder = parseIngredientRemainder(name, details.unit);
    return `${quantityPart}${unitPart} ${remainder}`.trim();
}
function scaleGroceryItemsForServings(items, baseServings, targetServings) {
    return items.map((item) => ({
        ...item,
        quantity: scaleQuantityForServings(item.quantity, baseServings, targetServings),
    }));
}
