import type { CookingBrief } from "./contracts/cookingBrief";
import type { RecipeOutline } from "./contracts/recipeOutline";
import type { RecipePlan } from "./contracts/recipePlan";

export function buildHomeRecipeAiMetadata(input: {
  outline: RecipeOutline;
  outlineSource: "ai" | "fallback";
  cookingBrief?: CookingBrief | null;
  recipePlan?: RecipePlan | null;
  retryContext?: {
    attemptNumber: number;
    retryStrategy: "regenerate_same_model" | "regenerate_stricter" | "try_fallback_model";
    reasons: string[];
    modelOverride?: string;
  } | null;
}) {
  return {
    pipeline_version: "outline_draft_v1",
    outline_source: input.outlineSource,
    recipe_outline: input.outline,
    brief_request_mode: input.cookingBrief?.request_mode ?? null,
    dish_family: input.cookingBrief?.dish.dish_family ?? input.recipePlan?.dish_family ?? null,
    primary_ingredient: input.outline.primary_ingredient ?? null,
    retry_context: input.retryContext
      ? {
          attempt_number: input.retryContext.attemptNumber,
          retry_strategy: input.retryContext.retryStrategy,
          reasons: input.retryContext.reasons,
          model_override: input.retryContext.modelOverride ?? null,
        }
      : null,
  };
}
