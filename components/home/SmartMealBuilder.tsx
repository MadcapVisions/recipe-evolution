"use client";

import { useState } from "react";

type SmartMealBuilderProps = {
  smartProteins: string[];
  smartCuisines: string[];
  smartCookTimes: string[];
  smartPreferences: string[];
  smartLoading: boolean;
  smartError: string | null;
  onToggleProtein: (value: string) => void;
  onToggleCuisine: (value: string) => void;
  onToggleCookTime: (value: string) => void;
  onTogglePreference: (value: string) => void;
  onGenerateRecipes: () => void;
};

const chipClasses = (active: boolean) =>
  active
    ? "app-chip app-chip-active"
    : "app-chip border border-[rgba(79,54,33,0.08)] bg-[rgba(111,102,95,0.06)] hover:bg-[rgba(111,102,95,0.1)]";

export function SmartMealBuilder({
  smartProteins,
  smartCuisines,
  smartCookTimes,
  smartPreferences,
  smartLoading,
  smartError,
  onToggleProtein,
  onToggleCuisine,
  onToggleCookTime,
  onTogglePreference,
  onGenerateRecipes,
}: SmartMealBuilderProps) {
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  return (
    <aside className="app-panel h-full">
      <div className="flex h-full flex-col p-6">
        <p className="app-kicker">Meal builder</p>
        <h2 className="mt-3 font-display text-[36px] font-semibold tracking-tight text-[color:var(--text)]">Build from a few decisions.</h2>
        <p className="mt-2 max-w-md text-[16px] leading-7 text-[color:var(--muted)]">Use this when you know the constraints but not the exact dish.</p>

        <div className="mt-6 space-y-5">
          <div>
            <p className="mb-3 text-[16px] font-semibold text-[color:var(--text)]">Protein</p>
            <div className="flex flex-wrap gap-2">
              {["Chicken", "Beef", "Fish", "Pork", "Tofu", "Beans", "Eggs", "No Preference"].map((option) => (
                <button key={`protein-${option}`} type="button" onClick={() => onToggleProtein(option)} className={chipClasses(smartProteins.includes(option))}>
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-[16px] font-semibold text-[color:var(--text)]">Cook Time</p>
            <div className="flex flex-wrap gap-2">
              {["15 min", "30 min", "45 min", "1 hour"].map((option) => (
                <button key={`time-${option}`} type="button" onClick={() => onToggleCookTime(option)} className={chipClasses(smartCookTimes.includes(option))}>
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setShowMoreFilters((current) => !current)}
              className="w-full rounded-full border border-[rgba(57,75,70,0.12)] bg-[rgba(255,252,246,0.92)] px-4 py-3 text-[15px] font-semibold text-[color:var(--text)] transition hover:bg-white"
            >
              {showMoreFilters ? "Hide extra filters" : "More filters"}
            </button>
          </div>

          <div className={`${showMoreFilters ? "block" : "hidden"} space-y-5 lg:block`}>
            <div>
              <p className="mb-3 text-[16px] font-semibold text-[color:var(--text)]">Cuisine / Style</p>
              <div className="flex flex-wrap gap-2">
                {["Italian", "Mexican", "Asian", "Mediterranean", "Comfort Food", "Healthy"].map((option) => (
                  <button key={`cuisine-${option}`} type="button" onClick={() => onToggleCuisine(option)} className={chipClasses(smartCuisines.includes(option))}>
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-[16px] font-semibold text-[color:var(--text)]">Optional Preferences</p>
              <div className="flex flex-wrap gap-2">
                {["High Protein", "Low Carb", "Vegetarian", "Gluten Free", "Spicy"].map((option) => (
                  <button key={`pref-${option}`} type="button" onClick={() => onTogglePreference(option)} className={chipClasses(smartPreferences.includes(option))}>
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onGenerateRecipes}
            disabled={smartLoading}
            className="w-full rounded-full bg-[linear-gradient(135deg,var(--primary)_0%,var(--accent)_100%)] py-3.5 text-[16px] font-semibold text-[#f8fcfb] shadow-[0_18px_30px_rgba(82,124,116,0.18)] transition hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {smartLoading ? "Generating..." : "Generate Recipes"}
          </button>
        </div>

        {smartError ? <p className="mt-4 text-sm text-red-600">{smartError}</p> : null}
      </div>
    </aside>
  );
}
