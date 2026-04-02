import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostCookFeedback } from "@/lib/ai/feedback/postCookFeedbackTypes";

/**
 * Formats a post-cook feedback record into a concise context string for the
 * improve-recipe system prompt. Pure function — safe to call in tests.
 * Returns null if feedback is null (no prior cook event for this version).
 */
export function formatPostCookImproveContext(
  feedback: PostCookFeedback | null
): string | null {
  if (!feedback) return null;

  const lines: string[] = [
    `The user previously cooked this version and rated it: ${feedback.overall_outcome}.`,
  ];

  if (feedback.would_make_again === false) {
    lines.push("They indicated they would not make again as-is.");
  }

  if (feedback.issue_tags.length > 0) {
    lines.push(`Issues they flagged: ${feedback.issue_tags.join(", ")}.`);
  }

  if (feedback.notes) {
    lines.push(`Their notes: "${feedback.notes}"`);
  }

  lines.push(
    "Use this context to make your improvement directly address their experience. Do not mention that you received feedback — just incorporate it."
  );

  return lines.join(" ");
}

/**
 * Fetches the most recent post-cook feedback for a specific recipe version.
 * Returns null if no feedback has been submitted for this version.
 */
export async function buildPostCookImproveContext(
  supabase: SupabaseClient,
  recipeId: string,
  versionId: string,
  ownerId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("recipe_postcook_feedback")
    .select("overall_outcome, issue_tags, would_make_again, notes")
    .eq("recipe_id", recipeId)
    .eq("version_id", versionId)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const feedback: PostCookFeedback = {
    overall_outcome: data.overall_outcome as PostCookFeedback["overall_outcome"],
    issue_tags: (data.issue_tags as PostCookFeedback["issue_tags"]) ?? [],
    would_make_again: data.would_make_again as boolean | null,
    notes: data.notes as string | null,
  };

  return formatPostCookImproveContext(feedback);
}
