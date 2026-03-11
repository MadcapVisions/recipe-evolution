import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { loadRecipeSummaries } from "@/lib/recipeSummaries";
import { RecipesBrowser } from "@/components/recipes/RecipesBrowser";

export default async function RecipesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  let loadError: string | null = null;
  let recipeSummaries: Awaited<ReturnType<typeof loadRecipeSummaries>>["recipeSummaries"] = [];
  let visibilityStates: Array<{ recipe_id: string; state: "hidden" | "archived" }> = [];

  try {
    const [loaded, visibilityResult] = await Promise.all([
      loadRecipeSummaries(supabase, user.id),
      supabase.from("recipe_visibility_states").select("recipe_id, state").eq("owner_id", user.id),
    ]);

    if (visibilityResult.error) {
      loadError = visibilityResult.error.message;
    } else {
      recipeSummaries = loaded.recipeSummaries;
      visibilityStates = visibilityResult.data ?? [];
    }
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load recipes.";
  }

  if (loadError) {
    return <p className="text-sm text-red-700">{loadError}</p>;
  }

  return (
    <RecipesBrowser
      ownerId={user.id}
      recipes={recipeSummaries}
      initialVisibilityStates={visibilityStates}
    />
  );
}
