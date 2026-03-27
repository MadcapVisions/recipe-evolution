import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { calculateAndPersistChefScore } from "@/lib/ai/chefScoreStore";

const bodySchema = z.object({
  recipe_version_id: z.string().uuid(),
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

  const result = await calculateAndPersistChefScore(supabase, user.id, parsed.data.recipe_version_id);
  if (!result) {
    return NextResponse.json({ error: true, message: "Recipe version not found." }, { status: 404 });
  }

  return NextResponse.json({
    analysis: result.score.analysis,
    rules: result.score.matchedRules.slice(0, 10).map((rule) => ({
      id: rule.id,
      rule_key: rule.ruleKey,
      title: rule.title,
      layer: rule.layer,
      category: rule.category,
      subcategory: rule.subcategory,
      type: rule.ruleType,
      severity: rule.severity,
      user_explanation: rule.userExplanation,
      failure_if_missing: rule.failureIfMissing,
      action_type: rule.actionType,
      action_payload_template: rule.actionPayloadTemplate,
      priority: rule.priority,
    })),
    insights: result.score.intelligence.insights,
  });
}
