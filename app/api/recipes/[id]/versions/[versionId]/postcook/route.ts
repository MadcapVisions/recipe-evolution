import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { postCookFeedbackSchema } from "@/lib/ai/feedback/postCookFeedbackTypes";

/** Reject identical (user, version, outcome) submissions within this window. */
const DUPLICATE_WINDOW_MS = 30_000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { id: recipeId, versionId } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ownership check — also fetches title and tags for feature extraction later
  const { data: recipe } = await supabase
    .from("recipes")
    .select("owner_id, title, tags")
    .eq("id", recipeId)
    .maybeSingle();
  if (!recipe || recipe.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = postCookFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { overall_outcome, would_make_again, issue_tags, notes } = parsed.data;

  // Accidental duplicate guard: same outcome submitted for same version within 30s
  const windowStart = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const { data: recent } = await supabase
    .from("recipe_postcook_feedback")
    .select("id")
    .eq("user_id", user.id)
    .eq("recipe_version_id", versionId)
    .eq("overall_outcome", overall_outcome)
    .gte("created_at", windowStart)
    .limit(1);

  if (recent && recent.length > 0) {
    return NextResponse.json(
      { error: "Duplicate submission", code: "DUPLICATE_WINDOW" },
      { status: 409 }
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from("recipe_postcook_feedback")
    .insert({
      user_id: user.id,
      recipe_id: recipeId,
      recipe_version_id: versionId,
      overall_outcome,
      would_make_again: would_make_again ?? null,
      issues: issue_tags,
      notes: notes ?? null,
    })
    .select("id, created_at")
    .single();

  if (insertError) {
    console.error("Failed to insert post-cook feedback", insertError.message);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: inserted.id, created_at: inserted.created_at });
}
