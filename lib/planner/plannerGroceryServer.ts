import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { loadPlannerRecipeOptionsForVersions } from "@/lib/plannerData";
import {
  deriveWeekGroceryFromAcceptedEntries,
  type AcceptedMealPlanEntry,
  type DerivedWeekGroceryResult,
} from "@/lib/planner/plannerGrocery";

export async function deriveWeekGroceryFromAcceptedPlan(input: {
  userId: string;
  startDate: string;
  endDate: string;
  supabase?: SupabaseClient;
}): Promise<DerivedWeekGroceryResult> {
  const supabase = input.supabase ?? (await createSupabaseServerClient());
  const [preferencesResult, plannerEntriesResult] = await Promise.all([
    supabase
      .from("user_preferences")
      .select("pantry_staples, pantry_confident_staples")
      .eq("owner_id", input.userId)
      .maybeSingle(),
    supabase
      .from("meal_plan_entries")
      .select("plan_date, sort_order, recipe_id, version_id, servings")
      .eq("owner_id", input.userId)
      .gte("plan_date", input.startDate)
      .lte("plan_date", input.endDate)
      .order("plan_date", { ascending: true })
      .order("sort_order", { ascending: true }),
  ]);

  if (plannerEntriesResult.error) {
    throw new Error(plannerEntriesResult.error.message);
  }

  if (preferencesResult.error) {
    throw new Error(preferencesResult.error.message);
  }

  const acceptedEntries = (plannerEntriesResult.data ?? []) as AcceptedMealPlanEntry[];
  const plannerOptions = await loadPlannerRecipeOptionsForVersions(
    input.userId,
    acceptedEntries.map((entry) => entry.version_id),
    { supabase }
  );
  const pantryStaples = [
    ...(preferencesResult.data?.pantry_staples ?? []),
    ...(preferencesResult.data?.pantry_confident_staples ?? []),
  ];

  return deriveWeekGroceryFromAcceptedEntries({
    acceptedEntries,
    recipeOptions: plannerOptions,
    pantryStaples,
  });
}
