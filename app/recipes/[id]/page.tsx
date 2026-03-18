import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

type RecipePageProps = {
  params: Promise<{ id: string }>;
};

export default async function RecipePage({ params }: RecipePageProps) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const [{ data: recipe, error: recipeError }, { data: latestVersion, error: latestVersionError }] =
    await Promise.all([
      supabase
        .from("recipes")
        .select("id")
        .eq("id", id)
        .eq("owner_id", user.id)
        .maybeSingle(),
      supabase
        .from("recipe_versions")
        .select("id")
        .eq("recipe_id", id)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (recipeError || !recipe) {
    notFound();
  }

  if (latestVersionError) {
    throw new Error("Failed to load recipe versions.");
  }

  if (!latestVersion) {
    redirect(`/recipes/${id}/versions/new`);
  }

  redirect(`/recipes/${id}/versions/${latestVersion.id}`);
}
