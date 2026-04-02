import type {
  ExistingPlannedMeal,
  PlannerEffortLevel,
  PlannerMode,
  PlannerReasonCode,
} from "@/lib/planner/plannerEngine";

export type WeeklyOverlapMeal = {
  dayKey: string;
  dayIndex: number;
  title: string;
  effort: PlannerEffortLevel;
  ingredientKeys: string[];
  sharedPrepKeys: string[];
  cuisineKey?: string | null;
  proteinKey?: string | null;
};

export type WeeklyOverlapScoreResult = {
  score: number;
  reasonCodesByDayKey: Record<string, PlannerReasonCode[]>;
  monotonyPenalties: string[];
};

const TRIVIAL_OVERLAP_KEYS = new Set([
  "salt",
  "pepper",
  "water",
  "olive oil",
  "oil",
  "butter",
  "garlic powder",
  "onion powder",
  "paprika",
  "cumin",
  "oregano",
  "thyme",
  "red pepper flakes",
  "soy sauce",
  "vinegar",
  "lemon juice",
  "lime juice",
]);

const HIGH_PERISHABILITY_KEYS = new Set([
  "spinach",
  "cilantro",
  "parsley",
  "basil",
  "dill",
  "mint",
  "scallion",
  "green onion",
  "mushrooms",
  "salmon",
  "shrimp",
  "lettuce",
  "avocado",
  "broccoli",
  "asparagus",
  "zucchini",
  "strawberries",
  "berries",
]);

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function isMeaningfulKey(key: string, pantryStaples: Set<string>) {
  const normalized = normalizeKey(key);
  return normalized.length > 0 && !TRIVIAL_OVERLAP_KEYS.has(normalized) && !pantryStaples.has(normalized);
}

function sharedKeys(a: string[], b: string[]) {
  return a.filter((key) => b.includes(key));
}

function addReasonCode(
  target: Record<string, PlannerReasonCode[]>,
  dayKey: string,
  reasonCode: PlannerReasonCode
) {
  const current = target[dayKey] ?? [];
  if (!current.includes(reasonCode)) {
    target[dayKey] = [...current, reasonCode];
  }
}

function overlapPairScore(input: {
  left: WeeklyOverlapMeal;
  right: WeeklyOverlapMeal;
  pantryStaples: Set<string>;
  mode: PlannerMode;
}) {
  const sharedMeaningful = sharedKeys(
    input.left.ingredientKeys.filter((key) => isMeaningfulKey(key, input.pantryStaples)),
    input.right.ingredientKeys.filter((key) => isMeaningfulKey(key, input.pantryStaples))
  );
  const sharedPerishables = sharedMeaningful.filter((key) => HIGH_PERISHABILITY_KEYS.has(normalizeKey(key)));
  const sharedPrep = sharedKeys(input.left.sharedPrepKeys, input.right.sharedPrepKeys);
  const sameProtein =
    input.left.proteinKey &&
    input.right.proteinKey &&
    input.left.proteinKey === input.right.proteinKey &&
    input.left.proteinKey.length > 0;

  let score = 0;
  score += Math.min(1.15, sharedMeaningful.length * 0.35);
  score += Math.min(0.8, sharedPerishables.length * 0.45);
  score += Math.min(1.1, sharedPrep.length * 0.8);
  if (sameProtein && sharedMeaningful.length > 0) {
    score += 0.1;
  }
  if (input.mode === "reuse_ingredients") {
    score *= 1.2;
  }

  return {
    score,
    sharedMeaningful,
    sharedPerishables,
    sharedPrep,
  };
}

function pairMonotonyPenalty(left: WeeklyOverlapMeal, right: WeeklyOverlapMeal) {
  let penalty = 0;
  if (left.proteinKey && right.proteinKey && left.proteinKey === right.proteinKey) {
    penalty += 1.15;
  }
  if (left.cuisineKey && right.cuisineKey && left.cuisineKey === right.cuisineKey) {
    penalty += 1.1;
  }
  if (
    left.proteinKey &&
    right.proteinKey &&
    left.proteinKey === right.proteinKey &&
    left.cuisineKey &&
    right.cuisineKey &&
    left.cuisineKey === right.cuisineKey
  ) {
    penalty += 1.35;
  }
  return penalty;
}

function monotonyPenaltyForMeals(meals: WeeklyOverlapMeal[]) {
  const penaltiesByDayKey: Record<string, PlannerReasonCode[]> = {};
  const monotonyPenalties: string[] = [];
  let score = 0;

  const proteinCounts = new Map<string, string[]>();
  const cuisineCounts = new Map<string, string[]>();
  const ingredientCounts = new Map<string, string[]>();

  for (const meal of meals) {
    if (meal.proteinKey) {
      proteinCounts.set(meal.proteinKey, [...(proteinCounts.get(meal.proteinKey) ?? []), meal.dayKey]);
    }
    if (meal.cuisineKey) {
      cuisineCounts.set(meal.cuisineKey, [...(cuisineCounts.get(meal.cuisineKey) ?? []), meal.dayKey]);
    }
    const uniqueIngredients = Array.from(new Set(meal.ingredientKeys.filter((key) => HIGH_PERISHABILITY_KEYS.has(normalizeKey(key)))));
    for (const ingredient of uniqueIngredients) {
      ingredientCounts.set(ingredient, [...(ingredientCounts.get(ingredient) ?? []), meal.dayKey]);
    }
  }

  for (const [protein, dayKeys] of proteinCounts.entries()) {
    if (dayKeys.length > 2) {
      score -= (dayKeys.length - 2) * 2.2;
      monotonyPenalties.push(`protein:${protein}`);
      for (const dayKey of dayKeys) {
        addReasonCode(penaltiesByDayKey, dayKey, "downranked_monotony");
      }
    }
  }

  for (const [cuisine, dayKeys] of cuisineCounts.entries()) {
    if (dayKeys.length > 2) {
      score -= (dayKeys.length - 2) * 1.8;
      monotonyPenalties.push(`cuisine:${cuisine}`);
      for (const dayKey of dayKeys) {
        addReasonCode(penaltiesByDayKey, dayKey, "downranked_monotony");
      }
    }
  }

  for (const [ingredient, dayKeys] of ingredientCounts.entries()) {
    if (dayKeys.length > 2) {
      score -= (dayKeys.length - 2) * 1.1;
      monotonyPenalties.push(`ingredient:${ingredient}`);
      for (const dayKey of dayKeys) {
        addReasonCode(penaltiesByDayKey, dayKey, "downranked_monotony");
      }
    }
  }

  return {
    score,
    penaltiesByDayKey,
    monotonyPenalties,
  };
}

export function scoreWeeklyOverlap(input: {
  draftMeals: WeeklyOverlapMeal[];
  nearbyAcceptedMeals?: ExistingPlannedMeal[];
  pantryStaples?: string[];
  mode: PlannerMode;
}): WeeklyOverlapScoreResult {
  const pantryStaples = new Set((input.pantryStaples ?? []).map(normalizeKey));
  const reasonCodesByDayKey: Record<string, PlannerReasonCode[]> = {};
  let score = 0;

  for (let index = 0; index < input.draftMeals.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < input.draftMeals.length; compareIndex += 1) {
      const left = input.draftMeals[index];
      const right = input.draftMeals[compareIndex];
      const pair = overlapPairScore({
        left,
        right,
        pantryStaples,
        mode: input.mode,
      });

      score += pair.score;
      const monotonyPenalty = pairMonotonyPenalty(left, right);
      if (monotonyPenalty > 0) {
        score -= monotonyPenalty;
        addReasonCode(reasonCodesByDayKey, left.dayKey, "downranked_monotony");
        addReasonCode(reasonCodesByDayKey, right.dayKey, "downranked_monotony");
      }
      if (Math.abs(left.dayIndex - right.dayIndex) <= 1 && left.effort === "high" && right.effort === "high") {
        score -= 2;
        addReasonCode(reasonCodesByDayKey, left.dayKey, "downranked_effort_clump");
        addReasonCode(reasonCodesByDayKey, right.dayKey, "downranked_effort_clump");
      }
      if (Math.abs(left.dayIndex - right.dayIndex) <= 1 && left.effort !== "high" && right.effort === "high") {
        addReasonCode(reasonCodesByDayKey, left.dayKey, "balances_heavier_meal");
      }
      if (Math.abs(left.dayIndex - right.dayIndex) <= 1 && left.effort === "high" && right.effort !== "high") {
        addReasonCode(reasonCodesByDayKey, right.dayKey, "balances_heavier_meal");
      }
      if (pair.sharedPrep.length > 0 && pair.score >= 0.8) {
        addReasonCode(reasonCodesByDayKey, left.dayKey, "shares_prep");
        addReasonCode(reasonCodesByDayKey, right.dayKey, "shares_prep");
      } else if ((pair.sharedMeaningful.length >= 2 || pair.sharedPerishables.length >= 1) && pair.score >= 0.75) {
        addReasonCode(reasonCodesByDayKey, left.dayKey, "reuses_ingredients");
        addReasonCode(reasonCodesByDayKey, right.dayKey, "reuses_ingredients");
      }
    }
  }

  for (const draftMeal of input.draftMeals) {
    for (const acceptedMeal of input.nearbyAcceptedMeals ?? []) {
      if (Math.abs(draftMeal.dayIndex - acceptedMeal.dayIndex) > 1) {
        continue;
      }

      const pair = overlapPairScore({
        left: draftMeal,
        right: {
          dayKey: `accepted-${acceptedMeal.dayIndex}`,
          dayIndex: acceptedMeal.dayIndex,
          title: acceptedMeal.title,
          effort: acceptedMeal.effort,
          ingredientKeys: acceptedMeal.ingredientKeys,
          sharedPrepKeys: acceptedMeal.sharedPrepKeys,
          cuisineKey: acceptedMeal.cuisineKey ?? null,
          proteinKey: acceptedMeal.proteinKey ?? null,
        },
        pantryStaples,
        mode: input.mode,
      });

      score += pair.score * 0.65;
      const acceptedComparable: WeeklyOverlapMeal = {
        dayKey: `accepted-${acceptedMeal.dayIndex}`,
        dayIndex: acceptedMeal.dayIndex,
        title: acceptedMeal.title,
        effort: acceptedMeal.effort,
        ingredientKeys: acceptedMeal.ingredientKeys,
        sharedPrepKeys: acceptedMeal.sharedPrepKeys,
        cuisineKey: acceptedMeal.cuisineKey ?? null,
        proteinKey: acceptedMeal.proteinKey ?? null,
      };
      const monotonyPenalty = pairMonotonyPenalty(draftMeal, acceptedComparable);
      if (monotonyPenalty > 0) {
        score -= monotonyPenalty * 0.85;
        addReasonCode(reasonCodesByDayKey, draftMeal.dayKey, "downranked_monotony");
      }
      if (Math.abs(draftMeal.dayIndex - acceptedMeal.dayIndex) <= 1 && draftMeal.effort === "high" && acceptedMeal.effort === "high") {
        score -= 1.6;
        addReasonCode(reasonCodesByDayKey, draftMeal.dayKey, "downranked_effort_clump");
      }
      if (Math.abs(draftMeal.dayIndex - acceptedMeal.dayIndex) <= 1 && draftMeal.effort !== "high" && acceptedMeal.effort === "high") {
        addReasonCode(reasonCodesByDayKey, draftMeal.dayKey, "balances_heavier_meal");
      }
      if ((pair.sharedPrep.length > 0 || pair.sharedPerishables.length > 0 || pair.sharedMeaningful.length >= 2) && pair.score >= 0.75) {
        addReasonCode(reasonCodesByDayKey, draftMeal.dayKey, pair.sharedPrep.length > 0 ? "shares_prep" : "reuses_ingredients");
      }
    }
  }

  const monotony = monotonyPenaltyForMeals(input.draftMeals);
  score += monotony.score;
  for (const [dayKey, codes] of Object.entries(monotony.penaltiesByDayKey)) {
    for (const code of codes) {
      addReasonCode(reasonCodesByDayKey, dayKey, code);
    }
  }

  return {
    score: Number(score.toFixed(3)),
    reasonCodesByDayKey,
    monotonyPenalties: monotony.monotonyPenalties,
  };
}

export const __plannerOverlapInternals = {
  overlapPairScore,
  monotonyPenaltyForMeals,
};
