import { parseJsonResponse } from "../jsonContract";
import { normalizeGeneratedRecipePayload } from "../recipeNormalization";
import { validateRecipeStructure } from "../recipeStructuralValidation";

export type RecipeFailureFixture = {
  id: string;
  raw_text: string;
  fallback_title: string;
  source?: {
    attempt_id?: string | null;
    created_at?: string | null;
    conversation_key?: string | null;
    attempt_number?: number | null;
  };
  observed?: {
    outcome?: string | null;
    failure_stage?: string | null;
    failure_context?: Record<string, unknown> | null;
  };
  expected: {
    parse_success: boolean;
    normalization_reason: string | null;
    structural_passes: boolean | null;
    title: string | null;
    outcome?: string | null;
    failure_stage?: string | null;
    failure_context?: Record<string, unknown> | null;
  };
};

export type RecipeFailureReplayResult = {
  parsed: unknown;
  parse_success: boolean;
  normalization_reason: string | null;
  normalized_title: string | null;
  structural_passes: boolean | null;
  derived_outcome: "parse_failed" | "schema_failed" | "passed";
  derived_failure_stage: "parse" | "schema" | null;
};

export function replayRecipeFailureFixture(fixture: RecipeFailureFixture): RecipeFailureReplayResult {
  const parsed = parseJsonResponse(fixture.raw_text);
  if (parsed == null) {
    return {
      parsed: null,
      parse_success: false,
      normalization_reason: null,
      normalized_title: null,
      structural_passes: null,
      derived_outcome: "parse_failed",
      derived_failure_stage: "parse",
    };
  }

  const normalized = normalizeGeneratedRecipePayload(parsed, fixture.fallback_title);
  if (!normalized.recipe) {
    return {
      parsed,
      parse_success: true,
      normalization_reason: normalized.reason,
      normalized_title: null,
      structural_passes: null,
      derived_outcome: "parse_failed",
      derived_failure_stage: "parse",
    };
  }

  const structural = validateRecipeStructure(normalized.recipe);
  return {
    parsed,
    parse_success: true,
    normalization_reason: normalized.reason,
    normalized_title: normalized.recipe.title,
    structural_passes: structural.passes,
    derived_outcome: structural.passes ? "passed" : "schema_failed",
    derived_failure_stage: structural.passes ? null : "schema",
  };
}
