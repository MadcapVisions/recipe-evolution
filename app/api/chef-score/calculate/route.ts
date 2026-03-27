import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { calculateAndPersistChefScore } from "@/lib/ai/chefScoreStore";

const bodySchema = z.object({
  recipe_version_id: z.string().uuid(),
});

function serialize(score: NonNullable<Awaited<ReturnType<typeof calculateAndPersistChefScore>>>["score"]) {
  return {
    total_score: score.totalScore,
    score_band: score.scoreBand,
    subscores: score.subscores,
    summary: score.summary,
    improvement_priorities: score.improvementPriorities,
    risk_flags: score.riskFlags,
    factors: score.factors,
  };
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: true, message: "Authentication required." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: true, message: "recipe_version_id is required." }, { status: 400 });
  }

  const result = await calculateAndPersistChefScore(supabase, user.id, parsed.data.recipe_version_id);
  if (!result) {
    return NextResponse.json({ error: true, message: "Recipe version not found." }, { status: 404 });
  }

  return NextResponse.json(serialize(result.score));
}
