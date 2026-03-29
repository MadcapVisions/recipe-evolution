import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiConversationScope } from "./briefStore";
import type { CanonicalRecipeSessionState } from "./contracts/sessionState";

type SessionStateRow = {
  id: string;
  owner_id: string;
  conversation_key: string;
  scope: AiConversationScope;
  recipe_id: string | null;
  version_id: string | null;
  state_json: CanonicalRecipeSessionState;
  created_at: string;
  updated_at: string;
};

export async function upsertCanonicalSessionState(
  supabase: SupabaseClient,
  input: {
    ownerId: string;
    conversationKey: string;
    scope: AiConversationScope;
    recipeId?: string | null;
    versionId?: string | null;
    state: CanonicalRecipeSessionState;
  }
) {
  const { error } = await supabase.from("ai_recipe_session_states").upsert(
    {
      owner_id: input.ownerId,
      conversation_key: input.conversationKey,
      scope: input.scope,
      recipe_id: input.recipeId ?? null,
      version_id: input.versionId ?? null,
      state_json: input.state,
    },
    { onConflict: "owner_id,conversation_key,scope" }
  );

  if (error) {
    console.warn("Could not persist canonical recipe session state:", error.message);
  }
}

export async function getCanonicalSessionState(
  supabase: SupabaseClient,
  input: {
    ownerId: string;
    conversationKey: string;
    scope: AiConversationScope;
  }
): Promise<SessionStateRow | null> {
  const { data, error } = await supabase
    .from("ai_recipe_session_states")
    .select("id, owner_id, conversation_key, scope, recipe_id, version_id, state_json, created_at, updated_at")
    .eq("owner_id", input.ownerId)
    .eq("conversation_key", input.conversationKey)
    .eq("scope", input.scope)
    .maybeSingle();

  if (error) {
    console.warn("Could not load canonical recipe session state:", error.message);
    return null;
  }

  return (data as SessionStateRow | null) ?? null;
}

