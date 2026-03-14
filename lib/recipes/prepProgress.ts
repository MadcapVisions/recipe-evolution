import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function loadPrepProgress(recipeId: string, versionId: string, ownerId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("recipe_prep_progress")
    .select("checklist_item_id, completed_at")
    .eq("owner_id", ownerId)
    .eq("recipe_id", recipeId)
    .eq("version_id", versionId)
    .not("completed_at", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((item) => item.checklist_item_id);
}
