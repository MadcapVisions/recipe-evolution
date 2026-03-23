"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashAiCacheInput = hashAiCacheInput;
exports.readAiCache = readAiCache;
exports.writeAiCache = writeAiCache;
const crypto_1 = require("crypto");
// Per-purpose TTL in days. Entries older than this are ignored on read.
// home_ideas expires quickly (mood/context changes); structural outputs are durable.
const CACHE_TTL_DAYS = {
    home_ideas: 7,
    home_recipe: 30,
    structure: 90,
    refine: 90,
    nutrition: 30,
};
function stableStringify(value) {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(",")}]`;
    }
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}
function hashAiCacheInput(value) {
    return (0, crypto_1.createHash)("sha256").update(stableStringify(value)).digest("hex");
}
async function readAiCache(supabase, userId, purpose, inputHash) {
    const ttlDays = CACHE_TTL_DAYS[purpose];
    const oldestAllowed = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
        .from("ai_cache")
        .select("response_json, created_at, model")
        .eq("owner_id", userId)
        .eq("purpose", purpose)
        .eq("input_hash", inputHash)
        .gte("created_at", oldestAllowed)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) {
        console.warn(`AI cache read failed for ${purpose}:`, error.message);
        return null;
    }
    return data;
}
async function writeAiCache(supabase, userId, purpose, inputHash, model, responseJson) {
    const { error } = await supabase.from("ai_cache").upsert({
        owner_id: userId,
        purpose,
        input_hash: inputHash,
        model,
        response_json: responseJson,
    }, { onConflict: "owner_id,purpose,input_hash,model" });
    if (error) {
        console.warn(`AI cache write failed for ${purpose}:`, error.message);
    }
}
