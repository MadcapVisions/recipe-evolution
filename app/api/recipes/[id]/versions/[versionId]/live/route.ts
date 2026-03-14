import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

type RouteContext = {
  params: Promise<{ id: string; versionId: string }>;
};

const makeSlug = () => {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let slug = "";
  for (let i = 0; i < 9; i += 1) {
    slug += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return slug;
};

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

export async function POST(_request: Request, context: RouteContext) {
  const { id: recipeId, versionId } = await context.params;
  const { supabase, user, owned } = await requireOwnedVersion(recipeId, versionId);

  if (!user) {
    return NextResponse.json({ error: true, message: "Authentication required." }, { status: 401 });
  }

  if (!owned) {
    return NextResponse.json({ error: true, message: "Recipe not found or access denied." }, { status: 403 });
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const shareSlug = makeSlug();
    const { error } = await supabase.from("cook_sessions").insert({
      version_id: versionId,
      owner_id: user.id,
      share_slug: shareSlug,
    });

    if (!error) {
      return NextResponse.json({ shareSlug });
    }

    if (!error.message.toLowerCase().includes("duplicate")) {
      const message = error.message.includes("public.cook_sessions")
        ? "Live sessions are not configured yet. Cooking mode still works."
        : error.message;
      return NextResponse.json({ error: true, message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: true, message: "Unable to create live session. Please try again." }, { status: 500 });
}
