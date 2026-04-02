// app/api/user/taste-scores/reset/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { invalidateLearnedSignalsCache } from "@/lib/ai/learnedSignals";

export async function POST(): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Clear learned taste scores
  const { error: scoresError } = await supabase
    .from("user_taste_scores")
    .upsert(
      { owner_id: user.id, scores_json: null, updated_at: new Date().toISOString() },
      { onConflict: "owner_id" }
    );

  if (scoresError) {
    console.error("Failed to reset taste scores", scoresError.message);
    return NextResponse.json({ error: "Failed to reset preferences" }, { status: 500 });
  }

  // Invalidate cached taste profile so next AI call rebuilds cleanly
  await supabase
    .from("user_taste_profiles")
    .update({ updated_at: new Date(0).toISOString() })
    .eq("owner_id", user.id);

  // Invalidate in-process learned-signal cache
  invalidateLearnedSignalsCache(user.id);

  return NextResponse.json({ ok: true });
}
