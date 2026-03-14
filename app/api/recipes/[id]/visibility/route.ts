import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getRecipeLibraryTag, getRecipeSidebarTag } from "@/lib/cacheTags";

const visibilitySchema = z.object({
  state: z.enum(["hidden", "archived"]),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function hasOwnedRecipe(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  recipeId: string,
  userId: string
) {
  const { data: ownedRecipe, error } = await supabase
    .from("recipes")
    .select("id")
    .eq("id", recipeId)
    .eq("owner_id", userId)
    .maybeSingle();

  return !error && Boolean(ownedRecipe);
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

  if (!(await hasOwnedRecipe(supabase, recipeId, user.id))) {
    return NextResponse.json({ error: true, message: "Recipe not found or access denied." }, { status: 403 });
  }

  let payload;
  try {
    payload = visibilitySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: true, message: "Invalid visibility state." }, { status: 400 });
  }

  const { error } = await supabase.from("recipe_visibility_states").upsert(
    {
      owner_id: user.id,
      recipe_id: recipeId,
      state: payload.state,
    },
    { onConflict: "owner_id,recipe_id" }
  );

  if (error) {
    return NextResponse.json({ error: true, message: "Could not update recipe visibility." }, { status: 500 });
  }

  revalidateTag(getRecipeLibraryTag(user.id), "max");
  revalidateTag(getRecipeSidebarTag(user.id), "max");

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id: recipeId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: true, message: "Authentication required." }, { status: 401 });
  }

  if (!(await hasOwnedRecipe(supabase, recipeId, user.id))) {
    return NextResponse.json({ error: true, message: "Recipe not found or access denied." }, { status: 403 });
  }

  const { error } = await supabase
    .from("recipe_visibility_states")
    .delete()
    .eq("owner_id", user.id)
    .eq("recipe_id", recipeId);

  if (error) {
    return NextResponse.json({ error: true, message: "Could not update recipe visibility." }, { status: 500 });
  }

  revalidateTag(getRecipeLibraryTag(user.id), "max");
  revalidateTag(getRecipeSidebarTag(user.id), "max");

  return NextResponse.json({ ok: true });
}
