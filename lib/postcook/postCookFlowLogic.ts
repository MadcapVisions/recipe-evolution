import type { PostCookOverallOutcome, PostCookIssueTag } from "@/lib/ai/feedback/postCookFeedbackTypes";

export function shouldShowIssueTags(outcome: PostCookOverallOutcome): boolean {
  return outcome !== "great";
}

export function shouldShowImproveCTA(
  outcome: PostCookOverallOutcome,
  issueTags: PostCookIssueTag[]
): boolean {
  if (outcome === "great") return false;
  if (outcome === "disappointing" || outcome === "failed") return true;
  return issueTags.length > 0;
}

export type PostCookPayload = {
  overall_outcome: PostCookOverallOutcome;
  issue_tags: PostCookIssueTag[];
  would_make_again: boolean | null;
  notes: string | null;
};

export function buildPostCookPayload(
  outcome: PostCookOverallOutcome,
  issueTags: PostCookIssueTag[],
  wouldMakeAgain: boolean | null,
  notes: string | null | undefined
): PostCookPayload {
  const trimmed = notes?.trim() ?? "";
  const cleanNotes = trimmed.length === 0 ? null : trimmed.slice(0, 500);

  return {
    overall_outcome: outcome,
    issue_tags: issueTags,
    would_make_again: wouldMakeAgain,
    notes: cleanNotes,
  };
}
