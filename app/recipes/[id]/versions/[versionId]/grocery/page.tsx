import { notFound, redirect } from "next/navigation";
import { GroceryListClient } from "@/components/grocery/GroceryListClient";
import { readCanonicalIngredients } from "@/lib/recipes/canonicalRecipe";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { Button } from "@/components/Button";

type GroceryPageProps = {
  params: Promise<{ id: string; versionId: string }>;
};

type GroceryItem = {
  id: string;
  name: string;
  normalized_name: string;
  quantity: number | null;
  unit: string | null;
  prep: string | null;
  checked: boolean;
};

export default async function GroceryPage({ params }: GroceryPageProps) {
  const { id, versionId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const [{ data: recipe, error: recipeError }, { data: version, error: versionError }, { data: list, error: listError }, { data: preferences }] =
    await Promise.all([
      supabase.from("recipes").select("id, title").eq("id", id).maybeSingle(),
      supabase
        .from("recipe_versions")
        .select("id, recipe_id, version_number, servings, ingredients_json")
        .eq("id", versionId)
        .eq("recipe_id", id)
        .maybeSingle(),
      supabase
        .from("grocery_lists")
        .select("id, items_json")
        .eq("owner_id", user.id)
        .eq("version_id", versionId)
        .maybeSingle(),
      supabase
        .from("user_preferences")
        .select("pantry_staples, pantry_confident_staples")
        .eq("owner_id", user.id)
        .maybeSingle(),
    ]);

  if (recipeError || versionError || !recipe || !version) {
    notFound();
  }

  if (listError) {
    return (
      <div className="page-shell">
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{listError.message}</div>
        <Button href={`/recipes/${id}/versions/${versionId}`} variant="secondary" className="w-fit">
          Back to Version
        </Button>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="app-panel space-y-1 p-5">
        <p className="text-sm text-[color:var(--muted)]">{recipe.title}</p>
        <h1 className="page-title">Grocery List</h1>
        <p className="text-sm text-[color:var(--muted)]">Version {version.version_number}</p>
        <p className="text-sm text-[color:var(--muted)]">Serves {typeof version.servings === "number" ? version.servings : "-"}</p>
      </div>

      <GroceryListClient
        recipeId={id}
        versionId={versionId}
        baseServings={version.servings}
        pantryStaples={[...(preferences?.pantry_staples ?? []), ...(preferences?.pantry_confident_staples ?? [])]}
        existingListId={list?.id ?? null}
        existingItems={(list?.items_json as GroceryItem[] | null) ?? null}
        ingredients={readCanonicalIngredients(version.ingredients_json)}
      />

      <Button href={`/recipes/${id}/versions/${versionId}`} variant="secondary" className="min-h-11 w-fit">
        Back to Version
      </Button>
    </div>
  );
}
