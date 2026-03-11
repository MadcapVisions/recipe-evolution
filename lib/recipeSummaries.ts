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
  versionTimelineByRecipe: Record<string, RecipeTimelineItem[]>;
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
        .select("id, recipe_id, version_number, version_label, created_at")
        .in("recipe_id", recipeIds)
        .order("version_number", { ascending: false })
    : {
        data: [] as Array<{
          id: string;
          recipe_id: string;
          version_number: number;
          version_label: string | null;
          created_at: string;
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

  const versionCountByRecipe = (versions ?? []).reduce<Record<string, number>>((accumulator, version) => {
    accumulator[version.recipe_id] = (accumulator[version.recipe_id] ?? 0) + 1;
    return accumulator;
  }, {});

  const versionToRecipe = (versions ?? []).reduce<Record<string, string>>((accumulator, version) => {
    accumulator[version.id] = version.recipe_id;
    return accumulator;
  }, {});

  const firstPhotoPathByRecipe = (photos ?? []).reduce<Record<string, string>>((accumulator, photo) => {
    const recipeId = versionToRecipe[photo.version_id];
    if (!recipeId || accumulator[recipeId]) {
      return accumulator;
    }
    accumulator[recipeId] = photo.storage_path;
    return accumulator;
  }, {});

  const coverPhotos = Object.entries(firstPhotoPathByRecipe).map(([recipeId, storagePath]) => ({
    id: recipeId,
    storage_path: storagePath,
  }));
  const signedCoverPhotos = await signVersionPhotoUrls(supabase, coverPhotos);

  const coverUrlByRecipe = Object.fromEntries(
    signedCoverPhotos.map((photo) => [photo.id, photo.signedUrl] as const)
  );

  const recipeSummaries = (recipes ?? []).map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    tags: recipe.tags ?? [],
    updated_at: recipe.updated_at,
    is_favorite: recipe.is_favorite ?? false,
    version_count: versionCountByRecipe[recipe.id] ?? 0,
    cover_image_url: coverUrlByRecipe[recipe.id] ?? null,
  }));

  const versionTimelineByRecipe = (versions ?? []).reduce<Record<string, RecipeTimelineItem[]>>((accumulator, version) => {
    if (!accumulator[version.recipe_id]) {
      accumulator[version.recipe_id] = [];
    }

    accumulator[version.recipe_id].push({
      id: version.id,
      version_number: version.version_number,
      version_label: version.version_label,
      created_at: version.created_at,
    });

    return accumulator;
  }, {});

  return {
    recipeSummaries,
    versionTimelineByRecipe,
  };
}
