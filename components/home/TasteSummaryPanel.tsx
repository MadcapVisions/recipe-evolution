"use client";

import type { UserTasteProfile } from "@/components/home/types";

const COLD_START_PICKS = [
  "High protein",
  "Healthy",
  "Comfort food",
  "Vegetarian",
  "Spicy",
  "Quick meals",
];

type Props = {
  profile: UserTasteProfile | null;
  onPromptSelect: (text: string) => void;
};

function Chip({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-[rgba(57,75,70,0.07)] px-3 py-1.5 text-[13px] font-medium text-[color:var(--text)]">
      {label}
    </span>
  );
}

function hasData(profile: UserTasteProfile | null): boolean {
  if (!profile) return false;
  return (
    profile.favoriteCuisines.length > 0 ||
    profile.favoriteProteins.length > 0 ||
    profile.preferredFlavors.length > 0 ||
    profile.commonDietTags.length > 0 ||
    profile.healthGoals.length > 0
  );
}

function confidenceLabel(profile: UserTasteProfile): string {
  // Count how many distinct dimensions have data
  const filledDimensions = [
    profile.favoriteCuisines.length > 0,
    profile.favoriteProteins.length > 0,
    profile.preferredFlavors.length > 0,
    profile.healthGoals.length > 0,
    profile.commonDietTags.length > 0,
    !!profile.spiceTolerance,
    !!profile.tasteNotes,
  ].filter(Boolean).length;

  if (filledDimensions >= 4) return "Based on your preferences and recent activity";
  if (filledDimensions >= 2) return "Based on your saved preferences";
  return "Based on your settings";
}

export function TasteSummaryPanel({ profile, onPromptSelect }: Props) {
  if (!hasData(profile)) {
    // Cold-start: no preferences set — show quick picks that pre-fill the prompt
    return (
      <section className="app-panel px-4 py-4 sm:px-5">
        <p className="app-kicker">Your taste</p>
        <p className="mt-2 text-[14px] font-semibold text-[color:var(--text)]">Help Chef learn what you like</p>
        <p className="mt-1 text-[13px] leading-5 text-[color:var(--muted)]">
          Pick a style and Chef will tailor suggestions to your taste over time.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {COLD_START_PICKS.map((pick) => (
            <button
              key={pick}
              type="button"
              onClick={() => onPromptSelect(pick.toLowerCase())}
              className="rounded-full border border-[rgba(57,75,70,0.1)] bg-white px-3 py-1.5 text-[13px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(74,106,96,0.08)]"
            >
              {pick}
            </button>
          ))}
        </div>
      </section>
    );
  }

  const p = profile!;
  const cuisines = p.favoriteCuisines.slice(0, 3);
  const proteins = p.favoriteProteins.slice(0, 3);
  const flavors = p.preferredFlavors.slice(0, 3);
  const goals = p.healthGoals.slice(0, 2);
  const diets = p.commonDietTags.slice(0, 2);

  const avoidItems = p.dislikedIngredients.slice(0, 3);

  return (
    <section className="app-panel px-4 py-4 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <p className="app-kicker">Your taste</p>
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">
          {confidenceLabel(p)}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {(cuisines.length > 0 || proteins.length > 0 || flavors.length > 0) ? (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">Prefers</p>
            <div className="flex flex-wrap gap-1.5">
              {cuisines.map((c) => <Chip key={c} label={c} />)}
              {proteins.map((p) => <Chip key={p} label={p} />)}
              {flavors.map((f) => <Chip key={f} label={f} />)}
            </div>
          </div>
        ) : null}

        {(goals.length > 0 || diets.length > 0) ? (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">Goals</p>
            <div className="flex flex-wrap gap-1.5">
              {goals.map((g) => <Chip key={g} label={g} />)}
              {diets.map((d) => <Chip key={d} label={d} />)}
            </div>
          </div>
        ) : null}

        {avoidItems.length > 0 ? (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">Avoids</p>
            <div className="flex flex-wrap gap-1.5">
              {avoidItems.map((a) => <Chip key={a} label={a} />)}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
