import { notFound, redirect } from "next/navigation";
import { CookingModeClient } from "@/components/cook/CookingModeClient";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

type CookPageProps = {
  params: Promise<{ id: string; versionId: string }>;
};

type StepItem = {
  text: string;
  timer_seconds?: number;
};

type IngredientItem = {
  name: string;
};

const normalizeSteps = (value: unknown): StepItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }
      const maybeText = (item as Record<string, unknown>).text;
      const maybeTimer = (item as Record<string, unknown>).timer_seconds;
      if (typeof maybeText !== "string" || maybeText.trim().length === 0) {
        return null;
      }
      const parsed: StepItem = { text: maybeText };
      if (typeof maybeTimer === "number") {
        parsed.timer_seconds = maybeTimer;
      }
      return parsed;
    })
    .filter((item): item is StepItem => item !== null);
};

const normalizeIngredients = (value: unknown): IngredientItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }
      const maybeName = (item as Record<string, unknown>).name;
      if (typeof maybeName !== "string" || maybeName.trim().length === 0) {
        return null;
      }
      return { name: maybeName.trim() };
    })
    .filter((item): item is IngredientItem => item !== null);
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
      ingredientNames={normalizeIngredients(version.ingredients_json).map((item) => item.name)}
      initialSteps={normalizeSteps(version.steps_json)}
    />
  );
}
