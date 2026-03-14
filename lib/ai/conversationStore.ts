import type { SupabaseClient } from "@supabase/supabase-js";

type ConversationScope = "home_hub" | "recipe_detail";
type ConversationRole = "user" | "assistant";

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
