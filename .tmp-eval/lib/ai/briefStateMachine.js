"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveBriefRequestMode = deriveBriefRequestMode;
function normalizeText(value) {
    return value.toLowerCase().replace(/\s+/g, " ").trim();
}
const PIVOT_PATTERNS = [
    /\bnever mind\b/,
    /\binstead\b/,
    /\bactually\b.+\b(?:want|give me|show me)\b/,
    /\btotally different\b/,
];
const COMPARE_PATTERNS = [
    /\bideas?\b/,
    /\boptions?\b/,
    /\balternatives?\b/,
    /\bvariations?\b/,
    /\bshow me\b/,
    /\bgive me\b/,
];
const REVISE_PATTERNS = [
    /\bmake (?:it|this)\b/,
    /\bkeep\b/,
    /\bwithout\b/,
    /\bremove\b/,
    /\bskip\b/,
    /\bleave out\b/,
    /\badd\b/,
    /\bswap\b/,
];
function deriveBriefRequestMode(input) {
    const latestUser = normalizeText(input.latestUserMessage);
    const latestAssistant = normalizeText(input.latestAssistantMessage ?? "");
    const historyLength = input.conversationHistory?.length ?? 0;
    if (PIVOT_PATTERNS.some((pattern) => pattern.test(latestUser))) {
        return "explore";
    }
    if (latestAssistant.includes("locked direction:")) {
        return REVISE_PATTERNS.some((pattern) => pattern.test(latestUser)) ? "revise" : "locked";
    }
    if (latestAssistant.includes("option 1:") || latestAssistant.includes("option 2:")) {
        return "compare";
    }
    if (REVISE_PATTERNS.some((pattern) => pattern.test(latestUser))) {
        return historyLength > 0 ? "revise" : "explore";
    }
    if (COMPARE_PATTERNS.some((pattern) => pattern.test(latestUser))) {
        return "compare";
    }
    return historyLength > 0 ? "locked" : "explore";
}
