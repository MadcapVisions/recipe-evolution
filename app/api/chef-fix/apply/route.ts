import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { applyChefFixActions, generateAndPersistChefFixes, getOwnedRecipeVersion, calculateAndPersistChefScore } from "@/lib/ai/chefScoreStore";
import { compareChefScores } from "@/lib/ai/chefScoring";
import { seedRecipeSessionFromSavedRecipe } from "@/lib/ai/recipeSessionStore";
import { getRecipeDetailTag, getRecipeLibraryTag, getRecipePhotosTag, getRecipeSidebarTag, getRecipeTimelineTag } from "@/lib/cacheTags";

const bodySchema = z.object({
  recipe_version_id: z.string().uuid(),
  selected_fix_keys: z.array(z.string()).min(1),
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
    return NextResponse.json({ error: true, message: "Invalid fix apply request." }, { status: 400 });
  }

  const generated = await generateAndPersistChefFixes(supabase, user.id, parsed.data.recipe_version_id, parsed.data.mode);
  const version = await getOwnedRecipeVersion(supabase, user.id, parsed.data.recipe_version_id);
  if (!generated || !version) {
    return NextResponse.json({ error: true, message: "Recipe version not found." }, { status: 404 });
  }

  const selectedFixes = generated.fixes.fixes.filter((fix) => parsed.data.selected_fix_keys.includes(fix.issueKey));
  if (selectedFixes.length === 0) {
    return NextResponse.json({ error: true, message: "No matching fixes were selected." }, { status: 400 });
  }

  const fixSessionInsert = await supabase
    .from("recipe_fix_sessions")
    .insert({
      recipe_version_id: version.recipeVersionId,
      owner_id: user.id,
      status: "previewed",
      projected_score_delta: selectedFixes.reduce((sum, fix) => sum + fix.estimatedImpact, 0),
      selected_fixes: selectedFixes.map((fix) => fix.issueKey),
    })
    .select("id")
    .single();

  const fixSessionId = fixSessionInsert.data?.id as string | undefined;
  const actions = selectedFixes.flatMap((fix) => fix.actions);
  const applied = applyChefFixActions(
    {
      title: version.recipeTitle,
      ingredients: version.ingredients,
      steps: version.steps,
      notes: version.notes,
    },
    actions
  );

  const { data: insertedRows, error: insertError } = await supabase.rpc("create_recipe_version", {
    p_recipe_id: version.recipeId,
    p_version_label: "Chef Fix Version",
    p_change_summary: applied.explanation ?? "Applied the top chef fixes.",
    p_servings: version.servings,
    p_prep_time_min: version.prepTimeMin,
    p_cook_time_min: version.cookTimeMin,
    p_difficulty: version.difficulty,
    p_ingredients_json: applied.ingredients,
    p_steps_json: applied.steps,
    p_notes: applied.notes,
    p_change_log: applied.explanation ?? null,
    p_ai_metadata_json: {
      source: "chef_fix",
      selected_fix_keys: selectedFixes.map((fix) => fix.issueKey),
      mode: parsed.data.mode ?? null,
    },
  });

  const insertedVersion = Array.isArray(insertedRows) ? insertedRows[0] : null;
  if (insertError || !insertedVersion) {
    return NextResponse.json({ error: true, message: insertError?.message ?? "Could not create fixed version." }, { status: 500 });
  }

  if (fixSessionId) {
    await supabase.from("recipe_fix_actions").insert(
      selectedFixes.flatMap((fix) =>
        fix.actions.map((action) => ({
          fix_session_id: fixSessionId,
          owner_id: user.id,
          action_type: action.type,
          action_payload: action,
          rationale: action.rationale,
          estimated_impact: fix.estimatedImpact,
          applied: true,
        }))
      )
    );
    await supabase
      .from("recipe_fix_sessions")
      .update({ status: "applied", created_recipe_version_id: insertedVersion.id })
      .eq("id", fixSessionId);
  }

  await seedRecipeSessionFromSavedRecipe(supabase, {
    ownerId: user.id,
    recipeId: version.recipeId,
    versionId: insertedVersion.id as string,
    draft: {
      title: version.recipeTitle,
      servings: version.servings,
      prep_time_min: version.prepTimeMin,
      cook_time_min: version.cookTimeMin,
      difficulty: version.difficulty,
      ingredients: applied.ingredients,
      steps: applied.steps,
    },
    seed: null,
    inheritFromRecipeId: version.recipeId,
  }).catch(() => undefined);

  const newScore = await calculateAndPersistChefScore(supabase, user.id, insertedVersion.id as string);

  revalidateTag(getRecipeLibraryTag(user.id), "max");
  revalidateTag(getRecipeSidebarTag(user.id), "max");
  revalidateTag(getRecipeTimelineTag(version.recipeId), "max");
  revalidateTag(getRecipeDetailTag(user.id, version.recipeId, version.recipeVersionId), "max");
  revalidateTag(getRecipeDetailTag(user.id, version.recipeId, insertedVersion.id as string), "max");
  revalidateTag(getRecipePhotosTag(insertedVersion.id as string), "max");

  return NextResponse.json({
    new_recipe_version_id: insertedVersion.id,
    old_score: generated.score.totalScore,
    new_score: newScore?.score.totalScore ?? null,
    delta: newScore ? newScore.score.totalScore - generated.score.totalScore : null,
    applied_fixes: selectedFixes.map((fix) => fix.issueKey),
    improved_areas: newScore ? compareChefScores(generated.score, newScore.score).improvedAreas : [],
    regressions: newScore ? compareChefScores(generated.score, newScore.score).regressions : [],
  });
}
