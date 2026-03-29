import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiConversationScope } from "./briefStore";
import type { FailureAdjudication } from "./failureAdjudicator";

export async function storeCiaAdjudication(
  supabase: SupabaseClient,
  input: {
    ownerId: string;
    flow: "home_create" | "recipe_improve" | "recipe_import";
    taskKey: "recipe_cia";
    parentTaskKey?: string | null;
    failureKind: string;
    failureStage?: string | null;
    conversationKey?: string | null;
    scope?: AiConversationScope | null;
    recipeId?: string | null;
    versionId?: string | null;
    model?: string | null;
    provider?: string | null;
    packet: Record<string, unknown>;
    adjudication: FailureAdjudication;
  }
) {
  const { error } = await supabase.from("ai_cia_adjudications").insert({
    owner_id: input.ownerId,
    conversation_key: input.conversationKey ?? null,
    scope: input.scope ?? null,
    recipe_id: input.recipeId ?? null,
    version_id: input.versionId ?? null,
    flow: input.flow,
    task_key: input.taskKey,
    parent_task_key: input.parentTaskKey ?? null,
    failure_kind: input.failureKind,
    failure_stage: input.failureStage ?? null,
    adjudicator_source: input.adjudication.adjudicatorSource,
    decision: input.adjudication.decision,
    confidence: input.adjudication.confidence,
    summary: input.adjudication.summary,
    retry_strategy: input.adjudication.retryStrategy,
    provider: input.provider ?? null,
    model: input.model ?? null,
    packet_json: input.packet,
    result_json: input.adjudication,
  });

  if (error) {
    console.warn("Could not persist CIA adjudication:", error.message);
  }
}
