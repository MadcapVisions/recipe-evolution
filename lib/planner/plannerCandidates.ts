import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getLearnedSignals, type LearnedSignals } from "@/lib/ai/learnedSignals";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { readCanonicalIngredients, readCanonicalSteps } from "@/lib/recipes/canonicalRecipe";
import type { PlannerCandidate, PlannerEffortLevel, PlannerLifecycleState } from "@/lib/planner/plannerEngine";
import {
  getVersionPlanningEligibility,
  type ExplicitDraftState,
  type PlanningEligibilityReason,
  type PlanningEligibilityState,
} from "@/lib/planner/versionPlanningEligibility";

type RecipeRow = {
  id: string;
  title: string;
  tags: string[] | null;
  updated_at: string | null;
  is_favorite: boolean | null;
  best_version_id: string | null;
  dish_family: string | null;
};

type VersionRow = {
  id: string;
  recipe_id: string;
  version_number: number;
  version_label: string | null;
  servings: number | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  difficulty: string | null;
  ingredients_json: unknown;
  steps_json: unknown;
  ai_metadata_json?: unknown;
};

type ScoreRow = {
  recipe_version_id: string;
  total_score: number | null;
};

type FeedbackRow = {
  recipe_id: string;
  recipe_version_id: string;
  overall_outcome: string;
  would_make_again: boolean | null;
  issues: string[] | null;
  created_at: string;
};

function isMissingPostCookFeedbackTableError(message: string | null | undefined) {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("recipe_postcook_feedback") &&
    (normalized.includes("schema cache") ||
      normalized.includes("could not find the table") ||
      normalized.includes("does not exist"))
  );
}

export type PlannerCandidateRecord = PlannerCandidate & {
  recipeTitle: string;
  versionLabel: string | null;
  versionNumber: number;
  servings: number | null;
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  difficulty: string | null;
  tags: string[];
  planningEligibility: PlanningEligibilityState;
  planningEligibilityReason: PlanningEligibilityReason;
};

export type PlannerCandidateLoadResult = {
  candidates: PlannerCandidateRecord[];
  learnedSignals: LearnedSignals;
};

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function ingredientKey(value: string) {
  return normalizeToken(value)
    .replace(/^\d+(?:[./]\d+)?\s+/u, "")
    .replace(/^(cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|lb|pound|oz|ounce|ounces)\s+/u, "")
    .trim();
}

function inferEffort(input: {
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  difficulty: string | null;
}): PlannerEffortLevel {
  const total = (input.prepTimeMin ?? 0) + (input.cookTimeMin ?? 0);
  const difficulty = input.difficulty?.toLowerCase() ?? "";

  if (difficulty.includes("hard") || difficulty.includes("advanced") || total >= 75) {
    return "high";
  }
  if (difficulty.includes("easy") || difficulty.includes("beginner") || total <= 30) {
    return "low";
  }
  return "medium";
}

function inferLifecycleState(recipe: RecipeRow, version: VersionRow): PlannerLifecycleState {
  if (recipe.best_version_id && recipe.best_version_id === version.id) {
    return "kept";
  }

  const metadata =
    version.ai_metadata_json && typeof version.ai_metadata_json === "object"
      ? (version.ai_metadata_json as Record<string, unknown>)
      : null;

  const lifecycle =
    metadata && typeof metadata.lifecycle_state === "string"
      ? metadata.lifecycle_state.toLowerCase()
      : null;

  if (lifecycle === "draft") {
    return "draft";
  }

  if (lifecycle === "kept") {
    return "kept";
  }

  return "unknown";
}

function inferExplicitDraftState(recipe: RecipeRow, version: VersionRow): ExplicitDraftState {
  const lifecycle = inferLifecycleState(recipe, version);
  if (lifecycle === "draft") {
    return "draft";
  }
  if (lifecycle === "kept") {
    return "non_draft";
  }
  return "unknown";
}

function deriveLearnedScore(signals: LearnedSignals, recipe: RecipeRow, version: VersionRow) {
  if (signals.patterns.length === 0) {
    return 0;
  }

  const haystack = normalizeToken(
    [recipe.title, recipe.dish_family, ...(recipe.tags ?? []), version.version_label ?? ""].filter(Boolean).join(" ")
  );

  let score = 0;
  for (const pattern of signals.patterns) {
    const key = pattern.key.replace(/^prefers_/, "").replace(/_/g, " ");
    if (!key || !haystack.includes(key)) {
      continue;
    }
    score += pattern.direction === "positive" ? 0.35 : -0.35;
  }

  return Math.max(-1, Math.min(1, score));
}

function summarizeFeedback(rows: FeedbackRow[]) {
  const sorted = [...rows].sort((left, right) => right.created_at.localeCompare(left.created_at));
  const latest = sorted[0] ?? null;
  const recentGood = sorted.filter((row) => row.overall_outcome === "great" || row.overall_outcome === "good_with_changes").length;
  const recentNegative = sorted.filter((row) => row.overall_outcome === "disappointing" || row.overall_outcome === "failed").length;
  const complexityComplaintCount = sorted.reduce((count, row) => {
    const issues = row.issues ?? [];
    return count + issues.filter((issue) => issue === "too_many_steps" || issue === "too_complex").length;
  }, 0);

  return {
    wouldMakeAgain: latest?.would_make_again ?? null,
    hasRecentNegativeOutcome:
      recentNegative > 0 || latest?.would_make_again === false || latest?.overall_outcome === "failed" || latest?.overall_outcome === "disappointing",
    repeatScore: Math.max(-1, Math.min(1, recentGood * 0.35 - recentNegative * 0.4 + (latest?.would_make_again === true ? 0.35 : 0))),
    complexityComplaintCount,
  };
}

function normalizedTrustScore(input: {
  qualityScore: number | null;
  repeatScore: number;
  isFavorite: boolean;
  hasStrongNegativeOutcome: boolean;
}) {
  let score = 0;
  if (typeof input.qualityScore === "number") {
    score += Math.max(0, Math.min(1, (input.qualityScore - 70) / 20));
  }
  score += Math.max(-0.3, Math.min(0.35, input.repeatScore * 0.5));
  if (input.isFavorite) {
    score += 0.15;
  }
  if (input.hasStrongNegativeOutcome) {
    score -= 0.5;
  }
  return Math.max(0, Math.min(1, score));
}

type VersionSelection = {
  version: VersionRow;
  planningEligibility: PlanningEligibilityState;
  planningEligibilityReason: PlanningEligibilityReason;
  trustScore: number;
  lifecycle: PlannerLifecycleState;
  feedbackSummary: ReturnType<typeof summarizeFeedback>;
};

function selectPlannerVersion(
  recipe: RecipeRow,
  versions: VersionRow[],
  scoreByVersionId: Map<string, number | null>,
  feedbackByVersionId: Map<string, FeedbackRow[]>
): VersionSelection | null {
  const sorted = [...versions].sort((left, right) => right.version_number - left.version_number);
  const evaluationCache = new Map<string, ReturnType<typeof summarizeFeedback>>();
  const feedbackSummaryFor = (versionId: string) => {
    const cached = evaluationCache.get(versionId);
    if (cached) {
      return cached;
    }
    const summary = summarizeFeedback(feedbackByVersionId.get(versionId) ?? []);
    evaluationCache.set(versionId, summary);
    return summary;
  };

  const evaluations = sorted.map((version) => {
    const explicitDraftState = inferExplicitDraftState(recipe, version);
    const feedbackSummary = feedbackSummaryFor(version.id);
    const trustScore = normalizedTrustScore({
      qualityScore: scoreByVersionId.get(version.id) ?? null,
      repeatScore: feedbackSummary.repeatScore,
      isFavorite: recipe.is_favorite === true,
      hasStrongNegativeOutcome: feedbackSummary.hasRecentNegativeOutcome,
    });
    const hasStrongerOlderViableVersion = sorted.some((other) => {
      if (other.version_number >= version.version_number) {
        return false;
      }
      if (inferExplicitDraftState(recipe, other) !== "non_draft") {
        return false;
      }
      const otherFeedback = feedbackSummaryFor(other.id);
      const otherTrust = normalizedTrustScore({
        qualityScore: scoreByVersionId.get(other.id) ?? null,
        repeatScore: otherFeedback.repeatScore,
        isFavorite: recipe.is_favorite === true,
        hasStrongNegativeOutcome: otherFeedback.hasRecentNegativeOutcome,
      });
      return otherTrust > trustScore;
    });
    const isFreshUnstableBranch =
      version.version_number === sorted[0]?.version_number &&
      explicitDraftState === "unknown" &&
      !recipe.best_version_id &&
      feedbackSummary.repeatScore <= 0 &&
      (scoreByVersionId.get(version.id) ?? null) == null;

    const planning = getVersionPlanningEligibility({
      explicitDraftState,
      isBestVersion: recipe.best_version_id === version.id,
      trustScore,
      hasStrongNegativeOutcome: feedbackSummary.hasRecentNegativeOutcome,
      hasStrongerOlderViableVersion,
      isFreshUnstableBranch,
    });

    return {
      version,
      planningEligibility: planning.state,
      planningEligibilityReason: planning.reason,
      trustScore,
      lifecycle: inferLifecycleState(recipe, version),
      feedbackSummary,
    };
  });

  const eligible = evaluations
    .filter((item) => item.planningEligibility === "eligible")
    .sort((left, right) => right.trustScore - left.trustScore)[0];
  if (eligible) {
    return eligible;
  }

  return evaluations
    .filter((item) => item.planningEligibility === "cautionary")
    .sort((left, right) => right.trustScore - left.trustScore)[0] ?? null;
}

export async function loadPlannerCandidates(
  ownerId: string,
  options?: {
    supabase?: SupabaseClient;
    limit?: number;
  }
): Promise<PlannerCandidateLoadResult> {
  const supabase = options?.supabase ?? (await createSupabaseServerClient());
  const limit = options?.limit ?? 80;

  const [{ data: visibilityStates, error: visibilityError }, { data: recipes, error: recipeError }, learnedSignals] =
    await Promise.all([
      supabase.from("recipe_visibility_states").select("recipe_id, state").eq("owner_id", ownerId),
      supabase
        .from("recipes")
        .select("id, title, tags, updated_at, is_favorite, best_version_id, dish_family")
        .eq("owner_id", ownerId)
        .order("updated_at", { ascending: false })
        .limit(limit),
      getLearnedSignals(supabase, ownerId),
    ]);

  if (visibilityError) {
    throw new Error(visibilityError.message);
  }
  if (recipeError) {
    throw new Error(recipeError.message);
  }

  const hiddenIds = new Set((visibilityStates ?? []).filter((item) => item.state === "hidden" || item.state === "archived").map((item) => item.recipe_id));
  const activeRecipes = ((recipes ?? []) as RecipeRow[]).filter((recipe) => !hiddenIds.has(recipe.id));
  const recipeIds = activeRecipes.map((recipe) => recipe.id);

  if (recipeIds.length === 0) {
    return { candidates: [], learnedSignals };
  }

  const [{ data: versions, error: versionError }, { data: scores, error: scoresError }, { data: feedback, error: feedbackError }] =
    await Promise.all([
      supabase
        .from("recipe_versions")
        .select("id, recipe_id, version_number, version_label, servings, prep_time_min, cook_time_min, difficulty, ingredients_json, steps_json, ai_metadata_json")
        .in("recipe_id", recipeIds)
        .order("version_number", { ascending: false }),
      supabase
        .from("recipe_scores")
        .select("recipe_version_id, total_score")
        .in(
          "recipe_version_id",
          recipeIds.length > 0
            ? activeRecipes.flatMap((recipe) => (recipe.best_version_id ? [recipe.best_version_id] : []))
            : []
        ),
      supabase
        .from("recipe_postcook_feedback")
        .select("recipe_id, recipe_version_id, overall_outcome, would_make_again, issues, created_at")
        .eq("user_id", ownerId)
        .in("recipe_id", recipeIds)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

  if (versionError) {
    throw new Error(versionError.message);
  }
  if (scoresError) {
    throw new Error(scoresError.message);
  }
  if (feedbackError && !isMissingPostCookFeedbackTableError(feedbackError.message)) {
    throw new Error(feedbackError.message);
  }

  const versionsByRecipeId = new Map<string, VersionRow[]>();
  for (const version of (versions ?? []) as VersionRow[]) {
    const current = versionsByRecipeId.get(version.recipe_id) ?? [];
    current.push(version);
    versionsByRecipeId.set(version.recipe_id, current);
  }

  const allVersionIds = ((versions ?? []) as VersionRow[]).map((version) => version.id);
  let scoreByVersionId = new Map<string, number | null>(((scores ?? []) as ScoreRow[]).map((row) => [row.recipe_version_id, row.total_score]));

  if (allVersionIds.length > 0) {
    const missingScoreIds = allVersionIds.filter((id) => !scoreByVersionId.has(id));
    if (missingScoreIds.length > 0) {
      const { data: additionalScores, error: additionalScoreError } = await supabase
        .from("recipe_scores")
        .select("recipe_version_id, total_score")
        .in("recipe_version_id", missingScoreIds);

      if (additionalScoreError) {
        throw new Error(additionalScoreError.message);
      }

      scoreByVersionId = new Map([
        ...scoreByVersionId.entries(),
        ...(((additionalScores ?? []) as ScoreRow[]).map((row) => [row.recipe_version_id, row.total_score] as const)),
      ]);
    }
  }

  const feedbackByVersionId = new Map<string, FeedbackRow[]>();
  for (const row of (feedback ?? []) as FeedbackRow[]) {
    const current = feedbackByVersionId.get(row.recipe_version_id) ?? [];
    current.push(row);
    feedbackByVersionId.set(row.recipe_version_id, current);
  }

  const candidates: PlannerCandidateRecord[] = [];
  for (const recipe of activeRecipes) {
    const versionsForRecipe = versionsByRecipeId.get(recipe.id) ?? [];
    const selectedVersion = selectPlannerVersion(recipe, versionsForRecipe, scoreByVersionId, feedbackByVersionId);

    if (!selectedVersion) {
      continue;
    }

    const ingredients = readCanonicalIngredients(selectedVersion.version.ingredients_json);
    const steps = readCanonicalSteps(selectedVersion.version.steps_json);
    const ingredientKeys = Array.from(
      new Set(
        ingredients
          .map((ingredient) => ingredientKey(ingredient.name))
          .filter((value) => value.length > 0)
      )
    );
    const feedbackSummary = selectedVersion.feedbackSummary;

    candidates.push({
      recipeId: recipe.id,
      versionId: selectedVersion.version.id,
      title: recipe.title,
      recipeTitle: recipe.title,
      versionLabel: selectedVersion.version.version_label,
      versionNumber: selectedVersion.version.version_number,
      servings: selectedVersion.version.servings,
      prepTimeMin: selectedVersion.version.prep_time_min,
      cookTimeMin: selectedVersion.version.cook_time_min,
      difficulty: selectedVersion.version.difficulty,
      tags: recipe.tags ?? [],
      lifecycle: selectedVersion.lifecycle,
      planningEligibility: selectedVersion.planningEligibility,
      effort: inferEffort({
        prepTimeMin: selectedVersion.version.prep_time_min,
        cookTimeMin: selectedVersion.version.cook_time_min,
        difficulty: selectedVersion.version.difficulty,
      }),
      qualityScore: scoreByVersionId.get(selectedVersion.version.id) ?? null,
      learnedScore: deriveLearnedScore(learnedSignals, recipe, selectedVersion.version),
      repeatScore: feedbackSummary.repeatScore,
      overlapScore: 0,
      isFavorite: recipe.is_favorite === true,
      wouldMakeAgain: feedbackSummary.wouldMakeAgain,
      hasRecentNegativeOutcome: feedbackSummary.hasRecentNegativeOutcome,
      complexityComplaintCount: feedbackSummary.complexityComplaintCount,
      ingredientKeys,
      sharedPrepKeys: [],
      cuisineKey: recipe.dish_family,
      proteinKey:
        ingredientKeys.find((key) =>
          ["chicken", "beef", "pork", "tofu", "bean", "beans", "fish", "shrimp", "salmon", "egg"].includes(key)
        ) ?? null,
      planningEligibilityReason: selectedVersion.planningEligibilityReason,
    });
  }

  return {
    candidates: candidates.sort((left, right) => {
      const favoriteDelta = Number(right.isFavorite) - Number(left.isFavorite);
      if (favoriteDelta !== 0) return favoriteDelta;
      return (right.qualityScore ?? 0) - (left.qualityScore ?? 0);
    }),
    learnedSignals,
  };
}

export const __plannerCandidateInternals = {
  deriveLearnedScore,
  inferExplicitDraftState,
  inferEffort,
  inferLifecycleState,
  isMissingPostCookFeedbackTableError,
  normalizedTrustScore,
  selectPlannerVersion,
  summarizeFeedback,
};
