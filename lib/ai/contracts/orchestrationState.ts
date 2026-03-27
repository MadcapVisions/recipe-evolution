import type { CookingBrief } from "./cookingBrief";
import type { VerificationRetryStrategy } from "./verificationResult";

export type RecipeWorkflowFlow = "home_hub_build" | "recipe_detail_improve";

export type RecipeWorkflowAction =
  | "build_recipe"
  | "suggest_recipe_update"
  | "reply_only"
  | "provide_options"
  | "ask_clarifying_question";

export type PreviousAttemptSnapshot = {
  attemptNumber: number | null;
  outcome: string | null;
  failureStage: string | null;
  retryStrategy: string | null;
  model: string | null;
} | null;

export type AttemptOrchestrationState = {
  flow: RecipeWorkflowFlow;
  action: RecipeWorkflowAction;
  intent: string | null;
  buildable: boolean;
  conversationKey: string | null;
  recipeId: string | null;
  versionId: string | null;
  attemptNumber: number;
  requestMode: string | null;
  normalizedInstruction: string | null;
  stateBefore: string | null;
  stateAfter: string | null;
  usedSessionRecovery: boolean;
  usedFallbackModel: boolean;
  failureStage: string | null;
  retryStrategy: VerificationRetryStrategy | "none";
  recoveryActions: string[];
  reason: string | null;
  reasonCodes: string[];
  model: string | null;
  previousAttempt: PreviousAttemptSnapshot;
  sessionConstraintSummary: {
    dish_family: string | null;
    equipment_limits: string[];
    required_techniques: string[];
    required_ingredient_names: string[];
  } | null;
};

export function summarizeBriefConstraints(brief: CookingBrief | null | undefined) {
  if (!brief) {
    return null;
  }

  return {
    dish_family: brief.dish.dish_family ?? null,
    equipment_limits: [...brief.constraints.equipment_limits],
    required_techniques: [...brief.directives.required_techniques],
    required_ingredient_names: (brief.ingredients.requiredNamedIngredients ?? []).map(
      (ingredient) => ingredient.normalizedName
    ),
  };
}
