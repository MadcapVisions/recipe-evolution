import test from "node:test";
import assert from "node:assert/strict";
import {
  shouldShowIssueTags,
  shouldShowImproveCTA,
  buildPostCookPayload,
} from "../../lib/postcook/postCookFlowLogic";

test("shouldShowIssueTags returns false for great outcome", () => {
  assert.equal(shouldShowIssueTags("great"), false);
});

test("shouldShowIssueTags returns true for good_with_changes", () => {
  assert.equal(shouldShowIssueTags("good_with_changes"), true);
});

test("shouldShowIssueTags returns true for disappointing", () => {
  assert.equal(shouldShowIssueTags("disappointing"), true);
});

test("shouldShowIssueTags returns true for failed", () => {
  assert.equal(shouldShowIssueTags("failed"), true);
});

test("shouldShowImproveCTA returns false for great with no tags", () => {
  assert.equal(shouldShowImproveCTA("great", []), false);
});

test("shouldShowImproveCTA returns true for disappointing even without tags", () => {
  assert.equal(shouldShowImproveCTA("disappointing", []), true);
});

test("shouldShowImproveCTA returns true for failed even without tags", () => {
  assert.equal(shouldShowImproveCTA("failed", []), true);
});

test("shouldShowImproveCTA returns false for great with issue tags (edge case guarded)", () => {
  assert.equal(shouldShowImproveCTA("great", ["too_bland"]), false);
});

test("shouldShowImproveCTA returns true for good_with_changes with tags", () => {
  assert.equal(shouldShowImproveCTA("good_with_changes", ["too_heavy"]), true);
});

test("shouldShowImproveCTA returns false for good_with_changes with no tags", () => {
  assert.equal(shouldShowImproveCTA("good_with_changes", []), false);
});

test("buildPostCookPayload maps all fields correctly", () => {
  const payload = buildPostCookPayload("great", [], true, "Tasted perfect.");
  assert.equal(payload.overall_outcome, "great");
  assert.deepEqual(payload.issue_tags, []);
  assert.equal(payload.would_make_again, true);
  assert.equal(payload.notes, "Tasted perfect.");
});

test("buildPostCookPayload defaults would_make_again to null", () => {
  const payload = buildPostCookPayload("disappointing", ["too_bland"], null, null);
  assert.equal(payload.would_make_again, null);
});

test("buildPostCookPayload defaults notes to null when empty string", () => {
  const payload = buildPostCookPayload("great", [], null, "");
  assert.equal(payload.notes, null);
});

test("buildPostCookPayload trims whitespace-only notes to null", () => {
  const payload = buildPostCookPayload("great", [], null, "   ");
  assert.equal(payload.notes, null);
});

test("buildPostCookPayload clamps notes to 500 chars", () => {
  const long = "x".repeat(600);
  const payload = buildPostCookPayload("great", [], null, long);
  assert.equal(payload.notes?.length, 500);
});

test("buildPostCookPayload includes issue_tags as array", () => {
  const payload = buildPostCookPayload("good_with_changes", ["too_spicy", "too_heavy"], false, null);
  assert.deepEqual(payload.issue_tags, ["too_spicy", "too_heavy"]);
});
