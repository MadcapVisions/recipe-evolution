"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_STAGE_CACHE_STATUSES = exports.AI_RELIABILITY_STAGE_NAMES = void 0;
exports.createAiStageMetric = createAiStageMetric;
exports.AI_RELIABILITY_STAGE_NAMES = [
    "brief_compile",
    "recipe_plan",
    "recipe_generate",
    "recipe_verify",
];
exports.AI_STAGE_CACHE_STATUSES = ["hit", "miss", "not_applicable"];
function createAiStageMetric(stageName, input) {
    const startedAt = input?.started_at ?? new Date().toISOString();
    const completedAt = input?.completed_at ?? null;
    const derivedDuration = input?.duration_ms ??
        (startedAt && completedAt ? Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime()) : null);
    return {
        stage_name: stageName,
        started_at: startedAt,
        completed_at: completedAt,
        duration_ms: derivedDuration,
        input_tokens: input?.input_tokens ?? null,
        output_tokens: input?.output_tokens ?? null,
        estimated_cost_usd: input?.estimated_cost_usd ?? null,
        cache_status: input?.cache_status ?? "not_applicable",
        provider: input?.provider ?? null,
        model: input?.model ?? null,
    };
}
