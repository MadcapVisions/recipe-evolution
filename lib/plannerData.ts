import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { readCanonicalIngredients, readCanonicalSteps } from "@/lib/recipes/canonicalRecipe";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PlannerRecipeOption = {
  recipeId: string;
  recipeTitle: string;
  versionId: string;
  versionLabel: string | null;
  servings: number | null;
  targetServings: number | null;
  ingredients: Array<{ name: string }>;
  steps: Array<{ text: string }>;
};

export async function loadPlannerRecipeOptions(ownerId: string): Promise<PlannerRecipeOption[]> {
  const supabase = await createSupabaseServerClient();
  return loadPlannerRecipeOptionsWithSupabase(ownerId, supabase);
}

async function loadPlannerRecipeOptionsWithSupabase(
  ownerId: string,
  supabase: SupabaseClient
): Promise<PlannerRecipeOption[]> {
  const { data: recipes, error: recipeError } = await supabase
    .from("recipes")
    .select("id, title, updated_at")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .limit(24);

  if (recipeError) {
    throw new Error(recipeError.message);
  }

  const recipeIds = (recipes ?? []).map((recipe) => recipe.id);
  if (recipeIds.length === 0) {
    return [];
  }

  const { data: versions, error: versionError } = await supabase
    .from("recipe_versions")
    .select("id, recipe_id, version_label, version_number, servings, ingredients_json, steps_json")
    .in("recipe_id", recipeIds)
    .order("version_number", { ascending: false });

  if (versionError) {
    throw new Error(versionError.message);
  }

  const latestByRecipe = new Map<string, (typeof versions)[number]>();
  for (const version of versions ?? []) {
    if (!latestByRecipe.has(version.recipe_id)) {
      latestByRecipe.set(version.recipe_id, version);
    }
  }

  return (recipes ?? [])
    .map((recipe) => {
      const version = latestByRecipe.get(recipe.id);
      if (!version) {
        return null;
      }

      return {
        recipeId: recipe.id,
        recipeTitle: recipe.title,
        versionId: version.id,
        versionLabel: version.version_label,
        servings: version.servings,
        targetServings: version.servings,
        ingredients: readCanonicalIngredients(version.ingredients_json),
        steps: readCanonicalSteps(version.steps_json),
      };
    })
    .filter((value): value is PlannerRecipeOption => Boolean(value));
}

export async function loadPlannerRecipeOptionsForVersions(
  ownerId: string,
  versionIds: string[],
  options?: { supabase?: SupabaseClient }
): Promise<PlannerRecipeOption[]> {
  const uniqueVersionIds = Array.from(new Set(versionIds.filter(Boolean)));
  if (uniqueVersionIds.length === 0) {
    return [];
  }

  const supabase = options?.supabase ?? (await createSupabaseServerClient());
  const { data: versions, error: versionError } = await supabase
    .from("recipe_versions")
    .select("id, recipe_id, version_label, version_number, servings, ingredients_json, steps_json")
    .in("id", uniqueVersionIds);

  if (versionError) {
    throw new Error(versionError.message);
  }

  const recipeIds = ((versions ?? []) as Array<{ recipe_id: string }>).map((version) => version.recipe_id);
  if (recipeIds.length === 0) {
    return [];
  }

  const { data: recipes, error: recipeError } = await supabase
    .from("recipes")
    .select("id, title")
    .eq("owner_id", ownerId)
    .in("id", recipeIds);

  if (recipeError) {
    throw new Error(recipeError.message);
  }

  const recipeById = new Map((recipes ?? []).map((recipe) => [recipe.id, recipe]));
  return (versions ?? [])
    .map((version) => {
      const recipe = recipeById.get(version.recipe_id);
      if (!recipe) {
        return null;
      }

      return {
        recipeId: recipe.id,
        recipeTitle: recipe.title,
        versionId: version.id,
        versionLabel: version.version_label,
        servings: version.servings,
        targetServings: version.servings,
        ingredients: readCanonicalIngredients(version.ingredients_json),
        steps: readCanonicalSteps(version.steps_json),
      };
    })
    .filter((value): value is PlannerRecipeOption => Boolean(value));
}
