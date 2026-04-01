import { z } from "zod";

export const POST_COOK_OVERALL_OUTCOMES = [
  "great",
  "good_with_changes",
  "disappointing",
  "failed",
] as const;

export type PostCookOverallOutcome = (typeof POST_COOK_OVERALL_OUTCOMES)[number];

export const POST_COOK_ISSUE_TAGS = [
  "too_bland",
  "too_salty",
  "too_spicy",
  "too_heavy",
  "too_complex",
  "too_many_steps",
  "texture_off",
  "too_wet",
  "too_dry",
] as const;

export type PostCookIssueTag = (typeof POST_COOK_ISSUE_TAGS)[number];

export const postCookFeedbackSchema = z.object({
  overall_outcome: z.enum(POST_COOK_OVERALL_OUTCOMES),
  /**
   * Whether this recipe shape should remain a good resurfacing candidate.
   * NOT a cuisine-level dislike. NOT a broad preference statement.
   * Semantics: "I would want roughly this recipe suggested to me again."
   */
  would_make_again: z.boolean().nullable().optional().default(null),
  issue_tags: z.array(z.enum(POST_COOK_ISSUE_TAGS)).default([]),
  notes: z.string().max(500).nullable().optional().default(null),
});

export type PostCookFeedbackInput = z.infer<typeof postCookFeedbackSchema>;

/** Post-cook feedback after validation — all fields resolved to their final types. */
export type PostCookFeedback = {
  overall_outcome: PostCookOverallOutcome;
  would_make_again: boolean | null;
  issue_tags: PostCookIssueTag[];
  notes: string | null;
};
