import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

const CACHE_TTL_MS = 60_000;

const flagCache = new Map<string, { value: boolean; cachedAt: number }>();

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
