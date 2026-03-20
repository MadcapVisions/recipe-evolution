import type { CookingBrief } from "./cookingBrief";
import type { RecipePlan } from "./recipePlan";
import type { AiStageMetric, GenerationAttemptOutcome } from "./stageMetrics";
import type { VerificationResult } from "./verificationResult";

export type GenerationAttempt = {
  conversation_snapshot: string;
  cooking_brief: CookingBrief;
  recipe_plan: RecipePlan | null;
  generator_input: Record<string, unknown>;
  raw_model_output: unknown;
  normalized_recipe: unknown;
  verification: VerificationResult | null;
  attempt_number: number;
  provider: string | null;
  model: string | null;
  outcome: GenerationAttemptOutcome;
  stage_metrics: AiStageMetric[];
};
