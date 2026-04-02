import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { RecipesBrowser } from "@/components/recipes/RecipesBrowser";
import { loadCachedRecipeBrowsePage } from "@/lib/recipeBrowseData";
import { getResurfacingData } from "@/lib/recipes/resurfacingData";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/ai/featureFlags";
import type { ResurfacingData } from "@/lib/recipes/resurfacingData";

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
  let resurfacingShelf: ResurfacingData | undefined;

  try {
    const [loaded, resurfacingEnabled] = await Promise.all([
      loadCachedRecipeBrowsePage(user.id, {
        tab: "active",
        sort: "recent",
        limit: 24,
        offset: 0,
      }),
      getFeatureFlag(FEATURE_FLAG_KEYS.LIBRARY_RESURFACING_V1, false),
    ]);
    initialRecipes = loaded.recipes;
    initialHasMore = loaded.hasMore;

    if (resurfacingEnabled) {
      resurfacingShelf = await getResurfacingData(supabase, user.id);
    }
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load recipes.";
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-[1380px] p-6">
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{loadError}</div>
      </div>
    );
  }

  return (
    <RecipesBrowser
      initialRecipes={initialRecipes}
      initialHasMore={initialHasMore}
      resurfacingShelf={resurfacingShelf}
    />
  );
}
