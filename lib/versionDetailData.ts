import type { SupabaseClient } from "@supabase/supabase-js";
import { signVersionPhotoUrls } from "@/lib/versionPhotoUrls";
import { loadRecipeSidebarData } from "@/lib/recipeSidebarData";
import type { RecipeListItem, TimelineVersion } from "@/components/recipes/version-detail/types";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { readCanonicalIngredients } from "@/lib/recipes/canonicalRecipe";
import { getStockRecipeCover } from "@/lib/stockRecipeCovers";

const INITIAL_TIMELINE_LIMIT = 8;

async function attachTimelineScores(
  supabase: SupabaseClient,
  versions: TimelineVersion[]
): Promise<TimelineVersion[]> {
  if (versions.length === 0) return versions;

  const versionIds = versions.map((version) => version.id);
  const { data, error } = await supabase
    .from("recipe_scores")
    .select("recipe_version_id, total_score")
    .in("recipe_version_id", versionIds);

  if (error) {
    return versions;
  }

  const scoreByVersionId = new Map<string, number | null>(
    (data ?? []).map((row) => [row.recipe_version_id as string, typeof row.total_score === "number" ? row.total_score : null])
  );

  return versions.map((version, index) => {
    const totalScore = scoreByVersionId.get(version.id) ?? null;
    const previousVersion = versions[index + 1];
    const previousScore = previousVersion ? scoreByVersionId.get(previousVersion.id) ?? null : null;

    return {
      ...version,
      total_score: totalScore,
      score_delta:
        typeof totalScore === "number" && typeof previousScore === "number" ? totalScore - previousScore : null,
    };
  });
}

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

  // Fetch the page slice and the current version in parallel (offset=0 only —
  // for paginated requests the current version is already in context).
  const sliceQuery = supabase
    .from("recipe_versions")
    .select("id, version_number, version_label, change_summary, created_at")
    .eq("recipe_id", recipeId)
    .order("version_number", { ascending: false })
    .range(offset, offset + fetchLimit - 1);

  const currentVersionQuery =
    offset === 0
      ? supabase
          .from("recipe_versions")
          .select("id, version_number, version_label, change_summary, created_at")
          .eq("id", currentVersionId)
          .eq("recipe_id", recipeId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });

  const [{ data, error }, { data: currentVersion, error: currentVersionError }] = await Promise.all([
    sliceQuery,
    currentVersionQuery,
  ]);

  if (error) {
    return null;
  }

  const pageVersions = (data ?? []) as TimelineVersion[];
  const hasMore = pageVersions.length > input.limit;
  const trimmed = pageVersions.slice(0, input.limit);

  if (offset > 0 || trimmed.some((version) => version.id === currentVersionId)) {
    return { versions: await attachTimelineScores(supabase, trimmed), hasMore };
  }

  if (currentVersionError || !currentVersion) {
    return null;
  }

  const deduped = [currentVersion as TimelineVersion, ...trimmed].filter(
    (version, index, list) => list.findIndex((candidate) => candidate.id === version.id) === index
  );

  deduped.sort((a, b) => b.version_number - a.version_number);
  return { versions: await attachTimelineScores(supabase, deduped), hasMore: true };
}

export type RecipeLineage = {
  sourceRecipeId: string;
  sourceTitle: string;
  sourceVersionId: string;
  sourceVersionNumber: number;
};

export type VersionDetailData = {
  userId: string;
  recipe: {
    id: string;
    title: string;
    description?: string | null;
    best_version_id?: string | null;
    forked_from_version_id?: string | null;
    dish_family?: string | null;
  };
  lineage: RecipeLineage | null;
  timelineVersions: Array<{
    id: string;
    version_number: number;
    version_label: string | null;
    change_summary?: string | null;
    created_at: string;
    total_score?: number | null;
    score_delta?: number | null;
  }>;
  timelineHasMore: boolean;
  version: {
    id: string;
    recipe_id: string;
    version_number: number;
    version_label: string | null;
    change_summary: string | null;
    notes: string | null;
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
  sidebarFavoriteRecipes: RecipeListItem[];
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
    recipeWithEmbed,
    timelineSlice,
    { data: version, error: versionError },
    initialPhotos,
    sidebarData,
  ] = await Promise.all([
    supabase
      .from("recipes")
      .select(
        // The forked_version embed resolves lineage in the same round trip.
        // FK hints are required because recipes has two FKs to recipe_versions.
        `id, title, description, tags, best_version_id, forked_from_version_id, dish_family,
        forked_version:recipe_versions!recipes_forked_from_version_id_fkey(
          id, recipe_id, version_number,
          source_recipe:recipes!recipe_versions_recipe_id_fkey(id, title, owner_id)
        )`
      )
      .eq("id", recipeId)
      .eq("owner_id", userId)
      .maybeSingle(),
    loadRecipeTimelineSlice(supabase, recipeId, versionId, { limit: INITIAL_TIMELINE_LIMIT }),
    supabase
      .from("recipe_versions")
      .select(
        "id, recipe_id, version_number, version_label, change_summary, notes, servings, prep_time_min, cook_time_min, difficulty, ingredients_json, steps_json, created_at"
      )
      .eq("id", versionId)
      .eq("recipe_id", recipeId)
      .maybeSingle(),
    loadVersionPhotosWithUrls(supabase, versionId, { limit: 1 }),
    loadRecipeSidebarData(supabase, userId),
  ]);

  type RecipeData = { id: string; title: string; description?: string | null; tags?: string[] | null; best_version_id?: string | null; forked_from_version_id?: string | null; dish_family?: string | null; forked_version?: unknown };

  // PGRST200 means PostgREST couldn't resolve the FK hint in the embedded join.
  // That's the only error we handle gracefully here — all other recipe-query
  // errors (auth, not-found, network) remain fatal.
  let recipe: RecipeData | null = recipeWithEmbed.data as RecipeData | null;
  let useSerialLineage = false;

  if (recipeWithEmbed.error) {
    if ((recipeWithEmbed.error as { code?: string }).code !== "PGRST200") {
      return null;
    }
    // FK hint failed — retry without the embed, resolve lineage serially below.
    const { data: fallback, error: fallbackError } = await supabase
      .from("recipes")
      .select("id, title, description, tags, best_version_id, forked_from_version_id, dish_family")
      .eq("id", recipeId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (fallbackError || !fallback) {
      return null;
    }
    recipe = fallback as RecipeData;
    useSerialLineage = true;
  } else if (!recipe) {
    return null;
  }

  // Version is critical — return null (404) if missing.
  // Sidebar, timeline, and photos are non-critical and degrade gracefully.
  if (versionError || !version) {
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
    tags: recipe.tags ?? [],
    ingredientNames: readCanonicalIngredients(version.ingredients_json).map((item) => item.name),
  });

  // Happy path: lineage resolved from the embedded join (no extra round trip).
  // Fallback path (PGRST200): one serial query — only runs if the embed failed.
  let lineage: RecipeLineage | null = null;
  if (useSerialLineage) {
    const forkedFromVersionId = recipe.forked_from_version_id ?? null;
    if (forkedFromVersionId) {
      const { data: sourceVersion } = await supabase
        .from("recipe_versions")
        .select("id, recipe_id, version_number, recipes!inner(id, title, owner_id)")
        .eq("id", forkedFromVersionId)
        .maybeSingle();
      if (sourceVersion) {
        const sourceRecipe = Array.isArray(sourceVersion.recipes) ? sourceVersion.recipes[0] : sourceVersion.recipes;
        if (sourceRecipe && (sourceRecipe as { owner_id: string }).owner_id === userId) {
          lineage = {
            sourceRecipeId: sourceVersion.recipe_id,
            sourceTitle: (sourceRecipe as { title: string }).title,
            sourceVersionId: forkedFromVersionId,
            sourceVersionNumber: sourceVersion.version_number,
          };
        }
      }
    }
  } else {
    const forkedVersionRaw = recipe.forked_version;
    if (forkedVersionRaw) {
      const fv = Array.isArray(forkedVersionRaw) ? forkedVersionRaw[0] : forkedVersionRaw;
      if (fv) {
        const srRaw = (fv as { source_recipe?: unknown }).source_recipe;
        const sourceRecipe = Array.isArray(srRaw) ? srRaw[0] : srRaw;
        if (sourceRecipe && (sourceRecipe as { owner_id: string }).owner_id === userId) {
          lineage = {
            sourceRecipeId: (fv as { recipe_id: string }).recipe_id,
            sourceTitle: (sourceRecipe as { title: string }).title,
            sourceVersionId: (fv as { id: string }).id,
            sourceVersionNumber: (fv as { version_number: number }).version_number,
          };
        }
      }
    }
  }

  // Strip embed-only fields before returning — the client should not receive
  // the raw forked_version blob or tags (which are only used server-side here).
  const recipePayload = {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description ?? null,
    best_version_id: recipe.best_version_id ?? null,
    forked_from_version_id: recipe.forked_from_version_id ?? null,
    dish_family: recipe.dish_family ?? null,
  };

  return {
    userId,
    recipe: recipePayload,
    lineage,
    timelineVersions: timelineSlice?.versions ?? [],
    timelineHasMore: timelineSlice?.hasMore ?? false,
    version: mappedVersion,
    initialPhotosWithUrls: initialPhotos ?? [],
    stockCoverUrl,
    sidebarRecentRecipes: sidebarData?.recentRecipes ?? [],
    sidebarFavoriteRecipes: sidebarData?.favoriteRecipes ?? [],
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
