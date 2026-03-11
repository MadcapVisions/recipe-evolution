import type { SupabaseClient } from "@supabase/supabase-js";

export type RecipeSidebarData = {
  userRecipes: Array<{
    id: string;
    title: string;
    is_favorite?: boolean | null;
    tags?: string[] | null;
  }>;
  hiddenRecipeIds: string[];
  archivedRecipeIds: string[];
};

export async function loadRecipeSidebarData(
  supabase: SupabaseClient,
  userId: string
): Promise<RecipeSidebarData | null> {
  const [{ data: userRecipes, error: userRecipesError }, { data: visibilityStates, error: visibilityError }] =
    await Promise.all([
      supabase
        .from("recipes")
        .select("id, title, is_favorite, tags")
        .eq("owner_id", userId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("recipe_visibility_states")
        .select("recipe_id, state")
        .eq("owner_id", userId),
    ]);

  if (userRecipesError || visibilityError) {
    return null;
  }

  return {
    userRecipes: userRecipes ?? [],
    hiddenRecipeIds: (visibilityStates ?? []).filter((state) => state.state === "hidden").map((state) => state.recipe_id),
    archivedRecipeIds: (visibilityStates ?? []).filter((state) => state.state === "archived").map((state) => state.recipe_id),
  };
}
