import { notFound, redirect } from "next/navigation";
import { GroceryListClient } from "@/components/grocery/GroceryListClient";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { Button } from "@/components/Button";

type GroceryPageProps = {
  params: Promise<{ id: string; versionId: string }>;
};

type Ingredient = {
  name?: string;
  quantity?: number | null;
  unit?: string | null;
  prep?: string | null;
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

const normalizeIngredients = (value: unknown): Ingredient[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is Ingredient => typeof item === "object" && item !== null);
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

  const [{ data: recipe, error: recipeError }, { data: version, error: versionError }, { data: list, error: listError }] =
    await Promise.all([
      supabase.from("recipes").select("id, title").eq("id", id).maybeSingle(),
      supabase
        .from("recipe_versions")
        .select("id, recipe_id, version_number, ingredients_json")
        .eq("id", versionId)
        .eq("recipe_id", id)
        .maybeSingle(),
      supabase
        .from("grocery_lists")
        .select("id, items_json")
        .eq("owner_id", user.id)
        .eq("version_id", versionId)
        .maybeSingle(),
    ]);

  if (recipeError || versionError || !recipe || !version) {
    notFound();
  }

  if (listError) {
    return <p className="text-red-700">{listError.message}</p>;
  }

  return (
    <div className="page-shell">
      <div className="saas-card space-y-1 p-5">
        <p className="text-sm text-slate-500">{recipe.title}</p>
        <h1 className="page-title">Grocery List</h1>
        <p className="text-sm text-slate-600">Version {version.version_number}</p>
      </div>

      <GroceryListClient
        ownerId={user.id}
        versionId={versionId}
        existingListId={list?.id ?? null}
        existingItems={(list?.items_json as GroceryItem[] | null) ?? null}
        ingredients={normalizeIngredients(version.ingredients_json)}
      />

      <Button href={`/recipes/${id}/versions/${versionId}`} variant="secondary" className="min-h-11 w-fit">
        Back to Version
      </Button>
    </div>
  );
}
