import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { loadPlannerRecipeOptions } from "@/lib/plannerData";
import { MealPlannerClient } from "@/components/planner/MealPlannerClient";

type MealPlanEntry = {
  plan_date: string;
  sort_order: number;
  recipe_id: string;
  version_id: string;
  servings: number;
};

type PlannerPageProps = {
  searchParams?: Promise<{
    recipe?: string | string[];
    version?: string | string[];
    week?: string | string[];
    day?: string | string[];
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

  return (
    <MealPlannerClient
      key={weekStartDate}
      recipeOptions={recipeOptions}
      pantryStaples={pantryStaples}
      initialSelectedRecipeIds={initialSelectedRecipeIds}
      initialSelectedVersionIds={initialSelectedVersionIds}
      initialWeekEntries={initialWeekEntries}
      weekStartDate={weekStartDate}
      plannerPersistenceAvailable={!plannerTableMissing}
      autoAssignedFromQuery={Boolean(autoAssignDay && autoAssignRecipe)}
    />
  );
}
