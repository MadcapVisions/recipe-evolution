import type { SupabaseClient } from "@supabase/supabase-js";
import { signVersionPhotoUrls } from "@/lib/versionPhotoUrls";

export type VersionDetailData = {
  userId: string;
  recipe: {
    id: string;
    title: string;
    best_version_id?: string | null;
  };
  timelineVersions: Array<{
    id: string;
    version_number: number;
    version_label: string | null;
    created_at: string;
  }>;
  version: {
    id: string;
    recipe_id: string;
    version_number: number;
    version_label: string | null;
    change_summary: string | null;
    servings: number | null;
    prep_time_min: number | null;
    cook_time_min: number | null;
    difficulty: string | null;
    ingredients_json: unknown;
    steps_json: unknown;
    created_at: string;
  };
  photosWithUrls: Array<{ id: string; signedUrl: string; storagePath: string }>;
};

export async function loadVersionDetailData(
  supabase: SupabaseClient,
  userId: string,
  recipeId: string,
  versionId: string
): Promise<VersionDetailData | null> {
  const [
    { data: recipe, error: recipeError },
    { data: versions, error: versionsError },
    { data: version, error: versionError },
    { data: photos, error: photosError },
  ] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, title, best_version_id")
      .eq("id", recipeId)
      .eq("owner_id", userId)
      .maybeSingle(),
    supabase
      .from("recipe_versions")
      .select("id, version_number, version_label, created_at")
      .eq("recipe_id", recipeId)
      .order("version_number", { ascending: false }),
    supabase
      .from("recipe_versions")
      .select(
        "id, recipe_id, version_number, version_label, change_summary, servings, prep_time_min, cook_time_min, difficulty, ingredients_json, steps_json, created_at"
      )
      .eq("id", versionId)
      .eq("recipe_id", recipeId)
      .maybeSingle(),
    supabase
      .from("version_photos")
      .select("id, storage_path")
      .eq("version_id", versionId)
      .order("created_at", { ascending: false }),
  ]);

  if (
    recipeError ||
    versionsError ||
    versionError ||
    photosError ||
    !recipe ||
    !version
  ) {
    return null;
  }

  const signedPhotos = await signVersionPhotoUrls(supabase, photos ?? []);

  return {
    userId,
    recipe,
    timelineVersions: versions ?? [],
    version,
    photosWithUrls: signedPhotos,
  };
}
