// lib/recipes/resurfacingData.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostCookOverallOutcome } from "@/lib/ai/feedback/postCookFeedbackTypes";

export type ResurfacingSuggestion = {
  recipeId: string;
  versionId: string;
  title: string;
  outcome: PostCookOverallOutcome;
  cookedAt: string;
};

export type ResurfacingData = {
  worthRepeating: ResurfacingSuggestion[];
  needsImprovement: ResurfacingSuggestion[];
};

type FeedbackRow = {
  recipe_id: string;
  version_id: string;
  overall_outcome: string;
  created_at: string;
  recipes: { title: string } | null;
};

function toSuggestion(row: FeedbackRow): ResurfacingSuggestion | null {
  if (!row.recipes?.title) return null;
  return {
    recipeId: row.recipe_id,
    versionId: row.version_id,
    title: row.recipes.title,
    outcome: row.overall_outcome as PostCookOverallOutcome,
    cookedAt: row.created_at,
  };
}

/**
 * Fetches post-cook feedback rows to populate smart library shelves.
 * Returns empty arrays gracefully for users with no cook history.
 */
export async function getResurfacingData(
  supabase: SupabaseClient,
  ownerId: string
): Promise<ResurfacingData> {
  const [worthResult, needsResult] = await Promise.all([
    supabase
      .from("recipe_postcook_feedback")
      .select("recipe_id, version_id, overall_outcome, created_at, recipes(title)")
      .eq("owner_id", ownerId)
      .in("overall_outcome", ["great", "good_with_changes"])
      .eq("would_make_again", true)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("recipe_postcook_feedback")
      .select("recipe_id, version_id, overall_outcome, created_at, recipes(title)")
      .eq("owner_id", ownerId)
      .in("overall_outcome", ["disappointing", "failed"])
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const worthRepeating = (worthResult.data ?? [])
    .map((r) => toSuggestion(r as unknown as FeedbackRow))
    .filter((s): s is ResurfacingSuggestion => s !== null);

  const needsImprovement = (needsResult.data ?? [])
    .map((r) => toSuggestion(r as unknown as FeedbackRow))
    .filter((s): s is ResurfacingSuggestion => s !== null);

  return { worthRepeating, needsImprovement };
}
