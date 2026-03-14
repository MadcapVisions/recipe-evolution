import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const prepProgressSchema = z.object({
  checklist_item_id: z.string().min(1),
  completed: z.boolean(),
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

  const [{ data: recipe }, { data: version }] = await Promise.all([
    supabase.from("recipes").select("id").eq("id", recipeId).eq("owner_id", user.id).maybeSingle(),
    supabase.from("recipe_versions").select("id").eq("id", versionId).eq("recipe_id", recipeId).maybeSingle(),
  ]);

  return { supabase, user, owned: Boolean(recipe) && Boolean(version) };
}

export async function GET(_request: Request, context: RouteContext) {
  const { id: recipeId, versionId } = await context.params;
  const { supabase, user, owned } = await requireOwnedVersion(recipeId, versionId);
  if (!user) return NextResponse.json({ error: true, message: "Authentication required." }, { status: 401 });
  if (!owned) return NextResponse.json({ error: true, message: "Recipe not found or access denied." }, { status: 403 });

  const { data, error } = await supabase
    .from("recipe_prep_progress")
    .select("checklist_item_id")
    .eq("owner_id", user.id)
    .eq("recipe_id", recipeId)
    .eq("version_id", versionId)
    .not("completed_at", "is", null);

  if (error) return NextResponse.json({ error: true, message: error.message }, { status: 500 });
  return NextResponse.json({ completedChecklistIds: (data ?? []).map((item) => item.checklist_item_id) });
}

export async function POST(request: Request, context: RouteContext) {
  const { id: recipeId, versionId } = await context.params;
  const { supabase, user, owned } = await requireOwnedVersion(recipeId, versionId);
  if (!user) return NextResponse.json({ error: true, message: "Authentication required." }, { status: 401 });
  if (!owned) return NextResponse.json({ error: true, message: "Recipe not found or access denied." }, { status: 403 });

  let payload;
  try {
    payload = prepProgressSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: true, message: "Invalid prep progress payload." }, { status: 400 });
  }

  const { error } = await supabase
    .from("recipe_prep_progress")
    .upsert(
      {
        owner_id: user.id,
        recipe_id: recipeId,
        version_id: versionId,
        checklist_item_id: payload.checklist_item_id,
        completed_at: payload.completed ? new Date().toISOString() : null,
      },
      { onConflict: "owner_id,version_id,checklist_item_id" }
    );

  if (error) return NextResponse.json({ error: true, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
