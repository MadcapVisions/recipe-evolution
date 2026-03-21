import type { SupabaseClient } from "@supabase/supabase-js";
import type { LockedDirectionSession } from "./contracts/lockedDirectionSession";
import type { AiConversationScope } from "./briefStore";

type LockedDirectionSessionRow = {
  id: string;
  owner_id: string;
  conversation_key: string;
  scope: AiConversationScope;
  session_json: LockedDirectionSession;
  state: string;
  created_at: string;
  updated_at: string;
};

export async function upsertLockedDirectionSession(
  supabase: SupabaseClient,
  input: {
    ownerId: string;
    conversationKey: string;
    scope: AiConversationScope;
    session: LockedDirectionSession;
  }
) {
  const { error } = await supabase.from("ai_locked_direction_sessions").upsert(
    {
      owner_id: input.ownerId,
      conversation_key: input.conversationKey,
      scope: input.scope,
      state: input.session.state,
      session_json: input.session,
    },
    {
      onConflict: "owner_id,conversation_key,scope",
    }
  );

  if (error) {
    console.warn("Could not persist locked direction session:", error.message);
  }
}

export async function getLockedDirectionSession(
  supabase: SupabaseClient,
  input: {
    ownerId: string;
    conversationKey: string;
    scope: AiConversationScope;
  }
): Promise<LockedDirectionSessionRow | null> {
  const { data, error } = await supabase
    .from("ai_locked_direction_sessions")
    .select("id, owner_id, conversation_key, scope, session_json, state, created_at, updated_at")
    .eq("owner_id", input.ownerId)
    .eq("conversation_key", input.conversationKey)
    .eq("scope", input.scope)
    .maybeSingle();

  if (error) {
    console.warn("Could not load locked direction session:", error.message);
    return null;
  }

  return (data as LockedDirectionSessionRow | null) ?? null;
}

export async function deleteLockedDirectionSession(
  supabase: SupabaseClient,
  input: {
    ownerId: string;
    conversationKey: string;
    scope: AiConversationScope;
  }
) {
  const { error } = await supabase
    .from("ai_locked_direction_sessions")
    .delete()
    .eq("owner_id", input.ownerId)
    .eq("conversation_key", input.conversationKey)
    .eq("scope", input.scope);

  if (error) {
    console.warn("Could not delete locked direction session:", error.message);
  }
}
