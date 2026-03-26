import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { applyDecay, getOverallConfidenceLevel, type TasteModel } from "@/lib/ai/tasteModel";

export type TasteScoresResponse = {
  updatedAt: string;
  confidenceLevel: "low" | "medium" | "high";
  scores: {
    cuisines: Record<string, number>;
    proteins: Record<string, number>;
    flavors: Record<string, number>;
    dishFamilies: Record<string, number>;
    spiceTolerance: number | null;
    dislikedIngredients: string[];
  };
};

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: row } = await supabase
    .from("user_taste_scores")
    .select("scores_json, updated_at")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!row?.scores_json) {
    const empty: TasteScoresResponse = {
      updatedAt: new Date().toISOString(),
      confidenceLevel: "low",
      scores: {
        cuisines: {},
        proteins: {},
        flavors: {},
        dishFamilies: {},
        spiceTolerance: null,
        dislikedIngredients: [],
      },
    };
    return NextResponse.json(empty);
  }

  const raw = row.scores_json as TasteModel;
  const daysSince =
    (Date.now() - new Date(row.updated_at as string).getTime()) / (1000 * 60 * 60 * 24);

  // Lazy decay — compute decayed model without persisting (read-only)
  const model = applyDecay(raw, daysSince);

  const toScoreMap = (dict: Record<string, { score: number }>) =>
    Object.fromEntries(Object.entries(dict).map(([k, v]) => [k, v.score]));

  const strongDislikes = Object.entries(model.dislikedIngredients)
    .filter(([, s]) => s.score <= -0.5 && s.confidence >= 0.4)
    .sort(([, a], [, b]) => a.score - b.score)
    .map(([k]) => k);

  const response: TasteScoresResponse = {
    updatedAt: row.updated_at as string,
    confidenceLevel: getOverallConfidenceLevel(model),
    scores: {
      cuisines: toScoreMap(model.cuisines),
      proteins: toScoreMap(model.proteins),
      flavors: toScoreMap(model.flavors),
      dishFamilies: toScoreMap(model.dishFamilies),
      spiceTolerance: model.spiceTolerance?.score ?? null,
      dislikedIngredients: strongDislikes,
    },
  };

  return NextResponse.json(response);
}
