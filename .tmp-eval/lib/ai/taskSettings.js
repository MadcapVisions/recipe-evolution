"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_TASK_DEFAULTS = void 0;
exports.invalidateAiTaskSettingsCache = invalidateAiTaskSettingsCache;
exports.listAiTaskSettings = listAiTaskSettings;
exports.resolveAiTaskSettings = resolveAiTaskSettings;
exports.buildAiCallModelList = buildAiCallModelList;
require("server-only");
const supabaseAdmin_1 = require("@/lib/supabaseAdmin");
exports.AI_TASK_DEFAULTS = {
    chef_chat: {
        label: "Chef Chat",
        description: "Fast cooking guidance on the home hub and recipe detail pages.",
        primaryModel: "openai/gpt-4o-mini",
        fallbackModel: "anthropic/claude-3.5-haiku",
        temperature: 0.35,
        maxTokens: 600,
        enabled: true,
    },
    home_ideas: {
        label: "Home Ideas",
        description: "Meal ideas generated from moods, ingredients, and filters.",
        primaryModel: "openai/gpt-4o-mini",
        fallbackModel: "anthropic/claude-3.5-haiku",
        temperature: 0.7,
        maxTokens: 900,
        enabled: true,
    },
    home_recipe: {
        label: "Recipe Generation",
        description: "Full recipe generation from a selected home idea or chef conversation.",
        primaryModel: "openai/gpt-4o-mini",
        fallbackModel: "anthropic/claude-3.5-haiku",
        temperature: 0.55,
        maxTokens: 1600,
        enabled: true,
    },
    recipe_improvement: {
        label: "Recipe Improvement",
        description: "Apply a cooking instruction to produce an improved recipe version.",
        primaryModel: "openai/gpt-4o-mini",
        fallbackModel: "anthropic/claude-3.5-haiku",
        temperature: 0.5,
        maxTokens: 700,
        enabled: true,
    },
    recipe_structure: {
        label: "Recipe Structuring",
        description: "Convert raw recipe text into structured recipe JSON.",
        primaryModel: "openai/gpt-4o-mini",
        fallbackModel: "anthropic/claude-3.5-haiku",
        temperature: 0.2,
        maxTokens: 1200,
        enabled: true,
    },
};
const CACHE_TTL_MS = 60_000;
let cachedSettings = null;
let cachedAt = 0;
function uniqueModels(models) {
    return models.filter((value, index, list) => Boolean(value) && list.indexOf(value) === index);
}
function mergeTaskSetting(taskKey, row) {
    const defaults = exports.AI_TASK_DEFAULTS[taskKey];
    return {
        taskKey,
        label: defaults.label,
        description: defaults.description,
        primaryModel: row?.primary_model?.trim() || defaults.primaryModel,
        fallbackModel: row?.fallback_model?.trim() || defaults.fallbackModel,
        temperature: typeof row?.temperature === "number" ? row.temperature : defaults.temperature,
        maxTokens: typeof row?.max_tokens === "number" ? row.max_tokens : defaults.maxTokens,
        enabled: typeof row?.enabled === "boolean" ? row.enabled : defaults.enabled,
        updatedAt: row?.updated_at ?? null,
        updatedBy: row?.updated_by ?? null,
    };
}
function invalidateAiTaskSettingsCache() {
    cachedSettings = null;
    cachedAt = 0;
}
async function listAiTaskSettings(options) {
    const bypassCache = options?.bypassCache ?? false;
    if (!bypassCache && cachedSettings && Date.now() - cachedAt < CACHE_TTL_MS) {
        return cachedSettings;
    }
    const supabase = (0, supabaseAdmin_1.createSupabaseAdminClient)();
    const { data, error } = await supabase
        .from("ai_task_settings")
        .select("task_key, primary_model, fallback_model, temperature, max_tokens, enabled, updated_at, updated_by")
        .order("task_key", { ascending: true });
    if (error) {
        throw new Error(`Failed to load AI task settings: ${error.message}`);
    }
    const rows = (data ?? []);
    const rowsByTask = new Map(rows.map((row) => [row.task_key, row]));
    const merged = Object.keys(exports.AI_TASK_DEFAULTS).map((taskKey) => mergeTaskSetting(taskKey, rowsByTask.get(taskKey)));
    cachedSettings = merged;
    cachedAt = Date.now();
    return merged;
}
async function resolveAiTaskSettings(taskKey) {
    const settings = await listAiTaskSettings();
    const resolved = settings.find((item) => item.taskKey === taskKey);
    if (!resolved) {
        return mergeTaskSetting(taskKey);
    }
    return {
        ...resolved,
        primaryModel: resolved.primaryModel,
        fallbackModel: resolved.fallbackModel,
    };
}
function buildAiCallModelList(setting) {
    return uniqueModels([setting.primaryModel, setting.fallbackModel]);
}
