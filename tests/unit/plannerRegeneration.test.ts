import test from "node:test";
import assert from "node:assert/strict";
import type { PlannerDraftAssignment, PlannerCandidate } from "../../lib/planner/plannerEngine";
import {
  __plannerRegenerationInternals,
  buildTransientPlannerDraft,
  regeneratePlannerDraft,
  type PlannerDraftNight,
  type PlannerRegenerationCandidate,
} from "../../lib/planner/plannerRegeneration";

const WEEK_DATES = [
  "2026-04-06",
  "2026-04-07",
  "2026-04-08",
  "2026-04-09",
  "2026-04-10",
  "2026-04-11",
  "2026-04-12",
] as const;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function candidate(
  input: Partial<PlannerRegenerationCandidate> &
    Pick<PlannerRegenerationCandidate, "recipeId" | "versionId" | "title">
): PlannerRegenerationCandidate {
  const base: PlannerCandidate = {
    recipeId: input.recipeId,
    versionId: input.versionId,
    title: input.title,
    lifecycle: "kept",
    planningEligibility: "eligible",
    effort: "medium",
    qualityScore: 84,
    learnedScore: 0.4,
    repeatScore: 0.5,
    overlapScore: 0.2,
    isFavorite: false,
    wouldMakeAgain: true,
    hasRecentNegativeOutcome: false,
    complexityComplaintCount: 0,
    ingredientKeys: [],
    sharedPrepKeys: [],
    cuisineKey: null,
    proteinKey: null,
  };

  return {
    ...base,
    ...input,
    planningEligibilityReason: input.planningEligibilityReason ?? "explicit_non_draft",
  };
}

function assignment(
  input: Partial<PlannerDraftAssignment> & Pick<PlannerDraftAssignment, "dayIndex" | "recipeId" | "versionId" | "title">
): PlannerDraftAssignment {
  return {
    dayIndex: input.dayIndex,
    recipeId: input.recipeId,
    versionId: input.versionId,
    title: input.title,
    score: input.score ?? 5,
    reasonCodes: input.reasonCodes ?? ["good_weeknight_fit"],
  };
}

function manualNight(overrides: Partial<PlannerDraftNight> = {}): PlannerDraftNight {
  return {
    date: WEEK_DATES[0],
    dayIndex: 0,
    dayLabel: "Mon",
    origin: "manual",
    isLocked: false,
    isFlexible: false,
    isSelectedForRegeneration: false,
    recipeId: "r1",
    versionId: "v1",
    title: "Manual Swap",
    score: 4.5,
    reasonCodes: ["good_weeknight_fit"],
    reasonLabels: ["Quick weeknight fit"],
    planningEligibilityReason: "explicit_non_draft",
    ...overrides,
  };
}

test("single generated night regenerates successfully", () => {
  const draft = buildTransientPlannerDraft({
    mode: "plan_three_dinners",
    assignments: [assignment({ dayIndex: 0, recipeId: "r1", versionId: "v1", title: "Original Bowl", score: 4.2 })],
    weekDates: [...WEEK_DATES],
    dayLabels: DAY_LABELS,
    planningEligibilityReasonByVersionId: new Map([["v1", "explicit_non_draft"], ["v2", "explicit_non_draft"]]),
  });

  const result = regeneratePlannerDraft({
    draft,
    targetedDates: [WEEK_DATES[0]],
    candidates: [
      candidate({ recipeId: "r1", versionId: "v1", title: "Original Bowl", qualityScore: 80, repeatScore: 0.3 }),
      candidate({ recipeId: "r2", versionId: "v2", title: "Better Bowl", qualityScore: 92, repeatScore: 0.8 }),
    ],
    sparseData: false,
  });

  assert.equal(result.resultsByDate[WEEK_DATES[0]]?.status, "replaced");
  assert.equal(result.updatedDraft.nights[0]?.versionId, "v2");
});

test("untouched nights remain unchanged", () => {
  const draft = buildTransientPlannerDraft({
    mode: "plan_three_dinners",
    assignments: [
      assignment({ dayIndex: 0, recipeId: "r1", versionId: "v1", title: "Original Bowl", score: 4.2 }),
      assignment({ dayIndex: 2, recipeId: "r3", versionId: "v3", title: "Keep Me", score: 5.1 }),
    ],
    weekDates: [...WEEK_DATES],
    dayLabels: DAY_LABELS,
  });

  const result = regeneratePlannerDraft({
    draft,
    targetedDates: [WEEK_DATES[0]],
    candidates: [
      candidate({ recipeId: "r2", versionId: "v2", title: "Better Bowl", qualityScore: 92, repeatScore: 0.8 }),
      candidate({ recipeId: "r3", versionId: "v3", title: "Keep Me", qualityScore: 88 }),
    ],
    sparseData: false,
  });

  assert.equal(result.updatedDraft.nights[1]?.versionId, "v3");
  assert.equal(result.updatedDraft.nights[1]?.title, "Keep Me");
});

test("manual-edited night is not regenerable by default", () => {
  assert.equal(__plannerRegenerationInternals.isNightRegenerableByDefault(manualNight()), false);
});

test("manual-edited night regenerates when explicitly selected", () => {
  const draft = {
    mode: "plan_three_dinners" as const,
    nights: [manualNight()],
  };

  const result = regeneratePlannerDraft({
    draft,
    targetedDates: [WEEK_DATES[0]],
    candidates: [
      candidate({ recipeId: "r2", versionId: "v2", title: "Trusted Swap", qualityScore: 94, repeatScore: 0.85 }),
    ],
    sparseData: false,
  });

  assert.equal(result.resultsByDate[WEEK_DATES[0]]?.status, "replaced");
  assert.equal(result.updatedDraft.nights[0]?.origin, "generated");
});

test("flexible unfilled night is preserved unless explicitly selected", () => {
  const flexible: PlannerDraftNight = {
    ...manualNight({
      date: WEEK_DATES[2],
      dayIndex: 2,
      dayLabel: "Wed",
      origin: "empty",
      isFlexible: true,
      recipeId: null,
      versionId: null,
      title: null,
      score: null,
      reasonCodes: [],
      reasonLabels: [],
      planningEligibilityReason: null,
    }),
  };

  const draft = buildTransientPlannerDraft({
    mode: "plan_three_dinners",
    assignments: [assignment({ dayIndex: 0, recipeId: "r1", versionId: "v1", title: "Original Bowl", score: 4.2 })],
    weekDates: [...WEEK_DATES],
    dayLabels: DAY_LABELS,
  });
  draft.nights.push(flexible);

  const result = regeneratePlannerDraft({
    draft,
    targetedDates: [WEEK_DATES[0]],
    candidates: [candidate({ recipeId: "r2", versionId: "v2", title: "Better Bowl", qualityScore: 92, repeatScore: 0.8 })],
    sparseData: false,
  });

  const flexibleNight = result.updatedDraft.nights.find((night) => night.date === WEEK_DATES[2]);
  assert.equal(flexibleNight?.versionId, null);
  assert.equal(flexibleNight?.isFlexible, true);
});

test("accepted week input remains unchanged before apply", () => {
  const existingMeals = [
    {
      dayIndex: 1,
      title: "Accepted Pasta",
      effort: "medium" as const,
      ingredientKeys: ["pasta"],
      sharedPrepKeys: [],
      cuisineKey: "italian",
      proteinKey: null,
    },
  ];
  const snapshot = structuredClone(existingMeals);
  const draft = buildTransientPlannerDraft({
    mode: "plan_three_dinners",
    assignments: [assignment({ dayIndex: 0, recipeId: "r1", versionId: "v1", title: "Original Bowl", score: 4.2 })],
    weekDates: [...WEEK_DATES],
    dayLabels: DAY_LABELS,
  });

  regeneratePlannerDraft({
    draft,
    targetedDates: [WEEK_DATES[0]],
    candidates: [candidate({ recipeId: "r2", versionId: "v2", title: "Better Bowl", qualityScore: 92, repeatScore: 0.8 })],
    existingMeals,
    sparseData: false,
  });

  assert.deepEqual(existingMeals, snapshot);
});

test("no better option keeps original suggestion", () => {
  const draft = buildTransientPlannerDraft({
    mode: "plan_three_dinners",
    assignments: [assignment({ dayIndex: 0, recipeId: "r1", versionId: "v1", title: "Original Bowl", score: 5.8 })],
    weekDates: [...WEEK_DATES],
    dayLabels: DAY_LABELS,
  });

  const result = regeneratePlannerDraft({
    draft,
    targetedDates: [WEEK_DATES[0]],
    candidates: [candidate({ recipeId: "r2", versionId: "v2", title: "Weaker Bowl", qualityScore: 74, repeatScore: 0.1 })],
    sparseData: false,
  });

  assert.equal(result.updatedDraft.nights[0]?.versionId, "v1");
  assert.ok(["kept_original", "no_better_option"].includes(result.resultsByDate[WEEK_DATES[0]]?.status ?? ""));
});

test("regenerated night gets refreshed reasons", () => {
  const draft = buildTransientPlannerDraft({
    mode: "build_easy_week",
    assignments: [assignment({ dayIndex: 0, recipeId: "r1", versionId: "v1", title: "Original Bowl", score: 4.2 })],
    weekDates: [...WEEK_DATES],
    dayLabels: DAY_LABELS,
  });

  const result = regeneratePlannerDraft({
    draft,
    targetedDates: [WEEK_DATES[0]],
    candidates: [
      candidate({
        recipeId: "r2",
        versionId: "v2",
        title: "Easy Winner",
        effort: "low",
        qualityScore: 94,
        repeatScore: 0.9,
      }),
    ],
    sparseData: false,
  });

  assert.notDeepEqual(result.updatedDraft.nights[0]?.reasonLabels, draft.nights[0]?.reasonLabels);
  assert.ok(result.updatedDraft.nights[0]?.reasonLabels.length);
});

test("multi-night regeneration preserves non-targeted nights", () => {
  const draft = buildTransientPlannerDraft({
    mode: "plan_three_dinners",
    assignments: [
      assignment({ dayIndex: 0, recipeId: "r1", versionId: "v1", title: "Night One", score: 4.2 }),
      assignment({ dayIndex: 2, recipeId: "r2", versionId: "v2", title: "Night Two", score: 4.1 }),
      assignment({ dayIndex: 4, recipeId: "r3", versionId: "v3", title: "Night Three", score: 4.7 }),
    ],
    weekDates: [...WEEK_DATES],
    dayLabels: DAY_LABELS,
  });

  const result = regeneratePlannerDraft({
    draft,
    targetedDates: [WEEK_DATES[0], WEEK_DATES[2]],
    candidates: [
      candidate({ recipeId: "r4", versionId: "v4", title: "Swap One", qualityScore: 92, repeatScore: 0.8 }),
      candidate({ recipeId: "r5", versionId: "v5", title: "Swap Two", qualityScore: 95, repeatScore: 0.95, learnedScore: 0.8 }),
      candidate({ recipeId: "r3", versionId: "v3", title: "Night Three", qualityScore: 89 }),
    ],
    sparseData: false,
  });

  assert.equal(result.updatedDraft.nights.find((night) => night.date === WEEK_DATES[4])?.versionId, "v3");
  assert.equal(result.resultsByDate[WEEK_DATES[0]]?.status, "replaced");
  assert.ok(
    ["replaced", "kept_original", "no_better_option"].includes(result.resultsByDate[WEEK_DATES[2]]?.status ?? "")
  );
});
