import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { loadPlannerRecipeOptions } from "@/lib/plannerData";
import { MealPlannerClient } from "@/components/planner/MealPlannerClient";

type PlannerPageProps = {
  searchParams?: Promise<{
    recipe?: string | string[];
    version?: string | string[];
  }>;
};

function toArray(value: string | string[] | undefined) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export default async function PlannerPage({ searchParams }: PlannerPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const [recipeOptions, preferencesResult] = await Promise.all([
    loadPlannerRecipeOptions(user.id),
    supabase.from("user_preferences").select("pantry_staples, pantry_confident_staples").eq("owner_id", user.id).maybeSingle(),
  ]);

  const pantryStaples = [
    ...(preferencesResult.data?.pantry_staples ?? []),
    ...(preferencesResult.data?.pantry_confident_staples ?? []),
  ];
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialSelectedRecipeIds = toArray(resolvedSearchParams?.recipe);
  const initialSelectedVersionIds = toArray(resolvedSearchParams?.version);

  return (
    <MealPlannerClient
      recipeOptions={recipeOptions}
      pantryStaples={pantryStaples}
      initialSelectedRecipeIds={initialSelectedRecipeIds}
      initialSelectedVersionIds={initialSelectedVersionIds}
    />
  );
}
