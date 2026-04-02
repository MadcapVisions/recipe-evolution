import test from "node:test";
import assert from "node:assert/strict";
import { scoreWeeklyOverlap } from "../../lib/planner/plannerOverlap";
import type { WeeklyOverlapMeal } from "../../lib/planner/plannerOverlap";

function meal(input: Partial<WeeklyOverlapMeal> & Pick<WeeklyOverlapMeal, "dayKey" | "dayIndex" | "title">): WeeklyOverlapMeal {
  return {
    effort: "medium",
    ingredientKeys: [],
    sharedPrepKeys: [],
    cuisineKey: null,
    proteinKey: null,
    ...input,
  };
}

test("meaningful overlap increases weekly score", () => {
  const result = scoreWeeklyOverlap({
    draftMeals: [
      meal({ dayKey: "day-0", dayIndex: 0, title: "Chicken Orzo", ingredientKeys: ["chicken", "spinach", "orzo"], proteinKey: "chicken" }),
      meal({ dayKey: "day-2", dayIndex: 2, title: "Chicken Soup", ingredientKeys: ["chicken", "spinach", "broth"], proteinKey: "chicken" }),
    ],
    mode: "plan_three_dinners",
  });

  assert.ok(result.score > 0);
  assert.ok(result.reasonCodesByDayKey["day-0"]?.includes("reuses_ingredients"));
});

test("trivial overlap does not materially increase score", () => {
  const result = scoreWeeklyOverlap({
    draftMeals: [
      meal({ dayKey: "day-0", dayIndex: 0, title: "Soup", ingredientKeys: ["salt", "pepper", "olive oil"] }),
      meal({ dayKey: "day-2", dayIndex: 2, title: "Salad", ingredientKeys: ["salt", "pepper", "olive oil"] }),
    ],
    mode: "plan_three_dinners",
  });

  assert.ok(result.score <= 0.2);
  assert.equal(result.reasonCodesByDayKey["day-0"]?.includes("reuses_ingredients") ?? false, false);
});

test("monotony penalty suppresses repetitive weeks", () => {
  const repetitive = scoreWeeklyOverlap({
    draftMeals: [
      meal({ dayKey: "day-0", dayIndex: 0, title: "Chicken Rice 1", ingredientKeys: ["chicken", "spinach", "rice"], proteinKey: "chicken", cuisineKey: "weeknight" }),
      meal({ dayKey: "day-2", dayIndex: 2, title: "Chicken Rice 2", ingredientKeys: ["chicken", "spinach", "rice"], proteinKey: "chicken", cuisineKey: "weeknight" }),
      meal({ dayKey: "day-4", dayIndex: 4, title: "Chicken Rice 3", ingredientKeys: ["chicken", "spinach", "rice"], proteinKey: "chicken", cuisineKey: "weeknight" }),
    ],
    mode: "reuse_ingredients",
  });

  assert.ok(repetitive.score < 3);
  assert.ok(repetitive.monotonyPenalties.length > 0);
});

test("nearby accepted meals influence overlap score when relevant", () => {
  const result = scoreWeeklyOverlap({
    draftMeals: [
      meal({ dayKey: "day-2", dayIndex: 2, title: "Herby Rice Bowl", ingredientKeys: ["spinach", "rice", "parsley"] }),
    ],
    nearbyAcceptedMeals: [
      {
        dayIndex: 1,
        title: "Lemon Chicken",
        effort: "medium",
        ingredientKeys: ["spinach", "rice", "chicken"],
        sharedPrepKeys: ["herb_sauce"],
        cuisineKey: "mediterranean",
        proteinKey: "chicken",
      },
    ],
    mode: "plan_three_dinners",
  });

  assert.ok(result.score > 0);
  assert.ok((result.reasonCodesByDayKey["day-2"] ?? []).length > 0);
});

test("explicit pantry staples do not count as meaningful overlap", () => {
  const result = scoreWeeklyOverlap({
    draftMeals: [
      meal({ dayKey: "day-0", dayIndex: 0, title: "Pasta", ingredientKeys: ["pasta", "garlic", "olive oil"] }),
      meal({ dayKey: "day-2", dayIndex: 2, title: "Beans", ingredientKeys: ["beans", "garlic", "olive oil"] }),
    ],
    pantryStaples: ["garlic", "olive oil"],
    mode: "plan_three_dinners",
  });

  assert.equal(result.reasonCodesByDayKey["day-0"]?.includes("reuses_ingredients") ?? false, false);
});

test("overlap cues only appear when overlap is meaningful", () => {
  const result = scoreWeeklyOverlap({
    draftMeals: [
      meal({ dayKey: "day-0", dayIndex: 0, title: "Prep Pasta", ingredientKeys: ["tomato", "basil"], sharedPrepKeys: ["sofrito"] }),
      meal({ dayKey: "day-2", dayIndex: 2, title: "Prep Beans", ingredientKeys: ["tomato", "beans"], sharedPrepKeys: ["sofrito"] }),
    ],
    mode: "plan_three_dinners",
  });

  assert.ok(result.reasonCodesByDayKey["day-0"]?.includes("shares_prep"));
});
