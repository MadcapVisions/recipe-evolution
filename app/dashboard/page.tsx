import Link from "next/link";
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
    return (
      <div className="mx-auto max-w-[1380px] p-6">
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-5">
          <p className="text-sm text-red-700">{loadError}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex min-h-10 items-center rounded-2xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-800 transition hover:bg-red-200"
            >
              Refresh
            </Link>
            <Link
              href="/recipes"
              className="inline-flex min-h-10 items-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text)] ring-1 ring-[rgba(79,54,33,0.12)] transition hover:bg-[rgba(255,252,246,0.8)]"
            >
              My Recipes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <HomeHub recentRecipes={recentRecipes} totalVersionCount={totalVersionCount} userTasteProfile={userTasteProfile} />;
}
