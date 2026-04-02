import test from "node:test";
import assert from "node:assert/strict";
import { __plannerCandidateInternals } from "../../lib/planner/plannerCandidates";
import type { LearnedSignals } from "../../lib/ai/learnedSignals";

test("selectPlannerVersion prefers best_version_id when present", () => {
  const selected = __plannerCandidateInternals.selectPlannerVersion(
    {
      id: "r1",
      title: "Soup",
      tags: null,
      updated_at: null,
      is_favorite: false,
      best_version_id: "v1",
      dish_family: "soup",
    },
    [
      { id: "v2", recipe_id: "r1", version_number: 2, version_label: "New", servings: 2, prep_time_min: 10, cook_time_min: 20, difficulty: "Easy", ingredients_json: [], steps_json: [] },
      { id: "v1", recipe_id: "r1", version_number: 1, version_label: "Best", servings: 2, prep_time_min: 10, cook_time_min: 20, difficulty: "Easy", ingredients_json: [], steps_json: [] },
    ],
    new Map([
      ["v1", 88],
      ["v2", 75],
    ]),
    new Map()
  );

  assert.equal(selected?.version.id, "v1");
  assert.equal(selected?.planningEligibility, "eligible");
});

test("inferLifecycleState returns kept for best version and unknown otherwise when no explicit lifecycle exists", () => {
  const kept = __plannerCandidateInternals.inferLifecycleState(
    {
      id: "r1",
      title: "Soup",
      tags: null,
      updated_at: null,
      is_favorite: false,
      best_version_id: "v1",
      dish_family: "soup",
    },
    { id: "v1", recipe_id: "r1", version_number: 1, version_label: null, servings: 2, prep_time_min: 10, cook_time_min: 20, difficulty: "Easy", ingredients_json: [], steps_json: [] }
  );

  const unknown = __plannerCandidateInternals.inferLifecycleState(
    {
      id: "r1",
      title: "Soup",
      tags: null,
      updated_at: null,
      is_favorite: false,
      best_version_id: "v1",
      dish_family: "soup",
    },
    { id: "v2", recipe_id: "r1", version_number: 2, version_label: null, servings: 2, prep_time_min: 10, cook_time_min: 20, difficulty: "Easy", ingredients_json: [], steps_json: [] }
  );

  assert.equal(kept, "kept");
  assert.equal(unknown, "unknown");
});

test("deriveLearnedScore matches structured learned-signal keys against recipe metadata", () => {
  const signals: LearnedSignals = {
    patterns: [
      { key: "prefers_chicken", label: "Likes chicken", confidence: "medium", direction: "positive" },
      { key: "prefers_spicy", label: "Spicy", confidence: "medium", direction: "negative" },
    ],
    overallConfidence: "medium",
    generatedAt: new Date().toISOString(),
  };

  const score = __plannerCandidateInternals.deriveLearnedScore(
    signals,
    {
      id: "r1",
      title: "Chicken Tacos",
      tags: ["weeknight"],
      updated_at: null,
      is_favorite: false,
      best_version_id: null,
      dish_family: "tacos",
    },
    { id: "v1", recipe_id: "r1", version_number: 1, version_label: "Chicken", servings: 2, prep_time_min: 10, cook_time_min: 20, difficulty: "Easy", ingredients_json: [], steps_json: [] }
  );

  assert.equal(score > 0, true);
});

test("selectPlannerVersion excludes weaker unknown latest version when older kept version is stronger", () => {
  const selected = __plannerCandidateInternals.selectPlannerVersion(
    {
      id: "r1",
      title: "Soup",
      tags: null,
      updated_at: null,
      is_favorite: false,
      best_version_id: "v1",
      dish_family: "soup",
    },
    [
      { id: "v2", recipe_id: "r1", version_number: 2, version_label: "Latest", servings: 2, prep_time_min: 10, cook_time_min: 20, difficulty: "Easy", ingredients_json: [], steps_json: [] },
      { id: "v1", recipe_id: "r1", version_number: 1, version_label: "Best", servings: 2, prep_time_min: 10, cook_time_min: 20, difficulty: "Easy", ingredients_json: [], steps_json: [] },
    ],
    new Map([
      ["v1", 90],
      ["v2", 72],
    ]),
    new Map()
  );

  assert.equal(selected?.version.id, "v1");
  assert.equal(selected?.planningEligibility, "eligible");
});

test("summarizeFeedback counts repeated complexity complaints for easy-week penalties", () => {
  const summary = __plannerCandidateInternals.summarizeFeedback([
    {
      recipe_id: "r1",
      recipe_version_id: "v1",
      overall_outcome: "good_with_changes",
      would_make_again: true,
      issues: ["too_many_steps", "too_complex"],
      created_at: "2026-04-01T12:00:00.000Z",
    },
    {
      recipe_id: "r1",
      recipe_version_id: "v1",
      overall_outcome: "great",
      would_make_again: true,
      issues: ["too_many_steps"],
      created_at: "2026-03-25T12:00:00.000Z",
    },
  ]);

  assert.equal(summary.complexityComplaintCount, 3);
  assert.equal(summary.wouldMakeAgain, true);
});

test("missing recipe_postcook_feedback schema-cache error is treated as optional compatibility gap", () => {
  assert.equal(
    __plannerCandidateInternals.isMissingPostCookFeedbackTableError(
      "Could not find the table 'public.recipe_postcook_feedback' in the schema cache"
    ),
    true
  );
  assert.equal(
    __plannerCandidateInternals.isMissingPostCookFeedbackTableError("permission denied for table recipe_postcook_feedback"),
    false
  );
});
