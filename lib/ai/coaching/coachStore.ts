import type { SupabaseClient } from "@supabase/supabase-js";
import type { CookingCoach } from "./coachTypes";

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Persist a CookingCoach artifact for a saved recipe version.
 *
 * Upserts on recipe_version_id — safe to call multiple times for the same
 * version (e.g. on retry). Follows chefScoreStore.ts persistence patterns.
 *
 * Important: only call when a stable recipe_version_id exists.
 * Request-only builds without a saved version should not produce coach rows.
 *
 * Persistence failure is logged but does not propagate — never corrupts the
 * core recipe save behavior.
 */
export async function persistCoachArtifact(
  supabase: SupabaseClient,
  params: {
    recipeVersionId: string;
    userId: string;
    coach: CookingCoach;
  }
): Promise<void> {
  const { recipeVersionId, userId, coach } = params;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("recipe_coach_layers")
      .upsert(
        {
          recipe_version_id: recipeVersionId,
          user_id: userId,
          coach_json: coach,
        },
        { onConflict: "recipe_version_id" }
      );
    if (error) {
      console.error("[coachStore] persistCoachArtifact error:", error);
    }
  } catch (err) {
    console.error("[coachStore] persistCoachArtifact unexpected error:", err);
  }
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * Load a CookingCoach artifact for a recipe version.
 *
 * Returns null when no coaching sidecar exists — callers must handle absence
 * gracefully (coach data is optional; absence must not break any page load).
 */
export async function loadCoachArtifact(
  supabase: SupabaseClient,
  params: {
    recipeVersionId: string;
    userId: string;
  }
): Promise<CookingCoach | null> {
  const { recipeVersionId, userId } = params;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("recipe_coach_layers")
      .select("coach_json")
      .eq("recipe_version_id", recipeVersionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[coachStore] loadCoachArtifact error:", error);
      return null;
    }
    if (!data) return null;
    return data.coach_json as CookingCoach;
  } catch (err) {
    console.error("[coachStore] loadCoachArtifact unexpected error:", err);
    return null;
  }
}
