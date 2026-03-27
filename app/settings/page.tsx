import { redirect } from "next/navigation";
import { AccountSettingsForm } from "@/components/settings/AccountSettingsForm";
import { PreferencesForm } from "@/components/preferences/PreferencesForm";
import { SignOutButton } from "@/components/SignOutButton";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: preferences } = await supabase
    .from("user_preferences")
    .select(
      "preferred_units, cooking_skill_level, common_diet_tags, disliked_ingredients, favorite_cuisines, favorite_proteins, preferred_flavors, pantry_staples, pantry_confident_staples, spice_tolerance, health_goals, taste_notes"
    )
    .eq("owner_id", user.id)
    .maybeSingle();

  const displayName =
    typeof user.user_metadata?.display_name === "string" && user.user_metadata.display_name.trim().length > 0
      ? user.user_metadata.display_name.trim()
      : typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim().length > 0
        ? user.user_metadata.full_name.trim()
        : [user.user_metadata?.first_name, user.user_metadata?.last_name]
            .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
            .map((value) => value.trim())
            .join(" ");

  const createdAtLabel = user.created_at ? new Date(user.created_at).toLocaleDateString() : null;
  const userTitle = displayName || user.email || "Your account";
  return (
    <div className="mx-auto max-w-7xl page-shell space-y-8">
      <div className="space-y-5">
        <div className="space-y-3">
          <p className="app-kicker">Settings</p>
          <h1 className="page-title">Kitchen settings</h1>
          <p className="max-w-3xl text-[16px] leading-7 text-[color:var(--muted)]">
            Manage your account, taste profile, and kitchen defaults so Chef starts from a better understanding of how you cook.
          </p>
        </div>
      </div>

      <section className="saas-card space-y-5 p-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(220px,0.8fr)_minmax(0,1fr)] xl:items-center">
          <div className="space-y-2">
            <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Cookbook owner</p>
            <h2 className="break-words text-[28px] font-semibold tracking-tight text-[color:var(--text)]">{userTitle}</h2>
            <p className="text-[16px] text-[color:var(--muted)]">Signed in as {user.email ?? "No email"}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(150px,0.7fr)_minmax(180px,0.8fr)_auto]">
            <div className="min-w-0 rounded-[20px] border border-[rgba(57,52,43,0.06)] bg-[rgba(250,248,242,0.92)] px-5 py-4">
              <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Email</p>
              <p className="mt-3 break-words text-[15px] font-medium leading-7 text-[color:var(--text)]">{user.email ?? "No email"}</p>
            </div>
            <div className="min-w-0 rounded-[20px] border border-[rgba(74,106,96,0.08)] bg-[rgba(74,106,96,0.06)] px-5 py-4">
              <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Plan</p>
              <p className="mt-3 text-[15px] font-medium leading-7 text-[color:var(--text)]">Free</p>
            </div>
            <div className="min-w-0 rounded-[20px] border border-[rgba(57,52,43,0.06)] bg-[rgba(255,252,246,0.82)] px-5 py-4">
              <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Member since</p>
              <p className="mt-3 text-[15px] font-medium leading-7 text-[color:var(--text)]">{createdAtLabel ?? "Recently joined"}</p>
            </div>
            <div className="flex items-end lg:justify-end">
              <SignOutButton />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="saas-card hidden h-fit space-y-3 p-4 xl:sticky xl:top-32 xl:block">
          <p className="app-kicker">Navigate</p>
          <nav className="space-y-2">
            <a
              href="#account"
              className="block rounded-[18px] border border-[rgba(79,54,33,0.08)] bg-[rgba(255,252,246,0.78)] px-4 py-3 text-[15px] font-medium text-[color:var(--text)] transition hover:border-[rgba(74,106,96,0.22)]"
            >
              Account
            </a>
            <a
              href="#preferences"
              className="block rounded-[18px] border border-[rgba(79,54,33,0.08)] bg-[rgba(255,252,246,0.78)] px-4 py-3 text-[15px] font-medium text-[color:var(--text)] transition hover:border-[rgba(74,106,96,0.22)]"
            >
              Kitchen profile
            </a>
          </nav>
        </aside>

        <div className="space-y-6">
          <section id="account" className="scroll-mt-32 space-y-3">
            <div className="space-y-2">
              <p className="app-kicker">Account</p>
              <h2 className="text-[28px] font-semibold tracking-tight text-[color:var(--text)]">Identity and sign-in</h2>
              <p className="text-[16px] leading-7 text-[color:var(--muted)]">
                Keep your cookbook owner details current and control how you sign in.
              </p>
            </div>
            <AccountSettingsForm
              initialEmail={user.email ?? ""}
              initialDisplayName={displayName}
            />
          </section>

          <section id="preferences" className="scroll-mt-32 space-y-3">
            <div className="space-y-2">
              <p className="app-kicker">Kitchen profile</p>
              <h2 className="text-[28px] font-semibold tracking-tight text-[color:var(--text)]">Taste and cooking defaults</h2>
              <p className="text-[16px] leading-7 text-[color:var(--muted)]">
                Set the baseline for what you like to cook and eat. MealMaxer uses this together with your saved dishes and behavior over time.
              </p>
            </div>
            <PreferencesForm
              ownerId={user.id}
              initialPreferredUnits={preferences?.preferred_units === "imperial" ? "imperial" : "metric"}
              initialSkill={preferences?.cooking_skill_level ?? ""}
              initialDietTags={preferences?.common_diet_tags ?? []}
              initialDislikedIngredients={preferences?.disliked_ingredients ?? []}
              initialFavoriteCuisines={preferences?.favorite_cuisines ?? []}
              initialFavoriteProteins={preferences?.favorite_proteins ?? []}
              initialPreferredFlavors={preferences?.preferred_flavors ?? []}
              initialPantryStaples={preferences?.pantry_staples ?? []}
              initialPantryConfidentStaples={preferences?.pantry_confident_staples ?? []}
              initialSpiceTolerance={preferences?.spice_tolerance ?? ""}
              initialHealthGoals={preferences?.health_goals ?? []}
              initialTasteNotes={preferences?.taste_notes ?? ""}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
