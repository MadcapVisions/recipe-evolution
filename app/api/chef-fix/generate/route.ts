import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { generateAndPersistChefFixes } from "@/lib/ai/chefScoreStore";

const bodySchema = z.object({
  recipe_version_id: z.string().uuid(),
  mode: z.enum(["reliability", "flavor", "expert"]).optional(),
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
    return NextResponse.json({ error: true, message: "recipe_version_id is required." }, { status: 400 });
  }

  const result = await generateAndPersistChefFixes(supabase, user.id, parsed.data.recipe_version_id, parsed.data.mode);
  if (!result) {
    return NextResponse.json({ error: true, message: "Recipe version not found." }, { status: 404 });
  }

  return NextResponse.json({
    current_score: result.fixes.currentScore,
    projected_score: result.fixes.projectedScore,
    projected_delta: result.fixes.projectedDelta,
    fixes: result.fixes.fixes,
    biggest_weakness: result.score.improvementPriorities[0] ?? null,
  });
}
