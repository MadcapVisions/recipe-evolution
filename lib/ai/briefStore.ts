import type { SupabaseClient } from "@supabase/supabase-js";
import type { CookingBrief } from "./contracts/cookingBrief";

export type AiConversationScope = "home_hub" | "recipe_detail";

type CookingBriefRow = {
  id: string;
  owner_id: string;
  conversation_key: string;
  scope: AiConversationScope;
  recipe_id: string | null;
  version_id: string | null;
  brief_json: CookingBrief;
  confidence: number | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
};

export async function upsertCookingBrief(
  supabase: SupabaseClient,
  input: {
    ownerId: string;
    conversationKey: string;
    scope: AiConversationScope;
    brief: CookingBrief;
    confidence?: number | null;
    isLocked?: boolean;
    recipeId?: string | null;
    versionId?: string | null;
  }
) {
  const { error } = await supabase.from("ai_cooking_briefs").upsert(
    {
      owner_id: input.ownerId,
      conversation_key: input.conversationKey,
      scope: input.scope,
      recipe_id: input.recipeId ?? null,
      version_id: input.versionId ?? null,
      brief_json: input.brief,
      confidence: input.confidence ?? input.brief.confidence ?? null,
      is_locked: input.isLocked ?? (input.brief.request_mode === "locked" || input.brief.request_mode === "generate"),
    },
    {
      onConflict: "owner_id,conversation_key,scope",
    }
  );

  if (error) {
    console.warn("Could not persist cooking brief:", error.message);
  }
}

export async function getCookingBrief(
  supabase: SupabaseClient,
  input: {
    ownerId: string;
    conversationKey: string;
    scope: AiConversationScope;
  }
): Promise<CookingBriefRow | null> {
  const { data, error } = await supabase
    .from("ai_cooking_briefs")
    .select("id, owner_id, conversation_key, scope, recipe_id, version_id, brief_json, confidence, is_locked, created_at, updated_at")
    .eq("owner_id", input.ownerId)
    .eq("conversation_key", input.conversationKey)
    .eq("scope", input.scope)
    .maybeSingle();

  if (error) {
    console.warn("Could not load cooking brief:", error.message);
    return null;
  }

  return (data as CookingBriefRow | null) ?? null;
}
