import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export type AiTaskKey =
  | "chef_chat"
  | "home_ideas"
  | "home_recipe"
  | "recipe_improvement"
  | "recipe_structure";

export type AiTaskDefaults = {
  label: string;
  description: string;
  primaryModel: string;
  fallbackModel: string | null;
  temperature: number;
  maxTokens: number;
  enabled: boolean;
};

export type AiTaskSettingRecord = {
  taskKey: AiTaskKey;
  label: string;
  description: string;
  primaryModel: string;
  fallbackModel: string | null;
  temperature: number;
  maxTokens: number;
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

type AiTaskSettingRow = {
  task_key: AiTaskKey;
  primary_model: string;
  fallback_model: string | null;
  temperature: number | null;
  max_tokens: number | null;
  enabled: boolean | null;
  updated_at: string | null;
  updated_by: string | null;
};

export const AI_TASK_DEFAULTS: Record<AiTaskKey, AiTaskDefaults> = {
  chef_chat: {
    label: "Chef Chat",
    description: "Fast cooking guidance on the home hub and recipe detail pages.",
    primaryModel: "openai/gpt-4o-mini",
    fallbackModel: "anthropic/claude-3.5-haiku",
    temperature: 0.35,
    maxTokens: 900,
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

let cachedSettings: AiTaskSettingRecord[] | null = null;
let cachedAt = 0;

function uniqueModels(models: Array<string | null | undefined>) {
  return models.filter((value, index, list): value is string => Boolean(value) && list.indexOf(value) === index);
}

function mergeTaskSetting(taskKey: AiTaskKey, row?: AiTaskSettingRow | null): AiTaskSettingRecord {
  const defaults = AI_TASK_DEFAULTS[taskKey];

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

export function invalidateAiTaskSettingsCache() {
  cachedSettings = null;
  cachedAt = 0;
}

export async function listAiTaskSettings(options?: { bypassCache?: boolean }): Promise<AiTaskSettingRecord[]> {
  const bypassCache = options?.bypassCache ?? false;
  if (!bypassCache && cachedSettings && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedSettings;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ai_task_settings")
    .select("task_key, primary_model, fallback_model, temperature, max_tokens, enabled, updated_at, updated_by")
    .order("task_key", { ascending: true });

  if (error) {
    throw new Error(`Failed to load AI task settings: ${error.message}`);
  }

  const rows = (data ?? []) as AiTaskSettingRow[];
  const rowsByTask = new Map<AiTaskKey, AiTaskSettingRow>(rows.map((row) => [row.task_key, row]));
  const merged = (Object.keys(AI_TASK_DEFAULTS) as AiTaskKey[]).map((taskKey) => mergeTaskSetting(taskKey, rowsByTask.get(taskKey)));

  cachedSettings = merged;
  cachedAt = Date.now();
  return merged;
}

export async function resolveAiTaskSettings(taskKey: AiTaskKey): Promise<AiTaskSettingRecord> {
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

export function buildAiCallModelList(setting: AiTaskSettingRecord) {
  return uniqueModels([setting.primaryModel, setting.fallbackModel]);
}

