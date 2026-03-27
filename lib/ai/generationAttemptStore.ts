import type { SupabaseClient } from "@supabase/supabase-js";
import type { GenerationAttempt } from "./contracts/generationAttempt";
import type { AiConversationScope } from "./briefStore";
import type { PreviousAttemptSnapshot } from "./contracts/orchestrationState";

export async function storeGenerationAttempt(
  supabase: SupabaseClient,
  input: {
    ownerId: string;
    conversationKey: string;
    scope: AiConversationScope;
    attempt: GenerationAttempt;
    recipeId?: string | null;
    versionId?: string | null;
    requestMode?: string | null;
    stateBefore?: string | null;
    stateAfter?: string | null;
  }
) {
  const { error } = await supabase.from("ai_generation_attempts").insert({
    owner_id: input.ownerId,
    conversation_key: input.conversationKey,
    scope: input.scope,
    recipe_id: input.recipeId ?? null,
    version_id: input.versionId ?? null,
    request_mode: input.requestMode ?? input.attempt.cooking_brief.request_mode,
    state_before: input.stateBefore ?? null,
    state_after: input.stateAfter ?? null,
    cooking_brief_json: input.attempt.cooking_brief,
    recipe_plan_json: input.attempt.recipe_plan,
    generator_payload_json: input.attempt.generator_input,
    raw_model_output_json: input.attempt.raw_model_output ?? null,
    normalized_recipe_json: input.attempt.normalized_recipe ?? null,
    verification_json: input.attempt.verification ?? null,
    stage_metrics_json: input.attempt.stage_metrics,
    provider: input.attempt.provider,
    model: input.attempt.model,
    attempt_number: input.attempt.attempt_number,
    outcome: input.attempt.outcome,
  });

  if (error) {
    console.warn("Could not persist generation attempt:", error.message);
  }
}

export async function getLatestGenerationAttempt(
  supabase: SupabaseClient,
  input: {
    ownerId: string;
    conversationKey: string;
    scope: AiConversationScope;
  }
): Promise<PreviousAttemptSnapshot> {
  const { data, error } = await supabase
    .from("ai_generation_attempts")
    .select("attempt_number, outcome, model, verification_json")
    .eq("owner_id", input.ownerId)
    .eq("conversation_key", input.conversationKey)
    .eq("scope", input.scope)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.warn("Could not load latest generation attempt:", error.message);
    }
    return null;
  }

  const verification = data.verification_json as
    | { failure_stage?: unknown; retry_strategy?: unknown }
    | null
    | undefined;

  return {
    attemptNumber: typeof data.attempt_number === "number" ? data.attempt_number : null,
    outcome: typeof data.outcome === "string" ? data.outcome : null,
    failureStage: typeof verification?.failure_stage === "string" ? verification.failure_stage : null,
    retryStrategy: typeof verification?.retry_strategy === "string" ? verification.retry_strategy : null,
    model: typeof data.model === "string" ? data.model : null,
  };
}
