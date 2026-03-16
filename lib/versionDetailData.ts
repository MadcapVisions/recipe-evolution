import type { SupabaseClient } from "@supabase/supabase-js";
import { signVersionPhotoUrls } from "@/lib/versionPhotoUrls";
import { loadRecipeSidebarRecentRecipes } from "@/lib/recipeSidebarData";
import type { RecipeListItem, TimelineVersion } from "@/components/recipes/version-detail/types";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { readCanonicalIngredients } from "@/lib/recipes/canonicalRecipe";
import { getStockRecipeCover } from "@/lib/stockRecipeCovers";

const INITIAL_TIMELINE_LIMIT = 8;

export async function loadRecipeTimelineSlice(
  supabase: SupabaseClient,
  recipeId: string,
  currentVersionId: string,
  input: {
    limit: number;
    offset?: number;
  }
): Promise<{ versions: TimelineVersion[]; hasMore: boolean } | null> {
  const offset = input.offset ?? 0;
  const fetchLimit = Math.max(input.limit, 1) + 1;
  const { data, error } = await supabase
    .from("recipe_versions")
    .select("id, version_number, version_label, change_summary, created_at")
    .eq("recipe_id", recipeId)
    .order("version_number", { ascending: false })
    .range(offset, offset + fetchLimit - 1);

  if (error) {
    return null;
  }

  const pageVersions = (data ?? []) as TimelineVersion[];
  const hasMore = pageVersions.length > input.limit;
  const trimmed = pageVersions.slice(0, input.limit);

  if (offset > 0 || trimmed.some((version) => version.id === currentVersionId)) {
    return { versions: trimmed, hasMore };
  }

  const { data: currentVersion, error: currentVersionError } = await supabase
    .from("recipe_versions")
    .select("id, version_number, version_label, change_summary, created_at")
    .eq("id", currentVersionId)
    .eq("recipe_id", recipeId)
    .maybeSingle();

  if (currentVersionError || !currentVersion) {
    return null;
  }

  const deduped = [currentVersion as TimelineVersion, ...trimmed].filter(
    (version, index, list) => list.findIndex((candidate) => candidate.id === version.id) === index
  );

  deduped.sort((a, b) => b.version_number - a.version_number);
  return { versions: deduped, hasMore: true };
}

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
    change_summary?: string | null;
    created_at: string;
  }>;
  timelineHasMore: boolean;
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
    canonical_ingredients: unknown;
    canonical_steps: unknown;
    created_at: string;
  };
  initialPhotosWithUrls: Array<{ id: string; signedUrl: string; storagePath: string }>;
  stockCoverUrl: string | null;
  sidebarRecentRecipes: RecipeListItem[];
};

export async function loadVersionPhotosWithUrls(
  supabase: SupabaseClient,
  versionId: string,
  input?: { limit?: number }
): Promise<Array<{ id: string; signedUrl: string; storagePath: string }> | null> {
  const query = supabase
    .from("version_photos")
    .select("id, storage_path")
    .eq("version_id", versionId)
    .order("created_at", { ascending: false });

  const { data: photos, error: photosError } =
    typeof input?.limit === "number" ? await query.limit(input.limit) : await query;

  if (photosError) {
    return null;
  }

  return signVersionPhotoUrls(supabase, photos ?? []);
}

export async function loadVersionDetailData(
  supabase: SupabaseClient,
  userId: string,
  recipeId: string,
  versionId: string
): Promise<VersionDetailData | null> {
  const [
    { data: recipe, error: recipeError },
    timelineSlice,
    { data: version, error: versionError },
    initialPhotos,
    recentRecipes,
  ] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, title, tags, best_version_id")
      .eq("id", recipeId)
      .eq("owner_id", userId)
      .maybeSingle(),
    loadRecipeTimelineSlice(supabase, recipeId, versionId, { limit: INITIAL_TIMELINE_LIMIT }),
    supabase
      .from("recipe_versions")
      .select(
        "id, recipe_id, version_number, version_label, change_summary, servings, prep_time_min, cook_time_min, difficulty, ingredients_json, steps_json, created_at"
      )
      .eq("id", versionId)
      .eq("recipe_id", recipeId)
      .maybeSingle(),
    loadVersionPhotosWithUrls(supabase, versionId, { limit: 1 }),
    loadRecipeSidebarRecentRecipes(supabase, userId),
  ]);

  if (
    recipeError ||
    versionError ||
    !recipe ||
    !version ||
    !recentRecipes ||
    !timelineSlice ||
    !initialPhotos
  ) {
    return null;
  }
  const mappedVersion = {
    ...version,
    canonical_ingredients: version.ingredients_json,
    canonical_steps: version.steps_json,
  };
  const stockCoverUrl = getStockRecipeCover({
    recipeId: recipe.id,
    title: recipe.title,
    tags: "tags" in recipe ? recipe.tags ?? [] : [],
    ingredientNames: readCanonicalIngredients(version.ingredients_json).map((item) => item.name),
  });

  return {
    userId,
    recipe,
    timelineVersions: timelineSlice.versions,
    timelineHasMore: timelineSlice.hasMore,
    version: mappedVersion,
    initialPhotosWithUrls: initialPhotos,
    stockCoverUrl,
    sidebarRecentRecipes: recentRecipes,
  };
}

export async function loadCachedRecipeTimelineSlice(
  recipeId: string,
  currentVersionId: string,
  input: {
    limit: number;
    offset?: number;
  }
) {
  const supabase = await createSupabaseServerClient();
  return loadRecipeTimelineSlice(supabase, recipeId, currentVersionId, input);
}

export async function loadCachedVersionPhotosWithUrls(
  versionId: string,
  input?: { limit?: number }
) {
  const supabase = await createSupabaseServerClient();
  return loadVersionPhotosWithUrls(supabase, versionId, input);
}

export async function loadCachedVersionDetailData(
  userId: string,
  recipeId: string,
  versionId: string
) {
  const supabase = await createSupabaseServerClient();
  return loadVersionDetailData(supabase, userId, recipeId, versionId);
}
