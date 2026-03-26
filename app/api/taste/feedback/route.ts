import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { applyFeedback, extractRecipeFeatures, type TasteModel } from "@/lib/ai/tasteModel";

const bodySchema = z.object({
  recipe_id: z.string().uuid(),
  recipe_version_id: z.string().uuid(),
  signal: z.enum(["thumbs_up", "thumbs_down"]),
  reason: z
    .enum(["too_heavy", "too_spicy", "dont_like_ingredients", "not_what_i_wanted"])
    .nullable()
    .optional(),
  recipe_title: z.string(),
  recipe_tags: z.array(z.string()).optional().default([]),
  recipe_ingredients: z.array(z.string()).optional().default([]),
  dish_family: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const {
    recipe_id,
    recipe_version_id,
    signal,
    reason,
    recipe_title,
    recipe_tags,
    recipe_ingredients,
    dish_family,
  } = parsed.data;

  // Upsert feedback record (replace previous feedback for same version to avoid duplicates)
  const { error: upsertFeedbackError } = await supabase
    .from("recipe_feedback")
    .upsert(
      {
        owner_id: user.id,
        recipe_id,
        recipe_version_id,
        signal,
        reason: reason ?? null,
      },
      { onConflict: "owner_id,recipe_version_id" }
    );

  if (upsertFeedbackError) {
    console.error("Failed to upsert recipe_feedback", upsertFeedbackError.message);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }

  // Fetch current taste scores
  const { data: scoresRow } = await supabase
    .from("user_taste_scores")
    .select("scores_json")
    .eq("owner_id", user.id)
    .maybeSingle();

  const currentModel = (scoresRow?.scores_json as TasteModel | null) ?? null;

  const features = extractRecipeFeatures({
    title: recipe_title,
    tags: recipe_tags,
    ingredients: recipe_ingredients,
    dishFamily: dish_family ?? null,
  });

  const updatedModel = applyFeedback(currentModel, signal, reason ?? null, features);

  // Persist updated scores
  const { error: scoresError } = await supabase
    .from("user_taste_scores")
    .upsert(
      { owner_id: user.id, scores_json: updatedModel, updated_at: new Date().toISOString() },
      { onConflict: "owner_id" }
    );

  if (scoresError) {
    console.error("Failed to upsert user_taste_scores", scoresError.message);
  }

  // Invalidate taste profile cache so next AI call rebuilds it
  await supabase
    .from("user_taste_profiles")
    .update({ updated_at: new Date(0).toISOString() })
    .eq("owner_id", user.id);

  return NextResponse.json({ ok: true });
}
