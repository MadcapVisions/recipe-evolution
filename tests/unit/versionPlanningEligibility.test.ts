import test from "node:test";
import assert from "node:assert/strict";
import { getVersionPlanningEligibility } from "../../lib/planner/versionPlanningEligibility";

test("explicit draft is excluded", () => {
  assert.deepEqual(
    getVersionPlanningEligibility({
      explicitDraftState: "draft",
      isBestVersion: false,
      trustScore: 0.9,
    }),
    { state: "excluded", reason: "explicit_draft" }
  );
});

test("explicit non-draft is eligible", () => {
  assert.deepEqual(
    getVersionPlanningEligibility({
      explicitDraftState: "non_draft",
      isBestVersion: true,
      trustScore: 0.2,
    }),
    { state: "eligible", reason: "explicit_non_draft" }
  );
});

test("unknown high-trust version is cautionary when no stronger version exists", () => {
  assert.deepEqual(
    getVersionPlanningEligibility({
      explicitDraftState: "unknown",
      isBestVersion: true,
      trustScore: 0.82,
      hasStrongNegativeOutcome: false,
      hasStrongerOlderViableVersion: false,
      isFreshUnstableBranch: false,
    }),
    { state: "cautionary", reason: "unknown_but_trusted" }
  );
});

test("unknown weak-trust version is excluded", () => {
  assert.deepEqual(
    getVersionPlanningEligibility({
      explicitDraftState: "unknown",
      isBestVersion: false,
      trustScore: 0.2,
      hasStrongNegativeOutcome: false,
      hasStrongerOlderViableVersion: false,
      isFreshUnstableBranch: false,
    }),
    { state: "excluded", reason: "unknown_low_trust" }
  );
});

test("unknown version is excluded when stronger older viable version exists", () => {
  assert.deepEqual(
    getVersionPlanningEligibility({
      explicitDraftState: "unknown",
      isBestVersion: false,
      trustScore: 0.8,
      hasStrongNegativeOutcome: false,
      hasStrongerOlderViableVersion: true,
      isFreshUnstableBranch: false,
    }),
    { state: "excluded", reason: "superseded_by_stronger_version" }
  );
});

test("negative post-cook caution blocks unknown version", () => {
  assert.deepEqual(
    getVersionPlanningEligibility({
      explicitDraftState: "unknown",
      isBestVersion: false,
      trustScore: 0.9,
      hasStrongNegativeOutcome: true,
      hasStrongerOlderViableVersion: false,
      isFreshUnstableBranch: false,
    }),
    { state: "excluded", reason: "negative_outcome_caution" }
  );
});

test("fresh unstable unknown branch without strong trust is excluded", () => {
  assert.deepEqual(
    getVersionPlanningEligibility({
      explicitDraftState: "unknown",
      isBestVersion: false,
      trustScore: 0.45,
      hasStrongNegativeOutcome: false,
      hasStrongerOlderViableVersion: false,
      isFreshUnstableBranch: true,
    }),
    { state: "excluded", reason: "insufficient_evidence" }
  );
});
