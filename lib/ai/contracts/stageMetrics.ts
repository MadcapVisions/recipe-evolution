export const AI_RELIABILITY_STAGE_NAMES = [
  "brief_compile",
  "recipe_plan",
  "recipe_generate",
  "recipe_verify",
] as const;

export type AiReliabilityStageName = (typeof AI_RELIABILITY_STAGE_NAMES)[number];

export const AI_STAGE_CACHE_STATUSES = ["hit", "miss", "not_applicable"] as const;
export type AiStageCacheStatus = (typeof AI_STAGE_CACHE_STATUSES)[number];

export type AiStageMetric = {
  stage_name: AiReliabilityStageName;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost_usd: number | null;
  cache_status: AiStageCacheStatus;
  provider: string | null;
  model: string | null;
};

export type GenerationAttemptOutcome =
  | "passed"
  | "failed_verification"
  | "parse_failed"
  | "generation_failed"
  | "blocked";

export function createAiStageMetric(stageName: AiReliabilityStageName, input?: Partial<AiStageMetric>): AiStageMetric {
  const startedAt = input?.started_at ?? new Date().toISOString();
  const completedAt = input?.completed_at ?? null;
  const derivedDuration =
    input?.duration_ms ??
    (startedAt && completedAt ? Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime()) : null);
  return {
    stage_name: stageName,
    started_at: startedAt,
    completed_at: completedAt,
    duration_ms: derivedDuration,
    input_tokens: input?.input_tokens ?? null,
    output_tokens: input?.output_tokens ?? null,
    estimated_cost_usd: input?.estimated_cost_usd ?? null,
    cache_status: input?.cache_status ?? "not_applicable",
    provider: input?.provider ?? null,
    model: input?.model ?? null,
  };
}
