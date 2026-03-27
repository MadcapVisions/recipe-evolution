import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { applyChefFixActions, generateAndPersistChefFixes, getOwnedRecipeVersion } from "@/lib/ai/chefScoreStore";

function buildChangedItems(beforeItems: string[], afterItems: string[]) {
  const changes: Array<{ index: number; before: string; after: string }> = [];
  const maxLength = Math.max(beforeItems.length, afterItems.length);
  for (let index = 0; index < maxLength; index += 1) {
    const before = beforeItems[index] ?? "";
    const after = afterItems[index] ?? "";
    if (before !== after) {
      changes.push({ index, before, after });
    }
  }
  return changes;
}

function normalizeStringArray(values: unknown[], key: "name" | "text") {
  return values
    .map((value) => {
      if (typeof value === "string") return value;
      if (value && typeof value === "object" && typeof (value as Record<string, unknown>)[key] === "string") {
        return (value as Record<string, string>)[key];
      }
      return "";
    })
    .filter((value) => value.length > 0);
}

const bodySchema = z.object({
  recipe_version_id: z.string().uuid(),
  selected_fix_keys: z.array(z.string()).default([]),
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
    return NextResponse.json({ error: true, message: "Invalid fix preview request." }, { status: 400 });
  }

  const generated = await generateAndPersistChefFixes(supabase, user.id, parsed.data.recipe_version_id, parsed.data.mode);
  const version = await getOwnedRecipeVersion(supabase, user.id, parsed.data.recipe_version_id);
  if (!generated || !version) {
    return NextResponse.json({ error: true, message: "Recipe version not found." }, { status: 404 });
  }

  const selectedFixes = generated.fixes.fixes.filter((fix) => parsed.data.selected_fix_keys.includes(fix.issueKey));
  const actions = selectedFixes.flatMap((fix) => fix.actions);
  const preview = applyChefFixActions(
    {
      title: version.recipeTitle,
      ingredients: version.ingredients,
      steps: version.steps,
      notes: version.notes,
    },
    actions
  );
  const previewIngredients = normalizeStringArray(preview.ingredients as unknown[], "name");
  const previewSteps = normalizeStringArray(preview.steps as unknown[], "text");

  return NextResponse.json({
    selected_fix_keys: selectedFixes.map((fix) => fix.issueKey),
    preview: {
      changed_ingredients: buildChangedItems(version.ingredients, previewIngredients),
      changed_steps: buildChangedItems(version.steps, previewSteps),
      notes_before: version.notes,
      notes_after: preview.notes,
      ingredients: previewIngredients,
      steps: previewSteps,
      notes: preview.notes,
      explanation: preview.explanation,
    },
  });
}
