import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { loadRecipeSummaries } from "@/lib/recipeSummaries";
import { HomeHub } from "@/components/home/HomeHub";
import type { UserTasteProfile } from "@/components/home/types";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  let loadError: string | null = null;
  let recentRecipes: Array<{
    id: string;
    title: string;
    updated_at: string | null;
    is_favorite?: boolean;
    version_count: number;
    servings: number | null;
    cover_image_url?: string | null;
  }> = [];
  let totalVersionCount = 0;
  let userTasteProfile: UserTasteProfile | null = null;

  try {
    const [loaded, preferencesResult] = await Promise.all([
      loadRecipeSummaries(supabase, user.id),
      supabase
        .from("user_preferences")
        .select(
          "common_diet_tags, disliked_ingredients, favorite_cuisines, favorite_proteins, preferred_flavors, pantry_staples, spice_tolerance, health_goals, taste_notes"
        )
        .eq("owner_id", user.id)
        .maybeSingle(),
    ]);

    recentRecipes = loaded.recipeSummaries.map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      updated_at: recipe.updated_at,
      is_favorite: recipe.is_favorite,
      version_count: recipe.version_count,
      servings: recipe.servings,
      cover_image_url: recipe.cover_image_url,
    }));
    totalVersionCount = loaded.totalVersionCount;

    const preferences = preferencesResult.data;

    userTasteProfile = preferences
      ? {
          favoriteCuisines: preferences.favorite_cuisines ?? [],
          favoriteProteins: preferences.favorite_proteins ?? [],
          preferredFlavors: preferences.preferred_flavors ?? [],
          commonDietTags: preferences.common_diet_tags ?? [],
          dislikedIngredients: preferences.disliked_ingredients ?? [],
          pantryStaples: preferences.pantry_staples ?? [],
          spiceTolerance: preferences.spice_tolerance ?? null,
          healthGoals: preferences.health_goals ?? [],
          tasteNotes: preferences.taste_notes ?? null,
        }
      : null;
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load dashboard.";
  }

  if (loadError) {
    return <p className="text-sm text-red-700">{loadError}</p>;
  }

  return <HomeHub recentRecipes={recentRecipes} totalVersionCount={totalVersionCount} userTasteProfile={userTasteProfile} />;
}
