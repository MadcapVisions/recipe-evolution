import Link from "next/link";
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
      "preferred_units, cooking_skill_level, common_diet_tags, disliked_ingredients, favorite_cuisines, favorite_proteins, preferred_flavors, pantry_staples, spice_tolerance, health_goals, taste_notes"
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
          <h1 className="page-title">Personal settings</h1>
          <p className="max-w-3xl text-[16px] leading-7 text-[color:var(--muted)]">
            Manage your account, password, meal preferences, and service details from one place.
          </p>
        </div>
      </div>

      <section className="saas-card space-y-5 p-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(220px,0.8fr)_minmax(0,1fr)] xl:items-center">
          <div className="space-y-2">
            <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Account info</p>
            <h2 className="break-words text-[28px] font-semibold tracking-tight text-[color:var(--text)]">{userTitle}</h2>
            <p className="text-[16px] text-[color:var(--muted)]">Signed in as {user.email ?? "No email"}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(150px,0.7fr)_minmax(180px,0.8fr)_auto]">
            <div className="min-w-0 rounded-[20px] bg-[rgba(141,169,187,0.08)] px-5 py-4">
              <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Email</p>
              <p className="mt-3 break-words text-[15px] font-medium leading-7 text-[color:var(--text)]">{user.email ?? "No email"}</p>
            </div>
            <div className="min-w-0 rounded-[20px] bg-[rgba(142,168,141,0.1)] px-5 py-4">
              <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Plan</p>
              <p className="mt-3 text-[15px] font-medium leading-7 text-[color:var(--text)]">Free</p>
            </div>
            <div className="min-w-0 rounded-[20px] bg-[rgba(255,252,246,0.72)] px-5 py-4 ring-1 ring-[rgba(79,54,33,0.08)]">
              <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Member since</p>
              <p className="mt-3 text-[15px] font-medium leading-7 text-[color:var(--text)]">{createdAtLabel ?? "Recently joined"}</p>
            </div>
            <div className="flex items-end lg:justify-end">
              <SignOutButton />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="saas-card hidden h-fit space-y-3 p-4 xl:sticky xl:top-32 xl:block">
          <p className="app-kicker">Navigate</p>
          <nav className="space-y-2">
            <a
              href="#account"
              className="block rounded-[18px] border border-[rgba(79,54,33,0.08)] bg-[rgba(255,252,246,0.72)] px-4 py-3 text-[15px] font-medium text-[color:var(--text)] transition hover:border-[rgba(141,169,187,0.35)]"
            >
              Account
            </a>
            <a
              href="#preferences"
              className="block rounded-[18px] border border-[rgba(79,54,33,0.08)] bg-[rgba(255,252,246,0.72)] px-4 py-3 text-[15px] font-medium text-[color:var(--text)] transition hover:border-[rgba(141,169,187,0.35)]"
            >
              Taste profile
            </a>
            <a
              href="#billing"
              className="block rounded-[18px] border border-[rgba(79,54,33,0.08)] bg-[rgba(255,252,246,0.72)] px-4 py-3 text-[15px] font-medium text-[color:var(--text)] transition hover:border-[rgba(141,169,187,0.35)]"
            >
              Billing
            </a>
            <a
              href="#support"
              className="block rounded-[18px] border border-[rgba(79,54,33,0.08)] bg-[rgba(255,252,246,0.72)] px-4 py-3 text-[15px] font-medium text-[color:var(--text)] transition hover:border-[rgba(141,169,187,0.35)]"
            >
              Support
            </a>
          </nav>
        </aside>

        <div className="space-y-6">
          <section id="account" className="scroll-mt-32 space-y-3">
            <div className="space-y-2">
              <p className="app-kicker">Account</p>
              <h2 className="text-[28px] font-semibold tracking-tight text-[color:var(--text)]">Identity and sign-in</h2>
              <p className="text-[16px] leading-7 text-[color:var(--muted)]">
                Keep your account details current and control how you sign in.
              </p>
            </div>
            <AccountSettingsForm
              initialEmail={user.email ?? ""}
              initialDisplayName={displayName}
            />
          </section>

          <section id="preferences" className="scroll-mt-32 space-y-3">
            <div className="space-y-2">
              <p className="app-kicker">Meal profile</p>
              <h2 className="text-[28px] font-semibold tracking-tight text-[color:var(--text)]">Taste and food preferences</h2>
              <p className="text-[16px] leading-7 text-[color:var(--muted)]">
                Set the baseline for what you like to cook and eat. Recipe Evolution uses this together with your behavior over time.
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
              initialSpiceTolerance={preferences?.spice_tolerance ?? ""}
              initialHealthGoals={preferences?.health_goals ?? []}
              initialTasteNotes={preferences?.taste_notes ?? ""}
            />
          </section>

          <section id="billing" className="scroll-mt-32 saas-card space-y-4 p-5">
            <div className="space-y-2">
              <p className="app-kicker">Subscription</p>
              <h2 className="text-[24px] font-semibold tracking-tight text-[color:var(--text)]">Plan and billing</h2>
              <p className="text-[15px] leading-6 text-[color:var(--muted)]">
                This is where users will manage payment details and understand what plan they are on.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)]">
              <div className="rounded-[24px] bg-[rgba(141,169,187,0.08)] p-4">
                <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Current plan</p>
                <p className="mt-2 text-[28px] font-semibold text-[color:var(--text)]">Free</p>
                <p className="mt-2 text-[15px] leading-6 text-[color:var(--muted)]">
                  Billing and subscription controls will appear here once paid plans are enabled.
                </p>
              </div>
              <div className="rounded-[24px] border border-[rgba(79,54,33,0.08)] bg-[rgba(255,252,246,0.72)] p-4">
                <p className="text-[15px] font-semibold text-[color:var(--text)]">What will live here</p>
                <ul className="mt-3 space-y-2 text-[15px] leading-6 text-[color:var(--muted)]">
                  <li>Manage subscription</li>
                  <li>View billing history</li>
                  <li>Update payment method</li>
                </ul>
                <div className="mt-4">
                  <Link
                    href="/pricing"
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--primary)_0%,var(--accent)_100%)] px-5 py-2.5 text-[15px] font-semibold text-white shadow-[0_16px_28px_rgba(82,124,116,0.18)] transition hover:brightness-[1.03]"
                  >
                    View pricing
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section id="support" className="scroll-mt-32 saas-card space-y-4 p-5">
            <div className="space-y-2">
              <p className="app-kicker">Help</p>
              <h2 className="text-[24px] font-semibold tracking-tight text-[color:var(--text)]">Customer service</h2>
              <p className="text-[15px] leading-6 text-[color:var(--muted)]">
                Keep support and service information in one predictable place.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[24px] bg-[rgba(142,168,141,0.1)] p-4">
                <p className="text-[15px] font-semibold text-[color:var(--text)]">Support tools are the next service layer.</p>
                <p className="mt-2 text-[15px] leading-6 text-[color:var(--muted)]">
                  This area is reserved for billing help, account support, FAQs, and direct customer service once support tooling is connected.
                </p>
              </div>
              <div className="rounded-[24px] border border-[rgba(79,54,33,0.08)] bg-[rgba(255,252,246,0.72)] p-4">
                <p className="text-[15px] font-semibold text-[color:var(--text)]">Coming soon</p>
                <ul className="mt-3 space-y-2 text-[15px] leading-6 text-[color:var(--muted)]">
                  <li>Account issue support</li>
                  <li>Billing questions</li>
                  <li>Recipe and product feedback</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
