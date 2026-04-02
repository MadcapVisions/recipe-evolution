import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { loadPlannerRecipeOptions, loadPlannerRecipeOptionsForVersions } from "@/lib/plannerData";
import { MealPlannerClient } from "@/components/planner/MealPlannerClient";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/ai/featureFlags";
import { loadPlannerCandidates, type PlannerCandidateRecord } from "@/lib/planner/plannerCandidates";
import { buildPlannerWeekDraft, type ExistingPlannedMeal, type PlannerMode } from "@/lib/planner/plannerEngine";
import {
  deriveWeekGroceryFromAcceptedEntries,
  type AcceptedMealPlanEntry,
  type DerivedWeekGroceryResult,
} from "@/lib/planner/plannerGrocery";
import {
  buildTransientPlannerDraft,
  type PlannerRegenerationCandidate,
  type PlannerTransientDraft,
} from "@/lib/planner/plannerRegeneration";

type MealPlanEntry = AcceptedMealPlanEntry;

type PlannerPageProps = {
  searchParams?: Promise<{
    recipe?: string | string[];
    version?: string | string[];
    week?: string | string[];
    day?: string | string[];
    mode?: string | string[];
  }>;
};

function toArray(value: string | string[] | undefined) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekStart(date: Date) {
  const start = new Date(date);
  const weekday = start.getDay();
  const daysFromMonday = (weekday + 6) % 7;
  start.setDate(start.getDate() - daysFromMonday);
  start.setHours(0, 0, 0, 0);
  return start;
}

function parseWeekStart(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return getWeekStart(date);
}

function parsePlannerMode(value: string | undefined): PlannerMode {
  switch (value) {
    case "build_easy_week":
      return "build_easy_week";
    case "plan_three_dinners":
    default:
      return "plan_three_dinners";
  }
}

function defaultFillCountForMode(mode: PlannerMode) {
  switch (mode) {
    case "build_easy_week":
    case "plan_three_dinners":
    default:
      return 3;
  }
}

function labelForMode(mode: PlannerMode) {
  switch (mode) {
    case "build_easy_week":
      return "Build an easy week";
    case "plan_three_dinners":
    default:
      return "Plan 3 dinners for me";
  }
}

function toRegenerationCandidate(candidate: PlannerCandidateRecord): PlannerRegenerationCandidate {
  return {
    recipeId: candidate.recipeId,
    versionId: candidate.versionId,
    title: candidate.title,
    lifecycle: candidate.lifecycle,
    planningEligibility: candidate.planningEligibility,
    effort: candidate.effort,
    qualityScore: candidate.qualityScore,
    learnedScore: candidate.learnedScore,
    repeatScore: candidate.repeatScore,
    overlapScore: candidate.overlapScore,
    isFavorite: candidate.isFavorite,
    wouldMakeAgain: candidate.wouldMakeAgain,
    hasRecentNegativeOutcome: candidate.hasRecentNegativeOutcome,
    complexityComplaintCount: candidate.complexityComplaintCount,
    ingredientKeys: candidate.ingredientKeys,
    sharedPrepKeys: candidate.sharedPrepKeys,
    cuisineKey: candidate.cuisineKey ?? null,
    proteinKey: candidate.proteinKey ?? null,
    planningEligibilityReason: candidate.planningEligibilityReason ?? null,
  };
}

export default async function PlannerPage({ searchParams }: PlannerPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedWeek = toArray(resolvedSearchParams?.week)[0];
  const plannerMode = parsePlannerMode(toArray(resolvedSearchParams?.mode)[0]);
  const weekStart = parseWeekStart(requestedWeek) ?? getWeekStart(new Date());
  const weekDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return formatDateOnly(date);
  });
  const weekStartDate = weekDates[0];
  const weekEndDate = weekDates[6];

  const [recipeOptions, preferencesResult, plannerEntriesResult] = await Promise.all([
    loadPlannerRecipeOptions(user.id),
    supabase.from("user_preferences").select("pantry_staples, pantry_confident_staples").eq("owner_id", user.id).maybeSingle(),
    supabase
      .from("meal_plan_entries")
      .select("plan_date, sort_order, recipe_id, version_id, servings")
      .eq("owner_id", user.id)
      .gte("plan_date", weekStartDate)
      .lte("plan_date", weekEndDate)
      .order("plan_date", { ascending: true })
      .order("sort_order", { ascending: true }),
  ]);
  const assistedPlannerEnabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PLANNER_ASSISTED_V1, false);

  const pantryStaples = [
    ...(preferencesResult.data?.pantry_staples ?? []),
    ...(preferencesResult.data?.pantry_confident_staples ?? []),
  ];
  const initialSelectedRecipeIds = toArray(resolvedSearchParams?.recipe);
  const initialSelectedVersionIds = toArray(resolvedSearchParams?.version);
  const requestedDay = toArray(resolvedSearchParams?.day)[0];
  const plannerTableMissing =
    Boolean(plannerEntriesResult.error?.message?.includes("meal_plan_entries")) ||
    Boolean(plannerEntriesResult.error?.message?.includes("schema cache"));
  const baseWeekEntries = plannerTableMissing ? [] : ((plannerEntriesResult.data ?? []) as MealPlanEntry[]);
  const validDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
  const autoAssignDay = validDays.includes((requestedDay ?? "") as (typeof validDays)[number]) ? requestedDay : null;
  const autoAssignVersionId =
    initialSelectedVersionIds[0] ??
    recipeOptions.find((option) => initialSelectedRecipeIds.includes(option.recipeId))?.versionId ??
    null;
  const autoAssignRecipe = autoAssignVersionId ? recipeOptions.find((option) => option.versionId === autoAssignVersionId) ?? null : null;
  const initialWeekEntries =
    autoAssignDay && autoAssignRecipe
      ? (() => {
          const targetIndex = validDays.indexOf(autoAssignDay as (typeof validDays)[number]);
          const planDate = weekDates[targetIndex];
          const alreadyScheduled = baseWeekEntries.some(
            (entry) => entry.plan_date === planDate && entry.version_id === autoAssignRecipe.versionId
          );

          if (alreadyScheduled) {
            return baseWeekEntries;
          }

          const maxSortOrder = baseWeekEntries
            .filter((entry) => entry.plan_date === planDate)
            .reduce((max, entry) => Math.max(max, entry.sort_order), -1);

          return [
            ...baseWeekEntries,
            {
              plan_date: planDate,
              sort_order: maxSortOrder + 1,
              recipe_id: autoAssignRecipe.recipeId,
              version_id: autoAssignRecipe.versionId,
              servings: autoAssignRecipe.targetServings ?? autoAssignRecipe.servings ?? 1,
            },
          ];
        })()
      : baseWeekEntries;

  let assistedDraft: PlannerTransientDraft | null = null;
  let mergedRecipeOptions = recipeOptions;
  let assistedCandidates: PlannerRegenerationCandidate[] = [];
  let assistedExistingMeals: ExistingPlannedMeal[] = [];
  let assistedSparseData = false;
  let acceptedWeekGrocery: DerivedWeekGroceryResult | null = null;
  let assistedPlannerMeta: {
    enabled: boolean;
    mode: PlannerMode;
    modeLabel: string;
    openNightsAvailable: number;
    suggestedNightCount: number;
    draftAvailable: boolean;
  } | null = null;

  if (assistedPlannerEnabled) {
    const candidateResult = await loadPlannerCandidates(user.id, { supabase });
    assistedCandidates = candidateResult.candidates.map(toRegenerationCandidate);
    const candidateByVersionId = new Map(candidateResult.candidates.map((candidate) => [candidate.versionId, candidate]));
    const optionByVersionId = new Map(recipeOptions.map((option) => [option.versionId, option]));
    const existingMeals: ExistingPlannedMeal[] = baseWeekEntries.map((entry) => {
      const candidate = candidateByVersionId.get(entry.version_id) ?? null;
      const option = optionByVersionId.get(entry.version_id) ?? null;
      const dayIndex = weekDates.indexOf(entry.plan_date);
      return {
        dayIndex: Math.max(0, dayIndex),
        title: candidate?.title ?? option?.recipeTitle ?? "Planned meal",
        effort: candidate?.effort ?? "medium",
        ingredientKeys:
          candidate?.ingredientKeys ??
          (option?.ingredients ?? []).map((ingredient) => ingredient.name.toLowerCase()),
        sharedPrepKeys: candidate?.sharedPrepKeys ?? [],
        cuisineKey: candidate?.cuisineKey ?? null,
        proteinKey: candidate?.proteinKey ?? null,
      };
    });
    assistedExistingMeals = existingMeals;
    const occupiedDayIndexes = new Set(baseWeekEntries.map((entry) => weekDates.indexOf(entry.plan_date)).filter((index) => index >= 0));
    const openDayIndexes = weekDates.map((_, index) => index).filter((index) => !occupiedDayIndexes.has(index));
    assistedSparseData =
      candidateResult.learnedSignals.overallConfidence === "low" ||
      candidateResult.learnedSignals.patterns.length === 0;
    const suggested = buildPlannerWeekDraft({
      mode: plannerMode,
      candidates: candidateResult.candidates,
      existingMeals,
      pantryStaples,
      sparseData: assistedSparseData,
      fillCount: Math.min(defaultFillCountForMode(plannerMode), openDayIndexes.length),
      availableDayIndexes: openDayIndexes,
    });
    assistedPlannerMeta = {
      enabled: true,
      mode: plannerMode,
      modeLabel: labelForMode(plannerMode),
      openNightsAvailable: openDayIndexes.length,
      suggestedNightCount: suggested.assignments.length,
      draftAvailable: suggested.assignments.length > 0,
    };

    if (suggested.assignments.length > 0) {
      const missingVersionIds = suggested.assignments
        .map((assignment) => assignment.versionId)
        .filter((versionId) => !optionByVersionId.has(versionId));
      const suggestedOptions = await loadPlannerRecipeOptionsForVersions(user.id, missingVersionIds, { supabase });
      if (suggestedOptions.length > 0) {
        const existingVersionIds = new Set(recipeOptions.map((option) => option.versionId));
        mergedRecipeOptions = [
          ...recipeOptions,
          ...suggestedOptions.filter((option) => !existingVersionIds.has(option.versionId)),
        ];
      }

      assistedDraft = buildTransientPlannerDraft({
        mode: plannerMode,
        assignments: suggested.assignments,
        weekDates,
        dayLabels: validDays,
        planningEligibilityReasonByVersionId: new Map(
          candidateResult.candidates.map((candidate) => [candidate.versionId, candidate.planningEligibilityReason ?? null])
        ),
      });
    }
  }

  const acceptedVersionIds = baseWeekEntries.map((entry) => entry.version_id);
  const knownVersionIds = new Set(mergedRecipeOptions.map((option) => option.versionId));
  const missingAcceptedVersionIds = acceptedVersionIds.filter((versionId) => !knownVersionIds.has(versionId));
  if (missingAcceptedVersionIds.length > 0) {
    const acceptedOptions = await loadPlannerRecipeOptionsForVersions(user.id, missingAcceptedVersionIds, { supabase });
    if (acceptedOptions.length > 0) {
      mergedRecipeOptions = [
        ...mergedRecipeOptions,
        ...acceptedOptions.filter((option) => !knownVersionIds.has(option.versionId)),
      ];
    }
  }

  acceptedWeekGrocery = deriveWeekGroceryFromAcceptedEntries({
    acceptedEntries: baseWeekEntries,
    recipeOptions: mergedRecipeOptions,
    pantryStaples,
  });

  return (
    <MealPlannerClient
      key={`${weekStartDate}:${plannerMode}`}
      recipeOptions={mergedRecipeOptions}
      pantryStaples={pantryStaples}
      initialAcceptedWeekEntries={baseWeekEntries}
      initialAcceptedWeekGrocery={acceptedWeekGrocery}
      initialSelectedRecipeIds={initialSelectedRecipeIds}
      initialSelectedVersionIds={initialSelectedVersionIds}
      initialWeekEntries={initialWeekEntries}
      weekStartDate={weekStartDate}
      plannerPersistenceAvailable={!plannerTableMissing}
      autoAssignedFromQuery={Boolean(autoAssignDay && autoAssignRecipe)}
      initialAssistedDraft={assistedDraft}
      assistedCandidates={assistedCandidates}
      assistedExistingMeals={assistedExistingMeals}
      assistedSparseData={assistedSparseData}
      assistedPlannerMeta={assistedPlannerMeta}
    />
  );
}
