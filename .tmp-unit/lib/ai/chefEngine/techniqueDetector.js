"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectTechniques = detectTechniques;
function detectTechniques(ingredients) {
    const techniques = [];
    const normalized = ingredients.map((item) => item.trim().toLowerCase());
    if (normalized.includes("pasta")) {
        techniques.push("pastaWater");
    }
    if (normalized.includes("chicken") || normalized.includes("beef")) {
        techniques.push("searing");
    }
    if (normalized.includes("garlic")) {
        techniques.push("garlicBloom");
    }
    return techniques;
}
