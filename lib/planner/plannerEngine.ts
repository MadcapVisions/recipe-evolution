import { scoreWeeklyOverlap, type WeeklyOverlapMeal } from "@/lib/planner/plannerOverlap";

export type PlannerMode =
  | "plan_three_dinners"
  | "build_easy_week"
  | "fill_five_weeknights"
  | "reuse_ingredients"
  | "start_from_favorites";

export type PlannerLifecycleState = "kept" | "draft" | "unknown";
export type PlannerEffortLevel = "low" | "medium" | "high";
export type PlannerReasonCode =
  | "strong_repeat_candidate"
  | "favorite_recipe"
  | "good_weeknight_fit"
  | "good_easy_week_fit"
  | "matches_learned_patterns"
  | "reuses_ingredients"
  | "shares_prep"
  | "balances_heavier_meal"
  | "sparse_data_safe_choice"
  | "downranked_recent_negative"
  | "downranked_monotony"
  | "downranked_effort_clump";

export type PlannerCandidate = {
  recipeId: string;
  versionId: string;
  title: string;
  lifecycle: PlannerLifecycleState;
  planningEligibility: "eligible" | "cautionary" | "excluded";
  effort: PlannerEffortLevel;
  qualityScore: number | null;
  learnedScore: number;
  repeatScore: number;
  overlapScore: number;
  isFavorite: boolean;
  wouldMakeAgain: boolean | null;
  hasRecentNegativeOutcome: boolean;
  complexityComplaintCount: number;
  ingredientKeys: string[];
  sharedPrepKeys: string[];
  cuisineKey?: string | null;
  proteinKey?: string | null;
};

export type ExistingPlannedMeal = {
  dayIndex: number;
  title: string;
  effort: PlannerEffortLevel;
  ingredientKeys: string[];
  sharedPrepKeys: string[];
  cuisineKey?: string | null;
  proteinKey?: string | null;
};

export type PlannerEngineInput = {
  mode: PlannerMode;
  candidates: PlannerCandidate[];
  existingMeals?: ExistingPlannedMeal[];
  pantryStaples?: string[];
  sparseData: boolean;
  fillCount?: number;
  leaveFlexibleNight?: boolean;
  availableDayIndexes?: number[];
};

export type PlannerDraftAssignment = {
  dayIndex: number;
  recipeId: string;
  versionId: string;
  title: string;
  score: number;
  reasonCodes: PlannerReasonCode[];
};

export type PlannerDraftResult = {
  assignments: PlannerDraftAssignment[];
  skippedCandidateIds: string[];
};

type CandidateEvaluation = {
  candidate: PlannerCandidate;
  score: number;
  reasonCodes: PlannerReasonCode[];
};

type PlannerModeProfile = {
  effortMultiplier: number;
  learnedMultiplier: number;
  repeatMultiplier: number;
  overlapMultiplier: number;
  favoriteBonus: number;
  cautionaryPenalty: number;
  negativeOutcomePenalty: number;
  complexityComplaintPenalty: number;
  placementFloor: number;
};

const DEFAULT_THREE_DINNER_DAYS = [0, 2, 4];
const DEFAULT_FIVE_DINNER_DAYS = [0, 1, 2, 3, 4];

function profileForMode(mode: PlannerMode): PlannerModeProfile {
  switch (mode) {
    case "build_easy_week":
      return {
        effortMultiplier: 1.9,
        learnedMultiplier: 1.15,
        repeatMultiplier: 2.15,
        overlapMultiplier: 0.8,
        favoriteBonus: 1,
        cautionaryPenalty: 1.1,
        negativeOutcomePenalty: 2,
        complexityComplaintPenalty: 0.7,
        placementFloor: 2.15,
      };
    case "reuse_ingredients":
      return {
        effortMultiplier: 1,
        learnedMultiplier: 1.4,
        repeatMultiplier: 1.8,
        overlapMultiplier: 2.2,
        favoriteBonus: 1.1,
        cautionaryPenalty: 0.35,
        negativeOutcomePenalty: 1.6,
        complexityComplaintPenalty: 0.2,
        placementFloor: 0.8,
      };
    default:
      return {
        effortMultiplier: 1,
        learnedMultiplier: 1.4,
        repeatMultiplier: 1.8,
        overlapMultiplier: 1,
        favoriteBonus: 1.1,
        cautionaryPenalty: 0.35,
        negativeOutcomePenalty: 1.6,
        complexityComplaintPenalty: 0.2,
        placementFloor: 0.8,
      };
  }
}

function effortWeight(effort: PlannerEffortLevel) {
  switch (effort) {
    case "low":
      return 1;
    case "medium":
      return 0.45;
    case "high":
      return -0.35;
  }
}

function qualityWeight(score: number | null) {
  if (typeof score !== "number") return 0;
  return Math.max(-1, Math.min(1.5, (score - 70) / 20));
}

function overlapValue(a: PlannerCandidate, b: ExistingPlannedMeal | PlannerCandidate) {
  const sharedIngredients = a.ingredientKeys.filter((key) => b.ingredientKeys.includes(key)).length;
  const sharedPrep = a.sharedPrepKeys.filter((key) => b.sharedPrepKeys.includes(key)).length;
  return sharedIngredients * 0.35 + sharedPrep * 0.5;
}

function monotonyPenalty(a: PlannerCandidate, b: ExistingPlannedMeal | PlannerCandidate) {
  let penalty = 0;
  if (a.cuisineKey && b.cuisineKey && a.cuisineKey === b.cuisineKey) {
    penalty += 1.75;
  }
  if (a.proteinKey && b.proteinKey && a.proteinKey === b.proteinKey) {
    penalty += 1.55;
  }
  if (a.cuisineKey && b.cuisineKey && a.cuisineKey === b.cuisineKey && a.proteinKey && b.proteinKey && a.proteinKey === b.proteinKey) {
    penalty += 0.65;
  }
  return penalty;
}

function targetDaysForMode(mode: PlannerMode, fillCount?: number, leaveFlexibleNight?: boolean) {
  if (mode === "fill_five_weeknights") {
    return DEFAULT_FIVE_DINNER_DAYS.slice(0, fillCount ?? 5);
  }

  if (mode === "build_easy_week") {
    const days = DEFAULT_FIVE_DINNER_DAYS.slice(0, Math.min(fillCount ?? 4, 5));
    return leaveFlexibleNight ? days.slice(0, Math.max(0, days.length - 1)) : days;
  }

  return DEFAULT_THREE_DINNER_DAYS.slice(0, fillCount ?? 3);
}

function evaluateBaseCandidate(input: PlannerEngineInput, candidate: PlannerCandidate): CandidateEvaluation | null {
  if (candidate.lifecycle === "draft") {
    return null;
  }

  const profile = profileForMode(input.mode);
  const reasonCodes: PlannerReasonCode[] = [];
  let score = 0;

  score += qualityWeight(candidate.qualityScore) * 3.5;
  score += candidate.learnedScore * profile.learnedMultiplier;
  score += candidate.repeatScore * profile.repeatMultiplier;
  score += candidate.overlapScore * profile.overlapMultiplier;

  if (candidate.isFavorite) {
    score += profile.favoriteBonus;
    reasonCodes.push("favorite_recipe");
  }

  if (candidate.wouldMakeAgain === true || candidate.repeatScore >= 0.65) {
    score += 0.9;
    reasonCodes.push("strong_repeat_candidate");
  }

  if (candidate.learnedScore >= 0.4) {
    reasonCodes.push("matches_learned_patterns");
  }

  if (candidate.overlapScore >= 0.5) {
    reasonCodes.push("reuses_ingredients");
  }

  if (candidate.sharedPrepKeys.length > 0) {
    reasonCodes.push("shares_prep");
  }

  if (input.sparseData) {
    score += candidate.isFavorite ? 0.5 : 0;
    score += (candidate.qualityScore ?? 0) >= 80 ? 0.35 : 0;
    reasonCodes.push("sparse_data_safe_choice");
  }

  if (candidate.hasRecentNegativeOutcome || candidate.wouldMakeAgain === false) {
    score -= profile.negativeOutcomePenalty;
    reasonCodes.push("downranked_recent_negative");
  }

  if (candidate.complexityComplaintCount > 0) {
    score -= Math.min(1.4, candidate.complexityComplaintCount * profile.complexityComplaintPenalty);
  }

  if (candidate.planningEligibility === "cautionary") {
    score -= profile.cautionaryPenalty;
  }

  if (input.mode === "build_easy_week") {
    score += effortWeight(candidate.effort) * profile.effortMultiplier;
    if (candidate.effort === "high") {
      score -= 1.6;
    }
    if (candidate.effort !== "high") {
      reasonCodes.push("good_easy_week_fit");
    }
  } else {
    score += effortWeight(candidate.effort) * profile.effortMultiplier;
    if (candidate.effort === "low" || candidate.effort === "medium") {
      reasonCodes.push("good_weeknight_fit");
    }
  }

  if (input.mode === "start_from_favorites") {
    score += candidate.isFavorite ? 1.2 : -0.25;
  }

  if (input.mode === "reuse_ingredients") {
    score += candidate.overlapScore * 1.2;
  }

  return {
    candidate,
    score,
    reasonCodes: Array.from(new Set(reasonCodes)),
  };
}

function adjustForCalendarContext(
  evaluation: CandidateEvaluation,
  dayIndex: number,
  existingMeals: ExistingPlannedMeal[]
): CandidateEvaluation {
  let score = evaluation.score;
  const reasonCodes = [...evaluation.reasonCodes];
  const dayNeighbors = existingMeals.filter((meal) => Math.abs(meal.dayIndex - dayIndex) <= 1);

  for (const meal of dayNeighbors) {
    const overlap = overlapValue(evaluation.candidate, meal);
    if (overlap > 0) {
      score += Math.min(0.9, overlap * 0.8);
      if (!reasonCodes.includes("reuses_ingredients")) {
        reasonCodes.push("reuses_ingredients");
      }
    }

    const monotony = monotonyPenalty(evaluation.candidate, meal);
    if (monotony > 0) {
      score -= monotony;
      if (!reasonCodes.includes("downranked_monotony")) {
        reasonCodes.push("downranked_monotony");
      }
    }

    if (
      evaluation.candidate.effort === "high" &&
      meal.effort === "high" && Math.abs(meal.dayIndex - dayIndex) <= 1
    ) {
      score -= 1.4;
      if (!reasonCodes.includes("downranked_effort_clump")) {
        reasonCodes.push("downranked_effort_clump");
      }
    }

    if (
      evaluation.candidate.effort !== "high" &&
      meal.effort === "high" && Math.abs(meal.dayIndex - dayIndex) <= 1
    ) {
      score += 0.35;
      if (!reasonCodes.includes("balances_heavier_meal")) {
        reasonCodes.push("balances_heavier_meal");
      }
    }
  }

  return {
    candidate: evaluation.candidate,
    score,
    reasonCodes: Array.from(new Set(reasonCodes)),
  };
}

function evaluationToOverlapMeal(evaluation: CandidateEvaluation, dayIndex: number): WeeklyOverlapMeal {
  return {
    dayKey: `day-${dayIndex}`,
    dayIndex,
    title: evaluation.candidate.title,
    effort: evaluation.candidate.effort,
    ingredientKeys: evaluation.candidate.ingredientKeys,
    sharedPrepKeys: evaluation.candidate.sharedPrepKeys,
    cuisineKey: evaluation.candidate.cuisineKey ?? null,
    proteinKey: evaluation.candidate.proteinKey ?? null,
  };
}

function mergeReasonCodes(...groups: PlannerReasonCode[][]): PlannerReasonCode[] {
  return Array.from(new Set(groups.flat()));
}

export function buildPlannerWeekDraft(input: PlannerEngineInput): PlannerDraftResult {
  const requestedDays = targetDaysForMode(input.mode, input.fillCount, input.leaveFlexibleNight);
  const targetDays = input.availableDayIndexes?.length
    ? requestedDays.filter((dayIndex) => input.availableDayIndexes?.includes(dayIndex))
    : requestedDays;
  const existingMeals = input.existingMeals ?? [];
  const baseEvaluations = input.candidates
    .map((candidate) => evaluateBaseCandidate(input, candidate))
    .filter((value): value is CandidateEvaluation => Boolean(value))
    .sort((left, right) => right.score - left.score);
  const candidateOptionsByDay = new Map<number, CandidateEvaluation[]>();
  const skippedCandidateIds = new Set<string>();
  const maxOptionsPerDay = targetDays.length <= 3 ? 6 : 5;

  for (const dayIndex of targetDays) {
    const dayOptions = baseEvaluations
      .map((evaluation) => adjustForCalendarContext(evaluation, dayIndex, existingMeals))
      .sort((left, right) => right.score - left.score)
      .filter((evaluation) => evaluation.score >= profileForMode(input.mode).placementFloor)
      .slice(0, maxOptionsPerDay);
    candidateOptionsByDay.set(dayIndex, dayOptions);
  }

  let bestDraft:
    | {
        assignments: PlannerDraftAssignment[];
        score: number;
      }
    | null = null;

  const considerCombination = (evaluationsByDay: Array<{ dayIndex: number; evaluation: CandidateEvaluation }>) => {
    const baseScore = evaluationsByDay.reduce((sum, item) => sum + item.evaluation.score, 0);
    const overlap = scoreWeeklyOverlap({
      draftMeals: evaluationsByDay.map((item) => evaluationToOverlapMeal(item.evaluation, item.dayIndex)),
      nearbyAcceptedMeals: existingMeals,
      pantryStaples: input.pantryStaples,
      mode: input.mode,
    });
    const assignments = evaluationsByDay.map(({ dayIndex, evaluation }) => ({
      dayIndex,
      recipeId: evaluation.candidate.recipeId,
      versionId: evaluation.candidate.versionId,
      title: evaluation.candidate.title,
      score: Number((evaluation.score + overlap.score).toFixed(3)),
      reasonCodes: mergeReasonCodes(
        evaluation.reasonCodes,
        overlap.reasonCodesByDayKey[`day-${dayIndex}`] ?? []
      ),
    }));
    const finalScore = Number((baseScore + overlap.score).toFixed(3));

    if (
      !bestDraft ||
      assignments.length > bestDraft.assignments.length ||
      (assignments.length === bestDraft.assignments.length && finalScore > bestDraft.score)
    ) {
      bestDraft = {
        assignments,
        score: finalScore,
      };
    }
  };

  const explore = (
    dayCursor: number,
    usedRecipeIds: Set<string>,
    evaluationsByDay: Array<{ dayIndex: number; evaluation: CandidateEvaluation }>
  ) => {
    if (dayCursor >= targetDays.length) {
      considerCombination(evaluationsByDay);
      return;
    }

    const dayIndex = targetDays[dayCursor];
    const options = candidateOptionsByDay.get(dayIndex) ?? [];
    let exploredOption = false;

    for (const evaluation of options) {
      if (usedRecipeIds.has(evaluation.candidate.recipeId)) {
        continue;
      }

      exploredOption = true;
      usedRecipeIds.add(evaluation.candidate.recipeId);
      evaluationsByDay.push({ dayIndex, evaluation });
      explore(dayCursor + 1, usedRecipeIds, evaluationsByDay);
      evaluationsByDay.pop();
      usedRecipeIds.delete(evaluation.candidate.recipeId);
    }

    if (!exploredOption || dayCursor < targetDays.length) {
      explore(dayCursor + 1, usedRecipeIds, evaluationsByDay);
    }
  };

  explore(0, new Set<string>(), []);
  const bestAssignments: PlannerDraftAssignment[] = bestDraft
    ? (bestDraft as { assignments: PlannerDraftAssignment[] }).assignments
    : [];
  const assignments = [...bestAssignments].sort(
    (left: PlannerDraftAssignment, right: PlannerDraftAssignment) => left.dayIndex - right.dayIndex
  );

  for (const candidate of input.candidates) {
    if (!assignments.some((assignment) => assignment.versionId === candidate.versionId)) {
      skippedCandidateIds.add(candidate.versionId);
    }
  }

  return {
    assignments,
    skippedCandidateIds: Array.from(skippedCandidateIds),
  };
}
