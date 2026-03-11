import { redirect } from "next/navigation";
import { PreferencesForm } from "@/components/preferences/PreferencesForm";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export default async function PreferencesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("preferred_units, cooking_skill_level, common_diet_tags")
    .eq("owner_id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl page-shell">
      <div className="space-y-3">
        <p className="app-kicker">Settings</p>
        <h1 className="page-title">Preferences</h1>
        <p className="text-[16px] leading-7 text-[color:var(--muted)]">Set your units, cooking level, and default diet tags so new recipes fit your workflow.</p>
      </div>
      <PreferencesForm
        ownerId={user.id}
        initialPreferredUnits={preferences?.preferred_units === "imperial" ? "imperial" : "metric"}
        initialSkill={preferences?.cooking_skill_level ?? ""}
        initialDietTags={preferences?.common_diet_tags ?? []}
      />
    </div>
  );
}
