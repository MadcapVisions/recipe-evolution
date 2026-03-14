import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { ZodError } from "zod";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createRecipePayloadSchema } from "@/lib/recipes/recipeDraft";
import { getRecipeDetailTag, getRecipeLibraryTag, getRecipeSidebarTag, getRecipeTimelineTag } from "@/lib/cacheTags";

function getValidationMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Invalid recipe payload.";
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: true, message: "Authentication required." }, { status: 401 });
  }

  let payload;

  try {
    payload = createRecipePayloadSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: true, message: getValidationMessage(error) }, { status: 400 });
    }
    return NextResponse.json({ error: true, message: "Invalid recipe payload." }, { status: 400 });
  }

  const { draft } = payload;
  const { data, error } = await supabase.rpc("create_recipe_with_initial_version", {
    p_owner_id: user.id,
    p_title: draft.title,
    p_description: draft.description,
    p_tags: draft.tags,
    p_version_number: 1,
    p_servings: draft.servings,
    p_prep_time_min: draft.prep_time_min,
    p_cook_time_min: draft.cook_time_min,
    p_difficulty: draft.difficulty,
    p_ingredients_json: draft.ingredients,
    p_steps_json: draft.steps,
    p_notes: draft.notes,
    p_change_log: draft.change_log,
    p_ai_metadata_json: draft.ai_metadata_json,
  });

  const created = Array.isArray(data) ? data[0] : null;

  if (error || !created) {
    const message = error?.message ?? "Could not save recipe.";
    const status = message.includes("recipe_limit_exceeded") ? 403 : 500;
    const code = message.includes("recipe_limit_exceeded") ? "recipe_limit_exceeded" : null;

    return NextResponse.json(
      {
        error: true,
        message: code ? "Free tier limit reached: you can create up to 50 recipes." : message,
        code,
      },
      { status }
    );
  }

  revalidateTag(getRecipeLibraryTag(user.id), "max");
  revalidateTag(getRecipeSidebarTag(user.id), "max");
  revalidateTag(getRecipeDetailTag(user.id, created.recipe_id, created.version_id), "max");
  revalidateTag(getRecipeTimelineTag(created.recipe_id), "max");

  return NextResponse.json({
    recipeId: created.recipe_id,
    versionId: created.version_id,
    versionNumber: created.version_number,
  });
}
