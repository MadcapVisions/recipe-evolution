import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

const CACHE_TTL_MS = 60_000;

const flagCache = new Map<string, { value: boolean; cachedAt: number }>();

// Typed flag key registry — use these constants instead of raw strings.
export const FEATURE_FLAG_KEYS = {
  GRACEFUL_MODE: "graceful_mode",
  INTENT_RESOLVER_V2: "intent_resolver_v2",
  DRAFT_RECIPE_LIFECYCLE_V1: "draft_recipe_lifecycle_v1",
  CREATE_GUIDED_ENTRY_V1: "create_guided_entry_v1",
  // Milestone 2
  BLUEPRINT_GENERATION_V1: "blueprint_generation_v1",
  VALIDATION_SPLIT_V1: "validation_split_v1",
  RECIPE_DETAIL_HIERARCHY_V1: "recipe_detail_hierarchy_v1",
  // Milestone 3
  COACH_LAYER_V1: "coach_layer_v1",
  RECIPE_DETAIL_PRECOOK_BLOCK_V1: "recipe_detail_precook_block_v1",
  COOK_MODE_CUES_V1: "cook_mode_cues_v1",
  COOK_MODE_RESCUE_V1: "cook_mode_rescue_v1",
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[keyof typeof FEATURE_FLAG_KEYS];

export async function getFeatureFlag(key: string, defaultValue = false): Promise<boolean> {
  const cached = flagCache.get(key);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAdminClient() as any;
  const { data, error } = (await supabase
    .from("feature_flags")
    .select("value")
    .eq("key", key)
    .maybeSingle()) as { data: { value: boolean } | null; error: { message: string } | null };

  if (error) {
    return defaultValue;
  }

  const value = typeof data?.value === "boolean" ? data.value : defaultValue;
  flagCache.set(key, { value, cachedAt: Date.now() });
  return value;
}

export async function setFeatureFlag(key: string, value: boolean): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createSupabaseAdminClient() as any;
  const { error } = (await supabase
    .from("feature_flags")
    .upsert({ key, value }, { onConflict: "key" })) as { error: { message: string } | null };

  if (error) {
    throw new Error(`Failed to set feature flag "${key}": ${error.message}`);
  }

  flagCache.set(key, { value, cachedAt: Date.now() });
}

export function invalidateFeatureFlagCache(key?: string) {
  if (key) {
    flagCache.delete(key);
  } else {
    flagCache.clear();
  }
}
