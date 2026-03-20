"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJsonResponse = parseJsonResponse;
exports.callAIForJson = callAIForJson;
const aiClient_1 = require("./aiClient");
function parseJsonResponse(text) {
    if (typeof text !== "string" || text.trim().length === 0) {
        return null;
    }
    const direct = text.trim();
    try {
        return JSON.parse(direct);
    }
    catch {
        // Fall through to fence/substring extraction.
    }
    const withoutFences = direct.replace(/```json/gi, "").replace(/```/g, "").trim();
    try {
        return JSON.parse(withoutFences);
    }
    catch {
        // Fall through to brace slice extraction.
    }
    const firstBrace = withoutFences.indexOf("{");
    const lastBrace = withoutFences.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        const sliced = withoutFences.slice(firstBrace, lastBrace + 1);
        try {
            return JSON.parse(sliced);
        }
        catch {
            return null;
        }
    }
    return null;
}
async function callAIForJson(messages, options = {}) {
    const result = await (0, aiClient_1.callAIWithMeta)(messages, options);
    const parsed = parseJsonResponse(result.text);
    if (parsed == null) {
        throw new Error(`AI returned invalid JSON (${result.provider}${result.model ? `:${result.model}` : ""}).`);
    }
    return {
        ...result,
        parsed,
    };
}
