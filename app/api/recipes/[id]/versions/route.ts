import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { ZodError } from "zod";
import { normalizeRecipeVersionPayload } from "@/lib/recipes/recipeDraft";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { loadCachedRecipeTimelineSlice } from "@/lib/versionDetailData";
import { getRecipeDetailTag, getRecipeLibraryTag, getRecipePhotosTag, getRecipeSidebarTag, getRecipeTimelineTag } from "@/lib/cacheTags";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function getValidationMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Invalid version payload.";
}

export async function GET(request: Request, context: RouteContext) {
  const { id: recipeId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: true, message: "Authentication required." }, { status: 401 });
  }

  const { data: ownedRecipe, error: recipeError } = await supabase
    .from("recipes")
    .select("id")
    .eq("id", recipeId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (recipeError || !ownedRecipe) {
    return NextResponse.json({ error: true, message: "Recipe not found or access denied." }, { status: 403 });
  }

  const url = new URL(request.url);
  const currentVersionId = url.searchParams.get("currentVersionId");
  const offset = Math.max(Number(url.searchParams.get("offset") ?? "0") || 0, 0);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "8") || 8, 1), 24);

  if (!currentVersionId) {
    return NextResponse.json({ error: true, message: "currentVersionId is required." }, { status: 400 });
  }

  const timeline = await loadCachedRecipeTimelineSlice(recipeId, currentVersionId, { offset, limit });
  if (!timeline) {
    return NextResponse.json({ error: true, message: "Could not load versions." }, { status: 500 });
  }

  return NextResponse.json(timeline);
}

export async function POST(request: Request, context: RouteContext) {
  const { id: recipeId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: true, message: "Authentication required." }, { status: 401 });
  }

  let body;

  try {
    body = normalizeRecipeVersionPayload(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: true, message: getValidationMessage(error) }, { status: 400 });
    }
    return NextResponse.json({ error: true, message: "Invalid version payload." }, { status: 400 });
  }

  const { data: ownedRecipe, error: recipeError } = await supabase
    .from("recipes")
    .select("id")
    .eq("id", recipeId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (recipeError || !ownedRecipe) {
    return NextResponse.json({ error: true, message: "Recipe not found or access denied." }, { status: 403 });
  }

  const { data, error: insertError } = await supabase.rpc("create_recipe_version", {
    p_recipe_id: recipeId,
    p_version_label: body.version_label,
    p_change_summary: body.change_summary,
    p_servings: body.servings,
    p_prep_time_min: body.prep_time_min,
    p_cook_time_min: body.cook_time_min,
    p_difficulty: body.difficulty,
    p_ingredients_json: body.ingredients,
    p_steps_json: body.steps,
    p_notes: body.notes,
    p_change_log: body.change_log,
    p_ai_metadata_json: body.ai_metadata_json,
  });

  const insertedVersion = Array.isArray(data) ? data[0] : null;

  if (insertError || !insertedVersion) {
    return NextResponse.json(
      { error: true, message: insertError?.message ?? "Failed to create version." },
      { status: 500 }
    );
  }

  revalidateTag(getRecipeLibraryTag(user.id), "max");
  revalidateTag(getRecipeSidebarTag(user.id), "max");
  revalidateTag(getRecipeTimelineTag(recipeId), "max");
  revalidateTag(getRecipeDetailTag(user.id, recipeId, insertedVersion.id), "max");
  revalidateTag(getRecipePhotosTag(insertedVersion.id), "max");

  return NextResponse.json({ version: insertedVersion });
}
