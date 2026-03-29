import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { resolveIngredientPhrase } from "@/lib/ai/ingredientResolver";

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
  cooking_brief_json: {
    ingredients?: {
      required?: string[] | null;
      preferred?: string[] | null;
      forbidden?: string[] | null;
      provenance?: {
        required?: Array<Record<string, unknown>> | null;
        preferred?: Array<Record<string, unknown>> | null;
        forbidden?: Array<Record<string, unknown>> | null;
      } | null;
    } | null;
  } | null;
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

type CiaAdjudicationRow = {
  id: string;
  created_at: string;
  owner_id: string;
  flow: "home_create" | "recipe_improve" | "recipe_import";
  decision: "keep_failure" | "sanitize_constraints" | "return_structured_recipe" | "clarify_intent";
  adjudicator_source: "heuristic" | "ai" | "default";
  failure_kind: string;
  failure_stage: string | null;
  model: string | null;
  provider: string | null;
  packet_json: Record<string, unknown> | null;
  result_json: Record<string, unknown> | null;
};

export type CiaAdminFilters = {
  flow?: string | null;
  decision?: string | null;
  failureKind?: string | null;
  model?: string | null;
};

export type IngredientResolutionChainEntry = {
  slot: "required" | "preferred" | "forbidden";
  raw_phrase: string;
  core_phrase: string | null;
  display_label: string | null;
  canonical_key: string | null;
  family_key: string | null;
  confidence: number;
  resolution_method: string;
  applied_as: "hard_constraint" | "soft_preference" | "note_only";
};

function buildIngredientResolutionChain(
  cookingBrief: {
    ingredients?: {
      required?: string[] | null;
      preferred?: string[] | null;
      forbidden?: string[] | null;
    } | null;
  } | null
): IngredientResolutionChainEntry[] {
  if (!cookingBrief?.ingredients) return [];

  const chain: IngredientResolutionChainEntry[] = [];

  const slots: Array<{ slot: "required" | "preferred" | "forbidden"; phrases: string[] | null | undefined }> = [
    { slot: "required", phrases: cookingBrief.ingredients.required },
    { slot: "preferred", phrases: cookingBrief.ingredients.preferred },
    { slot: "forbidden", phrases: cookingBrief.ingredients.forbidden },
  ];

  for (const { slot, phrases } of slots) {
    for (const phrase of phrases ?? []) {
      const resolved = resolveIngredientPhrase(phrase);
      const applied_as: IngredientResolutionChainEntry["applied_as"] =
        resolved.confidence >= 0.9
          ? "hard_constraint"
          : resolved.confidence >= 0.75
          ? "soft_preference"
          : "note_only";
      chain.push({
        slot,
        raw_phrase: phrase,
        core_phrase: resolved.core_phrase,
        display_label: resolved.display_label,
        canonical_key: resolved.canonical_key,
        family_key: resolved.family_key,
        confidence: resolved.confidence,
        resolution_method: resolved.resolution_method,
        applied_as,
      });
    }
  }

  return chain;
}

export async function getAdminAiDebugEvents(filters?: CiaAdminFilters) {
  const admin = createSupabaseAdminClient();
  const [eventsResult, attemptsResult, ciaResult] = await Promise.all([
    admin
      .from("product_events")
      .select("id, owner_id, event_name, metadata_json, created_at")
      .in("event_name", ["chef_chat_repaired", "ai_route_failed", "ai_topic_guard_blocked"])
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("ai_generation_attempts")
      .select("id, created_at, owner_id, scope, outcome, provider, model, attempt_number, conversation_key, generator_payload_json, cooking_brief_json, verification_json, raw_model_output_json, normalized_recipe_json, stage_metrics_json")
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("ai_cia_adjudications")
      .select("id, created_at, owner_id, flow, decision, adjudicator_source, failure_kind, failure_stage, model, provider, packet_json, result_json")
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  if (eventsResult.error) {
    throw new Error(`Could not load AI debug events: ${eventsResult.error.message}`);
  }
  if (attemptsResult.error) {
    throw new Error(`Could not load AI generation attempts: ${attemptsResult.error.message}`);
  }
  if (ciaResult.error) {
    throw new Error(`Could not load CIA adjudications: ${ciaResult.error.message}`);
  }

  const events = (eventsResult.data ?? []) as ProductEventRow[];
  const generationAttempts = (attemptsResult.data ?? []) as GenerationAttemptRow[];
  const ciaAdjudications = (ciaResult.data ?? []) as CiaAdjudicationRow[];
  const filteredCiaAdjudications = ciaAdjudications.filter((item) => {
    if (filters?.flow && item.flow !== filters.flow) return false;
    if (filters?.decision && item.decision !== filters.decision) return false;
    if (filters?.failureKind && item.failure_kind !== filters.failureKind) return false;
    if (filters?.model && (item.model ?? "") !== filters.model) return false;
    return true;
  });
  const repairedEvents = events.filter((event) => event.event_name === "chef_chat_repaired");
  const failedEvents = events.filter((event) => event.event_name === "ai_route_failed");
  const blockedEvents = events.filter((event) => event.event_name === "ai_topic_guard_blocked");
  const ciaSanitized = filteredCiaAdjudications.filter((item) => item.decision === "sanitize_constraints");
  const ciaRecovered = filteredCiaAdjudications.filter((item) => item.decision === "return_structured_recipe");
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

  const topDroppedConstraints = Array.from(
    filteredCiaAdjudications.reduce((map, item) => {
      const result = item.result_json ?? {};
      const dropped = [
        ...(Array.isArray(result.dropRequiredIngredients) ? result.dropRequiredIngredients : []),
        ...(Array.isArray(result.dropRequiredNamedIngredients) ? result.dropRequiredNamedIngredients : []),
      ]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map((value) => value.trim().toLowerCase());
      for (const value of dropped) {
        map.set(value, (map.get(value) ?? 0) + 1);
      }
      return map;
    }, new Map<string, number>())
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, count]) => ({ label, count }));

  const averageCiaConfidence =
    filteredCiaAdjudications.length > 0
      ? filteredCiaAdjudications.reduce((sum, item) => {
          const confidence = item.result_json && typeof item.result_json.confidence === "number" ? item.result_json.confidence : 0;
          return sum + confidence;
        }, 0) / filteredCiaAdjudications.length
      : 0;

  // Build ingredient resolution chains for each attempt (derived at display time from stored brief)
  const attemptsWithResolution = generationAttempts.map((attempt) => {
    const brief = attempt.cooking_brief_json;
    const resolutionChain = buildIngredientResolutionChain(brief);
    return { ...attempt, ingredient_resolution_chain: resolutionChain };
  });

  return {
    events,
    generationAttempts: attemptsWithResolution,
    ciaAdjudications: filteredCiaAdjudications,
    repairedEvents,
    failedEvents,
    blockedEvents,
    ciaFilters: {
      applied: {
        flow: filters?.flow ?? null,
        decision: filters?.decision ?? null,
        failureKind: filters?.failureKind ?? null,
        model: filters?.model ?? null,
      },
      options: {
        flows: Array.from(new Set(ciaAdjudications.map((item) => item.flow))).sort(),
        decisions: Array.from(new Set(ciaAdjudications.map((item) => item.decision))).sort(),
        failureKinds: Array.from(new Set(ciaAdjudications.map((item) => item.failure_kind))).sort(),
        models: Array.from(new Set(ciaAdjudications.map((item) => item.model).filter((value): value is string => Boolean(value)))).sort(),
      },
      topDroppedConstraints,
    },
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
      ciaRunsLogged: filteredCiaAdjudications.length,
      ciaSanitizedLogged: ciaSanitized.length,
      ciaRecoveredLogged: ciaRecovered.length,
      averageCiaConfidence: Number(averageCiaConfidence.toFixed(2)),
      averageGenerationStageMs:
        generationDurations.length > 0
          ? Math.round(generationDurations.reduce((sum, value) => sum + value, 0) / generationDurations.length)
          : 0,
      recentGenerationCostUsd: Number(totalGenerationCost.toFixed(4)),
    },
  };
}
