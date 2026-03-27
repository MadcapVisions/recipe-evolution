import type { SupabaseClient } from "@supabase/supabase-js";
import type { RecipeListItem } from "@/components/recipes/version-detail/types";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export type RecipeSidebarData = {
  recentRecipes: RecipeListItem[];
  favoriteRecipes: RecipeListItem[];
};

async function loadActiveSidebarRecipes(
  supabase: SupabaseClient,
  userId: string
): Promise<RecipeListItem[] | null> {
  const [{ data: recipes, error: recipesError }, { data: visibilityStates, error: visibilityError }] =
    await Promise.all([
      supabase
        .from("recipes")
        .select("id, title, is_favorite, tags, best_version_id")
        .eq("owner_id", userId)
        .order("updated_at", { ascending: false })
        .limit(36),
      supabase
        .from("recipe_visibility_states")
        .select("recipe_id, state")
        .eq("owner_id", userId),
    ]);

  if (recipesError || visibilityError) {
    return null;
  }

  const hiddenIds = new Set((visibilityStates ?? []).filter((state) => state.state === "hidden").map((state) => state.recipe_id));
  const archivedIds = new Set((visibilityStates ?? []).filter((state) => state.state === "archived").map((state) => state.recipe_id));
  const activeRecipes = (recipes ?? []).filter((recipe) => !hiddenIds.has(recipe.id) && !archivedIds.has(recipe.id));
  const bestVersionIds = activeRecipes.map((recipe) => recipe.best_version_id).filter((value): value is string => typeof value === "string");

  let scoreByVersionId = new Map<string, number | null>();
  if (bestVersionIds.length > 0) {
    const { data: scores } = await supabase
      .from("recipe_scores")
      .select("recipe_version_id, total_score")
      .in("recipe_version_id", bestVersionIds);
    scoreByVersionId = new Map<string, number | null>(
      (scores ?? []).map((row) => [row.recipe_version_id as string, typeof row.total_score === "number" ? row.total_score : null])
    );
  }

  return activeRecipes.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    is_favorite: recipe.is_favorite,
    tags: recipe.tags,
    chef_score: typeof recipe.best_version_id === "string" ? scoreByVersionId.get(recipe.best_version_id) ?? null : null,
  }));
}

export async function loadRecipeSidebarRecentRecipes(
  supabase: SupabaseClient,
  userId: string
): Promise<RecipeListItem[] | null> {
  const activeRecipes = await loadActiveSidebarRecipes(supabase, userId);
  if (!activeRecipes) {
    return null;
  }
  return activeRecipes.slice(0, 12);
}

export async function loadRecipeSidebarFavoriteRecipes(
  supabase: SupabaseClient,
  userId: string
): Promise<RecipeListItem[] | null> {
  const activeRecipes = await loadActiveSidebarRecipes(supabase, userId);
  if (!activeRecipes) {
    return null;
  }
  return activeRecipes.filter((recipe) => recipe.is_favorite).slice(0, 8);
}

export async function loadRecipeSidebarData(
  supabase: SupabaseClient,
  userId: string
): Promise<RecipeSidebarData | null> {
  const activeRecipes = await loadActiveSidebarRecipes(supabase, userId);
  if (!activeRecipes) {
    return null;
  }
  return {
    recentRecipes: activeRecipes.slice(0, 12),
    favoriteRecipes: activeRecipes.filter((recipe) => recipe.is_favorite).slice(0, 8),
  };
}

export async function loadCachedRecipeSidebarRecentRecipes(userId: string) {
  const supabase = await createSupabaseServerClient();
  return loadRecipeSidebarRecentRecipes(supabase, userId);
}

export async function loadCachedRecipeSidebarFavoriteRecipes(userId: string) {
  const supabase = await createSupabaseServerClient();
  return loadRecipeSidebarFavoriteRecipes(supabase, userId);
}

export async function loadCachedRecipeSidebarData(userId: string) {
  const supabase = await createSupabaseServerClient();
  return loadRecipeSidebarData(supabase, userId);
}
