import type { SupabaseClient } from "@supabase/supabase-js";

type ConversationScope = "home_hub" | "recipe_detail";
type ConversationRole = "user" | "assistant";
export type ConversationTurnRow = {
  id: string;
  owner_id: string;
  conversation_key: string;
  scope: ConversationScope;
  recipe_id: string | null;
  version_id: string | null;
  role: ConversationRole;
  message: string;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
};

export async function storeConversationTurns(
  supabase: SupabaseClient,
  input: {
    ownerId: string;
    conversationKey: string;
    scope: ConversationScope;
    recipeId?: string | null;
    versionId?: string | null;
    turns: Array<{
      role: ConversationRole;
      message: string;
      metadata_json?: Record<string, unknown> | null;
    }>;
  }
) {
  const rows = input.turns
    .map((turn) => ({
      owner_id: input.ownerId,
      conversation_key: input.conversationKey,
      scope: input.scope,
      recipe_id: input.recipeId ?? null,
      version_id: input.versionId ?? null,
      role: turn.role,
      message: turn.message.trim(),
      metadata_json: turn.metadata_json ?? null,
    }))
    .filter((row) => row.message.length > 0);

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase.from("ai_conversation_turns").insert(rows);
  if (error) {
    console.warn("Could not persist AI conversation turns:", error.message);
  }
}

export async function getConversationTurns(
  supabase: SupabaseClient,
  input: {
    ownerId: string;
    conversationKey: string;
    scope: ConversationScope;
    limit?: number;
  }
): Promise<ConversationTurnRow[]> {
  const { data, error } = await supabase
    .from("ai_conversation_turns")
    .select("id, owner_id, conversation_key, scope, recipe_id, version_id, role, message, metadata_json, created_at")
    .eq("owner_id", input.ownerId)
    .eq("conversation_key", input.conversationKey)
    .eq("scope", input.scope)
    .order("created_at", { ascending: true })
    .limit(input.limit ?? 120);

  if (error) {
    console.warn("Could not load AI conversation turns:", error.message);
    return [];
  }

  return (data as ConversationTurnRow[] | null) ?? [];
}
