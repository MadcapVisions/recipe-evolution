// tests/unit/buildPostCookImproveContext.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatPostCookImproveContext } from "../../lib/ai/feedback/buildPostCookImproveContext";
import type { PostCookFeedback } from "../../lib/ai/feedback/postCookFeedbackTypes";

describe("formatPostCookImproveContext", () => {
  it("returns null for null input", () => {
    assert.equal(formatPostCookImproveContext(null), null);
  });

  it("includes outcome in output", () => {
    const fb: PostCookFeedback = {
      overall_outcome: "great",
      would_make_again: true,
      issue_tags: [],
      notes: null,
    };
    const result = formatPostCookImproveContext(fb);
    assert.ok(result?.includes("great"));
  });

  it("includes issue tags when present", () => {
    const fb: PostCookFeedback = {
      overall_outcome: "disappointing",
      would_make_again: false,
      issue_tags: ["too_spicy", "too_heavy"],
      notes: null,
    };
    const result = formatPostCookImproveContext(fb);
    assert.ok(result?.includes("too_spicy"));
    assert.ok(result?.includes("too_heavy"));
  });

  it("includes notes when present", () => {
    const fb: PostCookFeedback = {
      overall_outcome: "good_with_changes",
      would_make_again: true,
      issue_tags: [],
      notes: "Needs more garlic.",
    };
    const result = formatPostCookImproveContext(fb);
    assert.ok(result?.includes("Needs more garlic."));
  });

  it("omits notes section when notes is null", () => {
    const fb: PostCookFeedback = {
      overall_outcome: "great",
      would_make_again: null,
      issue_tags: [],
      notes: null,
    };
    const result = formatPostCookImproveContext(fb);
    assert.ok(!result?.toLowerCase().includes("notes:"));
  });

  it("includes would_make_again=false signal", () => {
    const fb: PostCookFeedback = {
      overall_outcome: "failed",
      would_make_again: false,
      issue_tags: [],
      notes: null,
    };
    const result = formatPostCookImproveContext(fb);
    assert.ok(result?.includes("would not make again"));
  });
});
