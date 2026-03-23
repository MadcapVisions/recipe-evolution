import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getRecipeDetailTag, getRecipeLibraryTag, getRecipeSidebarTag, getRecipeSummaryTag } from "@/lib/cacheTags";
import { DISH_FAMILIES } from "@/lib/ai/homeRecipeAlignment";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const recipePatchSchema = z.object({
  best_version_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200).optional(),
  dish_family: z.enum(DISH_FAMILIES).nullable().optional(),
});

async function requireOwnedRecipe(recipeId: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, owned: false as const, bestVersionId: null };
  }

  const { data: ownedRecipe, error } = await supabase
    .from("recipes")
    .select("id, best_version_id")
    .eq("id", recipeId)
    .eq("owner_id", user.id)
    .maybeSingle();

  return {
    supabase,
    user,
    owned: !error && Boolean(ownedRecipe),
    bestVersionId: (ownedRecipe as { best_version_id?: string | null } | null)?.best_version_id ?? null,
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id: recipeId } = await context.params;
  const { supabase, user, owned, bestVersionId } = await requireOwnedRecipe(recipeId);

  if (!user) {
    return NextResponse.json({ error: true, message: "Authentication required." }, { status: 401 });
  }

  if (!owned) {
    return NextResponse.json({ error: true, message: "Recipe not found or access denied." }, { status: 403 });
  }

  let payload;
  try {
    payload = recipePatchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: true, message: "Invalid recipe update." }, { status: 400 });
  }

  if (payload.best_version_id) {
    const { data: ownedVersion, error: versionError } = await supabase
      .from("recipe_versions")
      .select("id")
      .eq("id", payload.best_version_id)
      .eq("recipe_id", recipeId)
      .maybeSingle();

    if (versionError || !ownedVersion) {
      return NextResponse.json({ error: true, message: "Version not found or access denied." }, { status: 403 });
    }
  }

  const updates: Record<string, unknown> = {};
  if (payload.best_version_id !== undefined) updates.best_version_id = payload.best_version_id;
  if (payload.title !== undefined) updates.title = payload.title.trim();
  if (payload.dish_family !== undefined) updates.dish_family = payload.dish_family;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: true, message: "Nothing to update." }, { status: 400 });
  }

  const { error } = await supabase
    .from("recipes")
    .update(updates)
    .eq("id", recipeId);

  if (error) {
    return NextResponse.json({ error: true, message: "Could not update recipe." }, { status: 500 });
  }

  revalidateTag(getRecipeLibraryTag(user.id), "max");
  revalidateTag(getRecipeSidebarTag(user.id), "max");
  revalidateTag(getRecipeSummaryTag(recipeId), "max");
  if (bestVersionId) {
    revalidateTag(getRecipeDetailTag(user.id, recipeId, bestVersionId), "max");
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id: recipeId } = await context.params;
  const { supabase, user, owned } = await requireOwnedRecipe(recipeId);

  if (!user) {
    return NextResponse.json({ error: true, message: "Authentication required." }, { status: 401 });
  }

  if (!owned) {
    return NextResponse.json({ error: true, message: "Recipe not found or access denied." }, { status: 403 });
  }

  const { error } = await supabase.from("recipes").delete().eq("id", recipeId);
  if (error) {
    return NextResponse.json({ error: true, message: "Could not delete recipe." }, { status: 500 });
  }

  revalidateTag(getRecipeLibraryTag(user.id), "max");
  revalidateTag(getRecipeSidebarTag(user.id), "max");

  return NextResponse.json({ ok: true });
}
