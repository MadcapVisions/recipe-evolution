import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { postCookFeedbackSchema } from "@/lib/ai/feedback/postCookFeedbackTypes";
import { applyPostCookFeedback } from "@/lib/ai/feedback/applyPostCookFeedback";
import { extractRecipeFeatures, type TasteModel } from "@/lib/ai/tasteModel";
import { invalidateLearnedSignalsCache } from "@/lib/ai/learnedSignals";
import { trackServerEvent } from "@/lib/trackServerEvent";

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

  // Accidental duplicate guard
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

  // Fetch version ingredients for taste-feature extraction (best-effort)
  const { data: version } = await supabase
    .from("recipe_versions")
    .select("ingredients_json, dish_family")
    .eq("id", versionId)
    .maybeSingle();

  const ingredientNames = (
    version?.ingredients_json as Array<{ name?: string }> | null ?? []
  )
    .map((i) => i.name ?? "")
    .filter(Boolean);

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

  // Fire-and-forget: update taste scores, invalidate profile + signal caches.
  // Failures here are non-fatal — the feedback row is already committed.
  void (async () => {
    try {
      const { data: scoresRow } = await supabase
        .from("user_taste_scores")
        .select("scores_json")
        .eq("owner_id", user.id)
        .maybeSingle();

      const currentModel = (scoresRow?.scores_json as TasteModel | null) ?? null;

      const features = extractRecipeFeatures({
        title: recipe.title ?? "",
        tags: Array.isArray(recipe.tags) ? (recipe.tags as string[]) : [],
        ingredients: ingredientNames,
        dishFamily: (version?.dish_family as string | null) ?? null,
      });

      const updatedModel = applyPostCookFeedback(
        currentModel,
        { overall_outcome, would_make_again: would_make_again ?? null, issue_tags, notes: notes ?? null },
        features
      );

      await supabase
        .from("user_taste_scores")
        .upsert(
          { owner_id: user.id, scores_json: updatedModel, updated_at: new Date().toISOString() },
          { onConflict: "owner_id" }
        );

      // Invalidate cached taste profile so next AI generation call rebuilds it
      await supabase
        .from("user_taste_profiles")
        .update({ updated_at: new Date(0).toISOString() })
        .eq("owner_id", user.id);

      // Invalidate in-process learned-signal cache
      invalidateLearnedSignalsCache(user.id);

      // Emit telemetry: a learned signal was generated from this cook event
      await trackServerEvent(supabase, user.id, "learned_signal_generated", {
        outcome: overall_outcome,
        issue_tag_count: issue_tags.length,
        would_make_again: would_make_again ?? null,
      });
    } catch (err) {
      console.error("Failed to update taste scores from post-cook feedback", err);
    }
  })();

  return NextResponse.json({ ok: true, id: inserted.id, created_at: inserted.created_at });
}
