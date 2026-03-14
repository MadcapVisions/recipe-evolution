import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { loadCachedVersionDetailData } from "@/lib/versionDetailData";
import { getRecipeDetailTag, getRecipeLibraryTag, getRecipePhotosTag, getRecipeTimelineTag } from "@/lib/cacheTags";

type RouteContext = {
  params: Promise<{ id: string; versionId: string }>;
};

const versionPatchSchema = z.object({
  version_label: z.string().trim().min(1).optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

async function requireOwnedVersion(recipeId: string, versionId: string) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, owned: false as const };
  }

  const [{ data: ownedRecipe, error: recipeError }, { data: ownedVersion, error: versionError }] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, best_version_id")
      .eq("id", recipeId)
      .eq("owner_id", user.id)
      .maybeSingle(),
    supabase
      .from("recipe_versions")
      .select("id")
      .eq("id", versionId)
      .eq("recipe_id", recipeId)
      .maybeSingle(),
  ]);

  return {
    supabase,
    user,
    recipe: ownedRecipe,
    owned: !recipeError && !versionError && Boolean(ownedRecipe) && Boolean(ownedVersion),
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const { id, versionId } = await context.params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await loadCachedVersionDetailData(user.id, id, versionId);
  if (!data) {
    return NextResponse.json({ error: "Version not found or access denied." }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id: recipeId, versionId } = await context.params;
  const { supabase, user, owned } = await requireOwnedVersion(recipeId, versionId);

  if (!user) {
    return NextResponse.json({ error: true, message: "Authentication required." }, { status: 401 });
  }

  if (!owned) {
    return NextResponse.json({ error: true, message: "Version not found or access denied." }, { status: 403 });
  }

  let payload;
  try {
    payload = versionPatchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: true, message: "Invalid version update." }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof payload.version_label === "string") {
    update.version_label = payload.version_label;
  }
  if (typeof payload.rating === "number") {
    update.rating = payload.rating;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: true, message: "No version fields to update." }, { status: 400 });
  }

  const { error } = await supabase.from("recipe_versions").update(update).eq("id", versionId);
  if (error) {
    return NextResponse.json({ error: true, message: "Could not update version." }, { status: 500 });
  }

  revalidateTag(getRecipeLibraryTag(user.id), "max");
  revalidateTag(getRecipeTimelineTag(recipeId), "max");
  revalidateTag(getRecipeDetailTag(user.id, recipeId, versionId), "max");

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id: recipeId, versionId } = await context.params;
  const { supabase, user, recipe, owned } = await requireOwnedVersion(recipeId, versionId);

  if (!user) {
    return NextResponse.json({ error: true, message: "Authentication required." }, { status: 401 });
  }

  if (!owned || !recipe) {
    return NextResponse.json({ error: true, message: "Version not found or access denied." }, { status: 403 });
  }

  const { count, error: countError } = await supabase
    .from("recipe_versions")
    .select("id", { count: "exact", head: true })
    .eq("recipe_id", recipeId);

  if (countError) {
    return NextResponse.json({ error: true, message: "Could not validate version delete." }, { status: 500 });
  }

  if ((count ?? 0) <= 1) {
    return NextResponse.json(
      { error: true, message: "Can't delete the only version. Delete the recipe instead." },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("recipe_versions").delete().eq("id", versionId);
  if (error) {
    return NextResponse.json({ error: true, message: "Could not delete version." }, { status: 500 });
  }

  if (recipe.best_version_id === versionId) {
    await supabase.from("recipes").update({ best_version_id: null }).eq("id", recipeId);
  }

  revalidateTag(getRecipeLibraryTag(user.id), "max");
  revalidateTag(getRecipeTimelineTag(recipeId), "max");
  revalidateTag(getRecipeDetailTag(user.id, recipeId, versionId), "max");
  revalidateTag(getRecipePhotosTag(versionId), "max");

  return NextResponse.json({ ok: true });
}
