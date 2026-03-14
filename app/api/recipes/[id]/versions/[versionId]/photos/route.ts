import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { loadCachedVersionPhotosWithUrls } from "@/lib/versionDetailData";
import { getRecipeDetailTag, getRecipeLibraryTag, getRecipePhotosTag } from "@/lib/cacheTags";

type RouteContext = {
  params: Promise<{ id: string; versionId: string }>;
};

const photoInsertSchema = z.object({
  storagePath: z.string().min(1),
});

const photoDeleteSchema = z.object({
  photoId: z.string().min(1),
  storagePath: z.string().min(1),
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
      .select("id")
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
    owned: !recipeError && !versionError && Boolean(ownedRecipe) && Boolean(ownedVersion),
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const { id: recipeId, versionId } = await context.params;
  const { user, owned } = await requireOwnedVersion(recipeId, versionId);

  if (!user) {
    return NextResponse.json({ error: true, message: "Authentication required." }, { status: 401 });
  }

  if (!owned) {
    return NextResponse.json({ error: true, message: "Recipe not found or access denied." }, { status: 403 });
  }

  const photos = await loadCachedVersionPhotosWithUrls(versionId);
  if (!photos) {
    return NextResponse.json({ error: true, message: "Could not load photos." }, { status: 500 });
  }

  return NextResponse.json({ photos });
}

export async function POST(request: Request, context: RouteContext) {
  const { id: recipeId, versionId } = await context.params;
  const { supabase, user, owned } = await requireOwnedVersion(recipeId, versionId);

  if (!user) {
    return NextResponse.json({ error: true, message: "Authentication required." }, { status: 401 });
  }

  if (!owned) {
    return NextResponse.json({ error: true, message: "Recipe not found or access denied." }, { status: 403 });
  }

  let payload;
  try {
    payload = photoInsertSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: true, message: "Invalid photo payload." }, { status: 400 });
  }

  const { error } = await supabase.from("version_photos").insert({
    version_id: versionId,
    storage_path: payload.storagePath,
  });

  if (error) {
    return NextResponse.json({ error: true, message: "Could not save photo." }, { status: 500 });
  }

  revalidateTag(getRecipeLibraryTag(user.id), "max");
  revalidateTag(getRecipeDetailTag(user.id, recipeId, versionId), "max");
  revalidateTag(getRecipePhotosTag(versionId), "max");

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id: recipeId, versionId } = await context.params;
  const { supabase, user, owned } = await requireOwnedVersion(recipeId, versionId);

  if (!user) {
    return NextResponse.json({ error: true, message: "Authentication required." }, { status: 401 });
  }

  if (!owned) {
    return NextResponse.json({ error: true, message: "Recipe not found or access denied." }, { status: 403 });
  }

  let payload;
  try {
    payload = photoDeleteSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: true, message: "Invalid photo payload." }, { status: 400 });
  }

  const objectPath = payload.storagePath.startsWith("version-photos/")
    ? payload.storagePath.replace(/^version-photos\//, "")
    : payload.storagePath;

  const { error: storageError } = await supabase.storage.from("version-photos").remove([objectPath]);
  if (storageError) {
    return NextResponse.json({ error: true, message: "Could not delete photo." }, { status: 500 });
  }

  const { error } = await supabase
    .from("version_photos")
    .delete()
    .eq("id", payload.photoId)
    .eq("version_id", versionId);

  if (error) {
    return NextResponse.json({ error: true, message: "Could not delete photo." }, { status: 500 });
  }

  revalidateTag(getRecipeLibraryTag(user.id), "max");
  revalidateTag(getRecipeDetailTag(user.id, recipeId, versionId), "max");
  revalidateTag(getRecipePhotosTag(versionId), "max");

  return NextResponse.json({ ok: true });
}
