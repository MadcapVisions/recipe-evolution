import test from "node:test";
import assert from "node:assert/strict";
import {
  postCookFeedbackSchema,
  POST_COOK_OVERALL_OUTCOMES,
  POST_COOK_ISSUE_TAGS,
} from "../../lib/ai/feedback/postCookFeedbackTypes";

test("postCookFeedbackSchema accepts a valid minimal payload", () => {
  const result = postCookFeedbackSchema.safeParse({ overall_outcome: "great" });
  assert.ok(result.success);
  assert.equal(result.data!.overall_outcome, "great");
  assert.deepEqual(result.data!.issue_tags, []);
  assert.equal(result.data!.would_make_again, null);
  assert.equal(result.data!.notes, null);
});

test("postCookFeedbackSchema accepts a fully filled payload", () => {
  const result = postCookFeedbackSchema.safeParse({
    overall_outcome: "disappointing",
    would_make_again: false,
    issue_tags: ["too_bland", "too_heavy"],
    notes: "Needed more salt and less cream.",
  });
  assert.ok(result.success);
  assert.equal(result.data!.overall_outcome, "disappointing");
  assert.equal(result.data!.would_make_again, false);
  assert.deepEqual(result.data!.issue_tags, ["too_bland", "too_heavy"]);
});

test("postCookFeedbackSchema rejects an unknown overall_outcome", () => {
  const result = postCookFeedbackSchema.safeParse({ overall_outcome: "meh" });
  assert.ok(!result.success);
});

test("postCookFeedbackSchema rejects a positive meta tag as an issue tag", () => {
  const result = postCookFeedbackSchema.safeParse({
    overall_outcome: "good_with_changes",
    issue_tags: ["loved_it"],
  });
  assert.ok(!result.success);
});

test("postCookFeedbackSchema rejects notes longer than 500 chars", () => {
  const result = postCookFeedbackSchema.safeParse({
    overall_outcome: "great",
    notes: "a".repeat(501),
  });
  assert.ok(!result.success);
});

test("postCookFeedbackSchema accepts notes at exactly 500 chars", () => {
  const result = postCookFeedbackSchema.safeParse({
    overall_outcome: "great",
    notes: "a".repeat(500),
  });
  assert.ok(result.success);
});

test("POST_COOK_OVERALL_OUTCOMES contains exactly four values", () => {
  assert.equal(POST_COOK_OVERALL_OUTCOMES.length, 4);
  assert.ok(POST_COOK_OVERALL_OUTCOMES.includes("great"));
  assert.ok(POST_COOK_OVERALL_OUTCOMES.includes("failed"));
});

test("POST_COOK_ISSUE_TAGS contains exactly nine values", () => {
  assert.equal(POST_COOK_ISSUE_TAGS.length, 9);
  assert.ok(POST_COOK_ISSUE_TAGS.includes("too_bland"));
  assert.ok(POST_COOK_ISSUE_TAGS.includes("texture_off"));
});
