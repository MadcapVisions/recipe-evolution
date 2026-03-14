import { notFound, redirect } from "next/navigation";
import { CookingModeClient } from "@/components/cook/CookingModeClient";
import { readCanonicalIngredients, readCanonicalSteps } from "@/lib/recipes/canonicalRecipe";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

type CookPageProps = {
  params: Promise<{ id: string; versionId: string }>;
};

export default async function CookPage({ params }: CookPageProps) {
  const { id, versionId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const [{ data: recipe, error: recipeError }, { data: version, error: versionError }] =
    await Promise.all([
      supabase
        .from("recipes")
        .select("id, title")
        .eq("id", id)
        .eq("owner_id", user.id)
        .maybeSingle(),
      supabase
        .from("recipe_versions")
        .select("id, recipe_id, servings, prep_time_min, cook_time_min, ingredients_json, steps_json")
        .eq("id", versionId)
        .eq("recipe_id", id)
        .maybeSingle(),
    ]);

  if (recipeError || versionError || !recipe || !version) {
    notFound();
  }

  return (
    <CookingModeClient
      recipeId={id}
      recipeTitle={recipe.title}
      versionId={versionId}
      ownerId={user.id}
      servings={version.servings}
      prepTimeMin={version.prep_time_min}
      cookTimeMin={version.cook_time_min}
      ingredientNames={readCanonicalIngredients(version.ingredients_json).map((item) => item.name)}
      initialSteps={readCanonicalSteps(version.steps_json)}
    />
  );
}
