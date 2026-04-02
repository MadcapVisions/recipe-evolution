import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPlannerWeekDraft,
  type ExistingPlannedMeal,
  type PlannerCandidate,
} from "../../lib/planner/plannerEngine";

function candidate(input: Partial<PlannerCandidate> & Pick<PlannerCandidate, "recipeId" | "versionId" | "title">): PlannerCandidate {
  return {
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
    ...input,
  };
}

test("buildPlannerWeekDraft excludes draft candidates from default assisted planning", () => {
  const result = buildPlannerWeekDraft({
    mode: "plan_three_dinners",
    sparseData: false,
    candidates: [
      candidate({ recipeId: "r1", versionId: "v1", title: "Trusted Pasta", qualityScore: 88 }),
      candidate({ recipeId: "r2", versionId: "v2", title: "Experimental Draft", lifecycle: "draft", qualityScore: 95 }),
      candidate({ recipeId: "r3", versionId: "v3", title: "Soup", qualityScore: 82 }),
      candidate({ recipeId: "r4", versionId: "v4", title: "Tacos", qualityScore: 80 }),
    ],
  });

  assert.equal(result.assignments.some((assignment) => assignment.versionId === "v2"), false);
});

test("buildPlannerWeekDraft prefers sparse-data-safe strong kept recipes", () => {
  const result = buildPlannerWeekDraft({
    mode: "plan_three_dinners",
    sparseData: true,
    candidates: [
      candidate({ recipeId: "r1", versionId: "v1", title: "Favorite Chicken", isFavorite: true, qualityScore: 90 }),
      candidate({ recipeId: "r2", versionId: "v2", title: "Average Pasta", qualityScore: 76, learnedScore: 0.1 }),
      candidate({ recipeId: "r3", versionId: "v3", title: "Strong Soup", qualityScore: 87 }),
    ],
  });

  assert.equal(result.assignments[0]?.versionId, "v1");
  assert.ok(result.assignments[0]?.reasonCodes.includes("sparse_data_safe_choice"));
});

test("buildPlannerWeekDraft avoids stacking high-effort meals on adjacent days", () => {
  const result = buildPlannerWeekDraft({
    mode: "fill_five_weeknights",
    sparseData: false,
    fillCount: 3,
    candidates: [
      candidate({ recipeId: "r1", versionId: "v1", title: "Braised Short Ribs", effort: "high", qualityScore: 92 }),
      candidate({ recipeId: "r2", versionId: "v2", title: "Quick Noodles", effort: "low", qualityScore: 81 }),
      candidate({ recipeId: "r3", versionId: "v3", title: "Roast Chicken", effort: "high", qualityScore: 89 }),
      candidate({ recipeId: "r4", versionId: "v4", title: "Simple Soup", effort: "low", qualityScore: 79 }),
    ],
  });

  const highEffortDays = result.assignments
    .filter((assignment) => assignment.title === "Braised Short Ribs" || assignment.title === "Roast Chicken")
    .map((assignment) => assignment.dayIndex)
    .sort((a, b) => a - b);

  assert.equal(highEffortDays.length >= 2 && highEffortDays[1] - highEffortDays[0] <= 1, false);
});

test("buildPlannerWeekDraft rewards meaningful overlap but penalizes monotony", () => {
  const existingMeals: ExistingPlannedMeal[] = [
    {
      dayIndex: 1,
      title: "Lemon Chicken Bowls",
      effort: "medium",
      ingredientKeys: ["lemon", "spinach", "rice"],
      sharedPrepKeys: ["herb_sauce"],
      cuisineKey: "mediterranean",
      proteinKey: "chicken",
    },
  ];

  const result = buildPlannerWeekDraft({
    mode: "reuse_ingredients",
    sparseData: false,
    fillCount: 2,
    candidates: [
      candidate({
        recipeId: "r1",
        versionId: "v1",
        title: "Lemony Herb Rice",
        ingredientKeys: ["lemon", "rice", "parsley"],
        sharedPrepKeys: ["herb_sauce"],
        cuisineKey: "mediterranean",
        proteinKey: "fish",
        overlapScore: 0.9,
      }),
      candidate({
        recipeId: "r2",
        versionId: "v2",
        title: "Another Chicken Bowl",
        ingredientKeys: ["rice", "spinach", "chicken"],
        cuisineKey: "mediterranean",
        proteinKey: "chicken",
        overlapScore: 1,
      }),
      candidate({
        recipeId: "r3",
        versionId: "v3",
        title: "Black Bean Tacos",
        ingredientKeys: ["lime", "beans", "cilantro"],
        cuisineKey: "mexican",
        proteinKey: "beans",
        overlapScore: 0.3,
      }),
    ],
    existingMeals,
  });

  const topTitles = result.assignments.map((assignment) => assignment.title);
  assert.ok(topTitles.includes("Lemony Herb Rice"));
  assert.equal(topTitles.includes("Another Chicken Bowl"), false);
});

test("build_easy_week prefers low-effort trusted meals over higher-effort alternatives", () => {
  const result = buildPlannerWeekDraft({
    mode: "build_easy_week",
    sparseData: false,
    fillCount: 3,
    candidates: [
      candidate({ recipeId: "r1", versionId: "v1", title: "Sheet Pan Sausage", effort: "low", qualityScore: 85, repeatScore: 0.6 }),
      candidate({ recipeId: "r2", versionId: "v2", title: "Quick Soup", effort: "low", qualityScore: 82, repeatScore: 0.55 }),
      candidate({ recipeId: "r3", versionId: "v3", title: "Project Lasagna", effort: "high", qualityScore: 92, repeatScore: 0.7 }),
      candidate({ recipeId: "r4", versionId: "v4", title: "Simple Tacos", effort: "medium", qualityScore: 84, repeatScore: 0.5 }),
    ],
  });

  assert.equal(result.assignments.some((assignment) => assignment.title === "Project Lasagna"), false);
  assert.ok(result.assignments.some((assignment) => assignment.reasonCodes.includes("good_easy_week_fit")));
});

test("build_easy_week relaxes toward medium-effort trusted meals when low-effort options are thin", () => {
  const result = buildPlannerWeekDraft({
    mode: "build_easy_week",
    sparseData: false,
    fillCount: 2,
    candidates: [
      candidate({ recipeId: "r1", versionId: "v1", title: "Roasted Salmon", effort: "medium", qualityScore: 88, repeatScore: 0.7 }),
      candidate({ recipeId: "r2", versionId: "v2", title: "Turkey Chili", effort: "medium", qualityScore: 84, repeatScore: 0.55 }),
      candidate({ recipeId: "r3", versionId: "v3", title: "Weekend Bolognese", effort: "high", qualityScore: 91, repeatScore: 0.75 }),
    ],
  });

  assert.equal(result.assignments.length, 2);
  assert.equal(result.assignments.some((assignment) => assignment.title === "Weekend Bolognese"), false);
});

test("build_easy_week penalizes cautionary and complexity-complaint candidates", () => {
  const result = buildPlannerWeekDraft({
    mode: "build_easy_week",
    sparseData: false,
    fillCount: 1,
    candidates: [
      candidate({
        recipeId: "r1",
        versionId: "v1",
        title: "Trusted Stir-Fry",
        effort: "medium",
        qualityScore: 83,
        repeatScore: 0.45,
      }),
      candidate({
        recipeId: "r2",
        versionId: "v2",
        title: "Fussy Unknown Version",
        planningEligibility: "cautionary",
        lifecycle: "unknown",
        effort: "low",
        qualityScore: 87,
        repeatScore: 0.4,
        complexityComplaintCount: 2,
      }),
    ],
  });

  assert.equal(result.assignments[0]?.versionId, "v1");
});

test("build_easy_week fails conservatively when only weak candidates remain", () => {
  const result = buildPlannerWeekDraft({
    mode: "build_easy_week",
    sparseData: false,
    fillCount: 2,
    candidates: [
      candidate({
        recipeId: "r1",
        versionId: "v1",
        title: "Unproven Unknown",
        planningEligibility: "cautionary",
        lifecycle: "unknown",
        effort: "high",
        qualityScore: 72,
        repeatScore: -0.2,
        learnedScore: 0,
        wouldMakeAgain: false,
        hasRecentNegativeOutcome: true,
        complexityComplaintCount: 2,
      }),
    ],
  });

  assert.equal(result.assignments.length, 0);
});

test("buildPlannerWeekDraft keeps trust-first ordering over overlap-only optimization", () => {
  const result = buildPlannerWeekDraft({
    mode: "reuse_ingredients",
    sparseData: false,
    fillCount: 2,
    candidates: [
      candidate({
        recipeId: "r1",
        versionId: "v1",
        title: "Trusted Salmon",
        qualityScore: 92,
        repeatScore: 0.8,
        ingredientKeys: ["salmon", "lemon", "rice"],
        proteinKey: "salmon",
      }),
      candidate({
        recipeId: "r2",
        versionId: "v2",
        title: "Trusted Soup",
        qualityScore: 88,
        repeatScore: 0.7,
        ingredientKeys: ["broth", "spinach", "beans"],
        proteinKey: "beans",
      }),
      candidate({
        recipeId: "r3",
        versionId: "v3",
        title: "Weak Overlap Pasta",
        planningEligibility: "cautionary",
        lifecycle: "unknown",
        qualityScore: 72,
        repeatScore: -0.2,
        ingredientKeys: ["salmon", "lemon", "rice"],
        proteinKey: "salmon",
      }),
    ],
  });

  assert.equal(result.assignments.some((assignment) => assignment.versionId === "v3"), false);
});

test("buildPlannerWeekDraft keeps sparse-data suggestions sane when overlap is weak", () => {
  const result = buildPlannerWeekDraft({
    mode: "reuse_ingredients",
    sparseData: true,
    fillCount: 2,
    candidates: [
      candidate({ recipeId: "r1", versionId: "v1", title: "Favorite Chili", isFavorite: true, qualityScore: 89 }),
      candidate({ recipeId: "r2", versionId: "v2", title: "Strong Salad", qualityScore: 86, ingredientKeys: ["spinach", "apple"] }),
      candidate({
        recipeId: "r3",
        versionId: "v3",
        title: "Weak Overlap Bowl",
        planningEligibility: "cautionary",
        lifecycle: "unknown",
        qualityScore: 71,
        repeatScore: -0.1,
        ingredientKeys: ["spinach", "apple", "rice"],
      }),
    ],
  });

  assert.equal(result.assignments.some((assignment) => assignment.versionId === "v3"), false);
  assert.ok(result.assignments[0]?.reasonCodes.includes("sparse_data_safe_choice"));
});
