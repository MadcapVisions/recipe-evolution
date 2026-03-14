import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { signVersionPhotoUrls } from "@/lib/versionPhotoUrls";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type RecipeSummary = {
  id: string;
  title: string;
  tags: string[];
  updated_at: string | null;
  is_favorite: boolean;
  version_count: number;
  servings: number | null;
  cover_image_url: string | null;
};

export type RecipeTimelineItem = {
  id: string;
  version_number: number;
  version_label: string | null;
  created_at: string;
};

export async function loadRecipeSummaries(
  supabase: SupabaseServerClient,
  ownerId: string
): Promise<{
  recipeSummaries: RecipeSummary[];
  totalVersionCount: number;
}> {
  const { data: recipes, error } = await supabase
    .from("recipes")
    .select("id, title, tags, updated_at, is_favorite")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const recipeIds = (recipes ?? []).map((recipe) => recipe.id);
  const { data: versions, error: versionsError } = recipeIds.length
    ? await supabase
      .from("recipe_versions")
        .select("id, recipe_id, version_number, version_label, created_at, servings")
        .in("recipe_id", recipeIds)
        .order("version_number", { ascending: false })
    : {
        data: [] as Array<{
          id: string;
          recipe_id: string;
          version_number: number;
          version_label: string | null;
          created_at: string;
          servings: number | null;
        }>,
        error: null,
      };

  if (versionsError) {
    throw new Error(versionsError.message);
  }

  const versionIds = (versions ?? []).map((version) => version.id);
  const { data: photos, error: photosError } = versionIds.length
    ? await supabase
        .from("version_photos")
        .select("version_id, storage_path, created_at")
        .in("version_id", versionIds)
        .order("created_at", { ascending: false })
    : {
        data: [] as Array<{ version_id: string; storage_path: string; created_at: string }>,
        error: null,
      };

  if (photosError) {
    throw new Error(photosError.message);
  }

  const versionCountByRecipe: Record<string, number> = {};
  const versionToRecipe: Record<string, string> = {};
  const latestServingsByRecipe: Record<string, number | null> = {};

  for (const version of versions ?? []) {
    versionCountByRecipe[version.recipe_id] = (versionCountByRecipe[version.recipe_id] ?? 0) + 1;
    versionToRecipe[version.id] = version.recipe_id;
    if (!(version.recipe_id in latestServingsByRecipe)) {
      latestServingsByRecipe[version.recipe_id] = typeof version.servings === "number" ? version.servings : null;
    }
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

  const recipeSummaries = (recipes ?? []).map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    tags: recipe.tags ?? [],
    updated_at: recipe.updated_at,
    is_favorite: recipe.is_favorite ?? false,
    version_count: versionCountByRecipe[recipe.id] ?? 0,
    servings: latestServingsByRecipe[recipe.id] ?? null,
    cover_image_url: coverUrlByRecipe[recipe.id] ?? null,
  }));
  return {
    recipeSummaries,
    totalVersionCount: (versions ?? []).length,
  };
}
