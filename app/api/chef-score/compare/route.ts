import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { compareChefScoresForVersions } from "@/lib/ai/chefScoreStore";

const bodySchema = z.object({
  base_version_id: z.string().uuid(),
  candidate_version_id: z.string().uuid(),
});

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
    return NextResponse.json({ error: true, message: "Both version ids are required." }, { status: 400 });
  }

  const result = await compareChefScoresForVersions(
    supabase,
    user.id,
    parsed.data.base_version_id,
    parsed.data.candidate_version_id
  );
  if (!result) {
    return NextResponse.json({ error: true, message: "One or both recipe versions were not found." }, { status: 404 });
  }

  return NextResponse.json({
    base_score: result.baseScore,
    candidate_score: result.candidateScore,
    delta: result.delta,
    improved_areas: result.improvedAreas,
    regressions: result.regressions,
    improvement_drivers: result.improvementDrivers,
    regression_drivers: result.regressionDrivers,
  });
}
