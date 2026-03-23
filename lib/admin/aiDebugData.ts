import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

type ProductEventRow = {
  id: string;
  event_name: string;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
  owner_id: string;
};

type GenerationAttemptRow = {
  id: string;
  created_at: string;
  owner_id: string;
  scope: string;
  outcome: string;
  provider: string | null;
  model: string | null;
  attempt_number: number;
  conversation_key: string;
  generator_payload_json: Record<string, unknown> | null;
  verification_json: {
    retry_strategy?: string | null;
    reasons?: string[] | null;
    failure_stage?: string | null;
    failure_context?: Record<string, unknown> | null;
  } | null;
  raw_model_output_json: unknown;
  normalized_recipe_json: {
    title?: string | null;
    ingredients?: Array<unknown> | null;
    steps?: Array<unknown> | null;
  } | null;
  stage_metrics_json: Array<{
    stage_name?: string | null;
    duration_ms?: number | null;
    input_tokens?: number | null;
    output_tokens?: number | null;
    estimated_cost_usd?: number | null;
  }> | null;
};

export async function getAdminAiDebugEvents() {
  const admin = createSupabaseAdminClient();
  const [eventsResult, attemptsResult] = await Promise.all([
    admin
      .from("product_events")
      .select("id, owner_id, event_name, metadata_json, created_at")
      .in("event_name", ["chef_chat_repaired", "ai_route_failed", "ai_topic_guard_blocked"])
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("ai_generation_attempts")
      .select("id, created_at, owner_id, scope, outcome, provider, model, attempt_number, conversation_key, generator_payload_json, verification_json, raw_model_output_json, normalized_recipe_json, stage_metrics_json")
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  if (eventsResult.error) {
    throw new Error(`Could not load AI debug events: ${eventsResult.error.message}`);
  }
  if (attemptsResult.error) {
    throw new Error(`Could not load AI generation attempts: ${attemptsResult.error.message}`);
  }

  const events = (eventsResult.data ?? []) as ProductEventRow[];
  const generationAttempts = (attemptsResult.data ?? []) as GenerationAttemptRow[];
  const repairedEvents = events.filter((event) => event.event_name === "chef_chat_repaired");
  const failedEvents = events.filter((event) => event.event_name === "ai_route_failed");
  const blockedEvents = events.filter((event) => event.event_name === "ai_topic_guard_blocked");
  const totalGenerationCost = generationAttempts.reduce((sum, attempt) => {
    const stageCost = (attempt.stage_metrics_json ?? []).reduce(
      (stageSum, stage) => stageSum + (typeof stage.estimated_cost_usd === "number" ? stage.estimated_cost_usd : 0),
      0
    );
    return sum + stageCost;
  }, 0);
  const generationDurations = generationAttempts.flatMap((attempt) =>
    (attempt.stage_metrics_json ?? [])
      .map((stage) => (typeof stage.duration_ms === "number" ? stage.duration_ms : null))
      .filter((value): value is number => value !== null)
  );
  const generationFailures = generationAttempts.filter((attempt) => attempt.outcome !== "passed");

  return {
    events,
    generationAttempts,
    repairedEvents,
    failedEvents,
    blockedEvents,
    stats: {
      repairsLogged: repairedEvents.length,
      failuresLogged: failedEvents.length,
      blockedLogged: blockedEvents.length,
      homeHubRepairs: repairedEvents.filter((event) => event.metadata_json?.route === "home-hub").length,
      averageFinalReplyLength:
        repairedEvents.length > 0
          ? Math.round(repairedEvents.reduce((sum, event) => sum + Number(event.metadata_json?.final_reply_length ?? 0), 0) / repairedEvents.length)
          : 0,
      recentGenerationAttempts: generationAttempts.length,
      recentGenerationFailures: generationFailures.length,
      averageGenerationStageMs:
        generationDurations.length > 0
          ? Math.round(generationDurations.reduce((sum, value) => sum + value, 0) / generationDurations.length)
          : 0,
      recentGenerationCostUsd: Number(totalGenerationCost.toFixed(4)),
    },
  };
}
