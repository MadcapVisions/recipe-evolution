import type { SupabaseClient } from "@supabase/supabase-js";
import { signVersionPhotoUrls } from "@/lib/versionPhotoUrls";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getStockRecipeCover } from "@/lib/stockRecipeCovers";

export type RecipeBrowseItem = {
  id: string;
  title: string;
  updated_at: string | null;
  is_favorite: boolean;
  version_count: number;
  latest_version_id: string | null;
  servings: number | null;
  cover_image_url: string | null;
  tags: string[];
};

export type RecipeBrowseTab = "active" | "hidden" | "archived";
export type RecipeBrowseSort = "recent" | "alphabetical" | "favorites";

export async function loadRecipeBrowsePage(
  supabase: SupabaseClient,
  ownerId: string,
  input: {
    tab: RecipeBrowseTab;
    sort: RecipeBrowseSort;
    search?: string;
    limit: number;
    offset: number;
  }
): Promise<{
  recipes: RecipeBrowseItem[];
  hasMore: boolean;
}> {
  // Fetch visibility states and ingredient search results in parallel.
  const searchTerm = input.search?.trim() ?? "";
  const [{ data: visibilityStates, error: visibilityError }, { data: ingredientMatches }] = await Promise.all([
    supabase.from("recipe_visibility_states").select("recipe_id, state").eq("owner_id", ownerId),
    searchTerm
      ? supabase.rpc("search_recipe_ids_by_ingredient", { p_owner_id: ownerId, p_search: searchTerm })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (visibilityError) {
    throw new Error(visibilityError.message);
  }

  const hiddenIds = (visibilityStates ?? []).filter((item) => item.state === "hidden").map((item) => item.recipe_id);
  const archivedIds = (visibilityStates ?? []).filter((item) => item.state === "archived").map((item) => item.recipe_id);

  let query = supabase
    .from("recipes")
    .select("id, title, tags, updated_at, is_favorite")
    .eq("owner_id", ownerId);

  if (searchTerm) {
    const ingredientMatchIds = (ingredientMatches ?? []).map((row: { recipe_id: string }) => row.recipe_id);
    if (ingredientMatchIds.length > 0) {
      query = query.or(`title.ilike.%${searchTerm}%,id.in.(${ingredientMatchIds.join(",")})`);
    } else {
      query = query.ilike("title", `%${searchTerm}%`);
    }
  }

  if (input.tab === "hidden") {
    if (hiddenIds.length === 0) {
      return { recipes: [], hasMore: false };
    }
    query = query.in("id", hiddenIds);
  } else if (input.tab === "archived") {
    if (archivedIds.length === 0) {
      return { recipes: [], hasMore: false };
    }
    query = query.in("id", archivedIds);
  } else {
    const excludedIds = [...new Set([...hiddenIds, ...archivedIds])];
    if (excludedIds.length > 0) {
      query = query.not("id", "in", `(${excludedIds.join(",")})`);
    }
  }

  if (input.sort === "alphabetical") {
    query = query.order("title", { ascending: true });
  } else if (input.sort === "favorites") {
    query = query.order("is_favorite", { ascending: false }).order("updated_at", { ascending: false });
  } else {
    query = query.order("updated_at", { ascending: false });
  }

  const { data: recipes, error: recipesError } = await query.range(input.offset, input.offset + input.limit);

  if (recipesError) {
    throw new Error(recipesError.message);
  }

  const pageRecipes = recipes ?? [];
  const hasMore = pageRecipes.length > input.limit;
  const trimmedRecipes = pageRecipes.slice(0, input.limit);
  const recipeIds = trimmedRecipes.map((recipe) => recipe.id);

  if (recipeIds.length === 0) {
    return { recipes: [], hasMore: false };
  }

  // RPC returns one row per recipe (count + latest version) instead of
  // transferring every version row for a full-table scan.
  const { data: versionSummaries, error: versionsError } = await supabase.rpc(
    "get_recipe_version_summaries",
    { p_owner_id: ownerId, p_recipe_ids: recipeIds }
  );

  if (versionsError) {
    throw new Error(versionsError.message);
  }

  type VersionSummary = { recipe_id: string; version_count: number; latest_version_id: string | null; latest_servings: number | null };
  const versionCountByRecipe: Record<string, number> = {};
  const latestVersionIdByRecipe: Record<string, string | null> = {};
  const latestServingsByRecipe: Record<string, number | null> = {};

  for (const row of (versionSummaries ?? []) as VersionSummary[]) {
    versionCountByRecipe[row.recipe_id] = row.version_count;
    latestVersionIdByRecipe[row.recipe_id] = row.latest_version_id;
    latestServingsByRecipe[row.recipe_id] = row.latest_servings;
  }

  // Photo query is now scoped to the latest version per recipe only.
  // The version_photos_version_id_idx index makes this efficient.
  const latestVersionIds = recipeIds
    .map((id) => latestVersionIdByRecipe[id])
    .filter((id): id is string => id != null);

  const { data: photos, error: photosError } = latestVersionIds.length
    ? await supabase
        .from("version_photos")
        .select("version_id, storage_path, created_at")
        .in("version_id", latestVersionIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (photosError) {
    throw new Error(photosError.message);
  }

  // Invert latestVersionIdByRecipe for O(1) photo lookup.
  const recipeByLatestVersionId: Record<string, string> = {};
  for (const [recipeId, versionId] of Object.entries(latestVersionIdByRecipe)) {
    if (versionId) recipeByLatestVersionId[versionId] = recipeId;
  }

  const firstPhotoPathByRecipe: Record<string, string> = {};
  for (const photo of photos ?? []) {
    const recipeId = recipeByLatestVersionId[photo.version_id];
    if (!recipeId || firstPhotoPathByRecipe[recipeId]) {
      continue;
    }
    firstPhotoPathByRecipe[recipeId] = photo.storage_path;
  }

  const coverPhotos = Object.entries(firstPhotoPathByRecipe).map(([recipeId, storagePath]) => ({
    id: recipeId,
    storage_path: storagePath,
  }));
  const signedCoverPhotos = coverPhotos.length > 0 ? await signVersionPhotoUrls(supabase, coverPhotos) : [];
  const coverUrlByRecipe: Record<string, string> = {};
  for (const photo of signedCoverPhotos) {
    coverUrlByRecipe[photo.id] = photo.signedUrl;
  }

  return {
    recipes: trimmedRecipes.map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      updated_at: recipe.updated_at,
      is_favorite: recipe.is_favorite ?? false,
      version_count: versionCountByRecipe[recipe.id] ?? 0,
      latest_version_id: latestVersionIdByRecipe[recipe.id] ?? null,
      servings: latestServingsByRecipe[recipe.id] ?? null,
      cover_image_url:
        coverUrlByRecipe[recipe.id] ??
        getStockRecipeCover({
          recipeId: recipe.id,
          title: recipe.title,
          tags: recipe.tags ?? [],
        }),
      tags: recipe.tags ?? [],
    })),
    hasMore,
  };
}

export async function loadCachedRecipeBrowsePage(
  ownerId: string,
  input: {
    tab: RecipeBrowseTab;
    sort: RecipeBrowseSort;
    search?: string;
    limit: number;
    offset: number;
  }
) {
  const supabase = await createSupabaseServerClient();
  return loadRecipeBrowsePage(supabase, ownerId, input);
}
