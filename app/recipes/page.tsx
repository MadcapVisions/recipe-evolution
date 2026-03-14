import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { RecipesBrowser } from "@/components/recipes/RecipesBrowser";
import { loadCachedRecipeBrowsePage } from "@/lib/recipeBrowseData";

export default async function RecipesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  let loadError: string | null = null;
  let initialRecipes: Awaited<ReturnType<typeof loadCachedRecipeBrowsePage>>["recipes"] = [];
  let initialHasMore = false;

  try {
    const loaded = await loadCachedRecipeBrowsePage(user.id, {
      tab: "active",
      sort: "recent",
      limit: 24,
      offset: 0,
    });
    initialRecipes = loaded.recipes;
    initialHasMore = loaded.hasMore;
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load recipes.";
  }

  if (loadError) {
    return <p className="text-sm text-red-700">{loadError}</p>;
  }

  return (
    <RecipesBrowser
      initialRecipes={initialRecipes}
      initialHasMore={initialHasMore}
    />
  );
}
