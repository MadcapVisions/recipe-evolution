import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AiCachePurpose = "structure" | "refine" | "home_ideas" | "home_recipe";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}

export function hashAiCacheInput(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export async function readAiCache<T>(
  supabase: SupabaseClient,
  userId: string,
  purpose: AiCachePurpose,
  inputHash: string
) {
  const { data, error } = await supabase
    .from("ai_cache")
    .select("response_json, created_at, model")
    .eq("owner_id", userId)
    .eq("purpose", purpose)
    .eq("input_hash", inputHash)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(`AI cache read failed for ${purpose}:`, error.message);
    return null;
  }

  return data as { response_json: T; created_at: string; model: string } | null;
}

export async function writeAiCache(
  supabase: SupabaseClient,
  userId: string,
  purpose: AiCachePurpose,
  inputHash: string,
  model: string,
  responseJson: unknown
) {
  const { error } = await supabase.from("ai_cache").upsert(
    {
      owner_id: userId,
      purpose,
      input_hash: inputHash,
      model,
      response_json: responseJson,
    },
    { onConflict: "owner_id,purpose,input_hash,model" }
  );

  if (error) {
    console.warn(`AI cache write failed for ${purpose}:`, error.message);
  }
}
