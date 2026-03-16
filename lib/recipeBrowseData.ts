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
  const { data: visibilityStates, error: visibilityError } = await supabase
    .from("recipe_visibility_states")
    .select("recipe_id, state")
    .eq("owner_id", ownerId);

  if (visibilityError) {
    throw new Error(visibilityError.message);
  }

  const hiddenIds = (visibilityStates ?? []).filter((item) => item.state === "hidden").map((item) => item.recipe_id);
  const archivedIds = (visibilityStates ?? []).filter((item) => item.state === "archived").map((item) => item.recipe_id);

  let query = supabase
    .from("recipes")
    .select("id, title, tags, updated_at, is_favorite")
    .eq("owner_id", ownerId);

  if (input.search?.trim()) {
    query = query.ilike("title", `%${input.search.trim()}%`);
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

  const { data: versions, error: versionsError } = await supabase
    .from("recipe_versions")
    .select("id, recipe_id")
    .in("recipe_id", recipeIds);

  if (versionsError) {
    throw new Error(versionsError.message);
  }

  const versionCountByRecipe: Record<string, number> = {};
  const versionToRecipe: Record<string, string> = {};
  const latestServingsByRecipe: Record<string, number | null> = {};

  for (const version of versions ?? []) {
    versionCountByRecipe[version.recipe_id] = (versionCountByRecipe[version.recipe_id] ?? 0) + 1;
    versionToRecipe[version.id] = version.recipe_id;
    if (!(version.recipe_id in latestServingsByRecipe)) {
      latestServingsByRecipe[version.recipe_id] = null;
    }
  }

  const { data: latestVersions, error: latestVersionsError } = await supabase
    .from("recipe_versions")
    .select("id, recipe_id, servings, version_number")
    .in("recipe_id", recipeIds)
    .order("version_number", { ascending: false });

  if (latestVersionsError) {
    throw new Error(latestVersionsError.message);
  }

  for (const version of latestVersions ?? []) {
    if (!(version.recipe_id in latestServingsByRecipe)) {
      continue;
    }
    if (latestServingsByRecipe[version.recipe_id] === null) {
      latestServingsByRecipe[version.recipe_id] = typeof version.servings === "number" ? version.servings : null;
    }
  }

  const latestVersionIdByRecipe: Record<string, string | null> = {};
  for (const recipeId of recipeIds) {
    latestVersionIdByRecipe[recipeId] = null;
  }
  for (const version of latestVersions ?? []) {
    if (latestVersionIdByRecipe[version.recipe_id] === null) {
      latestVersionIdByRecipe[version.recipe_id] = version.id;
    }
  }

  const versionIds = Object.keys(versionToRecipe);
  const { data: photos, error: photosError } = versionIds.length
    ? await supabase
        .from("version_photos")
        .select("version_id, storage_path, created_at")
        .in("version_id", versionIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (photosError) {
    throw new Error(photosError.message);
  }

  const firstPhotoPathByRecipe: Record<string, string> = {};
  for (const photo of photos ?? []) {
    const recipeId = versionToRecipe[photo.version_id];
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
