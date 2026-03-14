import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const groceryItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  normalized_name: z.string().min(1),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  prep: z.string().nullable(),
  checked: z.boolean(),
});

const groceryPayloadSchema = z.object({
  items: z.array(groceryItemSchema).min(1),
});

type RouteContext = {
  params: Promise<{ id: string; versionId: string }>;
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
    payload = groceryPayloadSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: true, message: "Invalid grocery payload." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("grocery_lists")
    .insert({
      owner_id: user.id,
      version_id: versionId,
      items_json: payload.items,
    })
    .select("id, items_json")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: true, message: error?.message ?? "Unable to create grocery list." }, { status: 500 });
  }

  return NextResponse.json({
    listId: data.id,
    items: data.items_json,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
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
    payload = groceryPayloadSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: true, message: "Invalid grocery payload." }, { status: 400 });
  }

  const { error } = await supabase
    .from("grocery_lists")
    .update({ items_json: payload.items })
    .eq("owner_id", user.id)
    .eq("version_id", versionId);

  if (error) {
    return NextResponse.json({ error: true, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
