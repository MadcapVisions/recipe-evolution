import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { loadRecipeSummaries } from "@/lib/recipeSummaries";
import { HomeHub } from "@/components/home/HomeHub";

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
    cover_image_url?: string | null;
  }> = [];
  let versionTimelineByRecipe: Record<
    string,
    Array<{ id: string; version_number: number; version_label: string | null; created_at: string }>
  > = {};

  try {
    const loaded = await loadRecipeSummaries(supabase, user.id);
    recentRecipes = loaded.recipeSummaries.map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      updated_at: recipe.updated_at,
      is_favorite: recipe.is_favorite,
      version_count: recipe.version_count,
      cover_image_url: recipe.cover_image_url,
    }));
    versionTimelineByRecipe = loaded.versionTimelineByRecipe;
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load dashboard.";
  }

  if (loadError) {
    return <p className="text-sm text-red-700">{loadError}</p>;
  }

  return <HomeHub recentRecipes={recentRecipes} versionTimelineByRecipe={versionTimelineByRecipe} />;
}
