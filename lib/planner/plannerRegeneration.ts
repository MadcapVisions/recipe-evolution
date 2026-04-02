import type {
  ExistingPlannedMeal,
  PlannerCandidate,
  PlannerDraftAssignment,
  PlannerMode,
  PlannerReasonCode,
} from "@/lib/planner/plannerEngine";
import { buildPlannerWeekDraft } from "@/lib/planner/plannerEngine";
import { getPlannerReasonLabels } from "@/lib/planner/plannerReasonLabels";
import type { PlanningEligibilityReason } from "@/lib/planner/versionPlanningEligibility";

export type DraftNightOrigin = "generated" | "manual" | "accepted" | "empty";

export type PlannerDraftNight = {
  date: string;
  dayIndex: number;
  dayLabel: string;
  origin: DraftNightOrigin;
  isLocked: boolean;
  isFlexible: boolean;
  isSelectedForRegeneration: boolean;
  recipeId: string | null;
  versionId: string | null;
  title: string | null;
  score: number | null;
  reasonCodes: PlannerReasonCode[];
  reasonLabels: string[];
  planningEligibilityReason?: PlanningEligibilityReason | null;
};

export type PlannerTransientDraft = {
  mode: PlannerMode;
  nights: PlannerDraftNight[];
};

export type PlannerRegenerationCandidate = PlannerCandidate & {
  planningEligibilityReason?: PlanningEligibilityReason | null;
};

export type PlannerRegenerationStatus =
  | "replaced"
  | "kept_original"
  | "not_regenerable"
  | "no_better_option";

export type PlannerRegenerationResult = {
  updatedDraft: PlannerTransientDraft;
  resultsByDate: Record<
    string,
    {
      status: PlannerRegenerationStatus;
      reason?: string;
    }
  >;
};

type PlannerRegenerationInput = {
  draft: PlannerTransientDraft;
  targetedDates: string[];
  candidates: PlannerRegenerationCandidate[];
  existingMeals?: ExistingPlannedMeal[];
  pantryStaples?: string[];
  sparseData: boolean;
};

function assignmentToDraftNight(input: {
  assignment: PlannerDraftAssignment;
  date: string;
  dayLabel: string;
  planningEligibilityReason?: PlanningEligibilityReason | null;
}): PlannerDraftNight {
  return {
    date: input.date,
    dayIndex: input.assignment.dayIndex,
    dayLabel: input.dayLabel,
    origin: "generated",
    isLocked: false,
    isFlexible: false,
    isSelectedForRegeneration: false,
    recipeId: input.assignment.recipeId,
    versionId: input.assignment.versionId,
    title: input.assignment.title,
    score: input.assignment.score,
    reasonCodes: input.assignment.reasonCodes,
    reasonLabels: getPlannerReasonLabels({
      reasonCodes: input.assignment.reasonCodes,
      planningEligibilityReason: input.planningEligibilityReason ?? null,
      max: 2,
    }),
    planningEligibilityReason: input.planningEligibilityReason ?? null,
  };
}

export function buildTransientPlannerDraft(input: {
  mode: PlannerMode;
  assignments: PlannerDraftAssignment[];
  weekDates: string[];
  dayLabels: readonly string[];
  planningEligibilityReasonByVersionId?: Map<string, PlanningEligibilityReason | null>;
}): PlannerTransientDraft {
  return {
    mode: input.mode,
    nights: input.assignments.map((assignment) =>
      assignmentToDraftNight({
        assignment,
        date: input.weekDates[assignment.dayIndex] ?? input.weekDates[0] ?? "",
        dayLabel: input.dayLabels[assignment.dayIndex] ?? "Mon",
        planningEligibilityReason: input.planningEligibilityReasonByVersionId?.get(assignment.versionId) ?? null,
      })
    ),
  };
}

function nightToExistingMeal(
  night: PlannerDraftNight,
  candidateByVersionId: Map<string, PlannerRegenerationCandidate>
): ExistingPlannedMeal | null {
  if (!night.versionId || !night.title) {
    return null;
  }

  const candidate = candidateByVersionId.get(night.versionId);
  if (candidate) {
    return {
      dayIndex: night.dayIndex,
      title: night.title,
      effort: candidate.effort,
      ingredientKeys: candidate.ingredientKeys,
      sharedPrepKeys: candidate.sharedPrepKeys,
      cuisineKey: candidate.cuisineKey ?? null,
      proteinKey: candidate.proteinKey ?? null,
    };
  }

  return {
    dayIndex: night.dayIndex,
    title: night.title,
    effort: "medium",
    ingredientKeys: [],
    sharedPrepKeys: [],
    cuisineKey: null,
    proteinKey: null,
  };
}

function isNightRegenerableByDefault(night: PlannerDraftNight) {
  return night.origin === "generated" && !night.isLocked && !night.isFlexible;
}

function buildReplacementNight(input: {
  currentNight: PlannerDraftNight;
  replacement: PlannerDraftAssignment;
  candidateByVersionId: Map<string, PlannerRegenerationCandidate>;
}): PlannerDraftNight {
  const planningEligibilityReason =
    input.candidateByVersionId.get(input.replacement.versionId)?.planningEligibilityReason ?? null;

  return {
    ...input.currentNight,
    origin: "generated",
    recipeId: input.replacement.recipeId,
    versionId: input.replacement.versionId,
    title: input.replacement.title,
    score: input.replacement.score,
    reasonCodes: input.replacement.reasonCodes,
    reasonLabels: getPlannerReasonLabels({
      reasonCodes: input.replacement.reasonCodes,
      planningEligibilityReason,
      max: 2,
    }),
    planningEligibilityReason,
    isSelectedForRegeneration: false,
  };
}

export function regeneratePlannerDraft(input: PlannerRegenerationInput): PlannerRegenerationResult {
  const targetedDateSet = new Set(input.targetedDates);
  const candidateByVersionId = new Map(input.candidates.map((candidate) => [candidate.versionId, candidate]));
  const preservedNights = input.draft.nights.filter((night) => !targetedDateSet.has(night.date));
  const resultsByDate: PlannerRegenerationResult["resultsByDate"] = {};
  const replacements = new Map<string, PlannerDraftNight>();

  for (const night of input.draft.nights) {
    if (!targetedDateSet.has(night.date)) {
      continue;
    }

    const explicitlyTargeted = targetedDateSet.has(night.date);
    if (!isNightRegenerableByDefault(night) && !explicitlyTargeted) {
      resultsByDate[night.date] = {
        status: "not_regenerable",
        reason: "Night is not regenerable by default.",
      };
      continue;
    }

    const blockedRecipeIds = new Set<string>();
    for (const preserved of [...preservedNights, ...Array.from(replacements.values())]) {
      if (preserved.recipeId) {
        blockedRecipeIds.add(preserved.recipeId);
      }
    }

    const existingMeals = [
      ...(input.existingMeals ?? []),
      ...preservedNights
        .map((preserved) => nightToExistingMeal(preserved, candidateByVersionId))
        .filter((meal): meal is ExistingPlannedMeal => Boolean(meal)),
      ...Array.from(replacements.values())
        .map((preserved) => nightToExistingMeal(preserved, candidateByVersionId))
        .filter((meal): meal is ExistingPlannedMeal => Boolean(meal)),
    ];

    const candidatePool = input.candidates.filter(
      (candidate) =>
        !blockedRecipeIds.has(candidate.recipeId) &&
        candidate.versionId !== night.versionId &&
        candidate.planningEligibility !== "excluded"
    );

    const regenerated = buildPlannerWeekDraft({
      mode: input.draft.mode,
      candidates: candidatePool,
      existingMeals,
      pantryStaples: input.pantryStaples,
      sparseData: input.sparseData,
      fillCount: 1,
      availableDayIndexes: [night.dayIndex],
    });
    const replacement = regenerated.assignments.find((assignment) => assignment.dayIndex === night.dayIndex) ?? null;

    if (!replacement) {
      resultsByDate[night.date] = {
        status: "no_better_option",
        reason: "No better option found for this night.",
      };
      replacements.set(night.date, { ...night, isSelectedForRegeneration: false });
      continue;
    }

    const currentScore = night.score ?? Number.NEGATIVE_INFINITY;
    if (replacement.versionId === night.versionId || replacement.score <= currentScore) {
      resultsByDate[night.date] = {
        status: "kept_original",
        reason: "No better option found for this night.",
      };
      replacements.set(night.date, { ...night, isSelectedForRegeneration: false });
      continue;
    }

    replacements.set(
      night.date,
      buildReplacementNight({
        currentNight: night,
        replacement,
        candidateByVersionId,
      })
    );
    resultsByDate[night.date] = {
      status: "replaced",
    };
  }

  return {
    updatedDraft: {
      ...input.draft,
      nights: input.draft.nights.map((night) => replacements.get(night.date) ?? { ...night, isSelectedForRegeneration: false }),
    },
    resultsByDate,
  };
}

export const __plannerRegenerationInternals = {
  isNightRegenerableByDefault,
};
