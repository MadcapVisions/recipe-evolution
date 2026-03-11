import { supabase } from "@/lib/supabaseClient";

export class LimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LimitExceededError";
  }
}

type CreateRecipeInput = {
  ownerId: string;
  title: string;
  description?: string | null;
  tags?: string[] | null;
};

type CreateRecipeVersionInput = {
  recipeId: string;
  versionNumber?: number;
  servings?: number | null;
  prep_time_min?: number | null;
  cook_time_min?: number | null;
  difficulty?: string | null;
  ingredients_json: unknown;
  steps_json: unknown;
  notes?: string | null;
  change_log?: string | null;
  ai_metadata_json?: unknown;
};

type CreateRecipeWithVersionInput = CreateRecipeInput & {
  version: Omit<CreateRecipeVersionInput, "recipeId" | "versionNumber"> & {
    versionNumber?: number;
  };
};

export async function requireAuthenticatedUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("You must be logged in.");
  }

  return user.id;
}

export async function createRecipe(input: CreateRecipeInput) {
  const { data, error } = await supabase
    .from("recipes")
    .insert({
      owner_id: input.ownerId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      tags: input.tags && input.tags.length > 0 ? input.tags : null,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.message.includes("recipe_limit_exceeded")) {
      throw new LimitExceededError("Free tier limit reached: you can create up to 50 recipes.");
    }
    throw new Error(error?.message ?? "Failed to create recipe.");
  }

  return data.id;
}

export async function ensureRecipeOwnership(recipeId: string, ownerId: string) {
  const { data, error } = await supabase
    .from("recipes")
    .select("id")
    .eq("id", recipeId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Recipe not found or access denied.");
  }
}

export async function getNextRecipeVersionNumber(recipeId: string) {
  const { data, error } = await supabase
    .from("recipe_versions")
    .select("version_number")
    .eq("recipe_id", recipeId)
    .order("version_number", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return (data?.[0]?.version_number ?? 0) + 1;
}

export async function createRecipeVersion(input: CreateRecipeVersionInput) {
  const versionNumber = input.versionNumber ?? (await getNextRecipeVersionNumber(input.recipeId));
  const { data, error } = await supabase
    .from("recipe_versions")
    .insert({
      recipe_id: input.recipeId,
      version_number: versionNumber,
      servings: input.servings ?? null,
      prep_time_min: input.prep_time_min ?? null,
      cook_time_min: input.cook_time_min ?? null,
      difficulty: input.difficulty?.trim() || null,
      ingredients_json: input.ingredients_json,
      steps_json: input.steps_json,
      notes: input.notes?.trim() || null,
      change_log: input.change_log?.trim() || null,
      ai_metadata_json: input.ai_metadata_json ?? null,
    })
    .select("id, version_number")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create version.");
  }

  return data;
}

export async function createRecipeWithVersion(input: CreateRecipeWithVersionInput) {
  try {
    const { data, error } = await supabase.rpc("create_recipe_with_initial_version", {
      p_owner_id: input.ownerId,
      p_title: input.title.trim(),
      p_description: input.description?.trim() || null,
      p_tags: input.tags && input.tags.length > 0 ? input.tags : null,
      p_version_number: input.version.versionNumber ?? 1,
      p_servings: input.version.servings ?? null,
      p_prep_time_min: input.version.prep_time_min ?? null,
      p_cook_time_min: input.version.cook_time_min ?? null,
      p_difficulty: input.version.difficulty?.trim() || null,
      p_ingredients_json: input.version.ingredients_json,
      p_steps_json: input.version.steps_json,
      p_notes: input.version.notes?.trim() || null,
      p_change_log: input.version.change_log?.trim() || null,
      p_ai_metadata_json: input.version.ai_metadata_json ?? null,
    });

    const created = Array.isArray(data) ? data[0] : null;

    if (error || !created) {
      if (error?.message.includes("recipe_limit_exceeded")) {
        throw new LimitExceededError("Free tier limit reached: you can create up to 50 recipes.");
      }

      throw new Error(error?.message ?? "Could not save recipe.");
    }

    return {
      recipeId: created.recipe_id,
      versionId: created.version_id,
      versionNumber: created.version_number,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Could not save recipe.");
  }
}
