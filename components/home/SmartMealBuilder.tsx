"use client";

import type { RecipeIdea } from "@/components/home/types";

type SmartMealBuilderProps = {
  smartProteins: string[];
  smartCuisines: string[];
  smartCookTimes: string[];
  smartPreferences: string[];
  smartLoading: boolean;
  smartStatus: string | null;
  smartError: string | null;
  smartGeneratingRecipe: boolean;
  smartSelectedIdeaTitle: string | null;
  smartIdeas: RecipeIdea[];
  onToggleProtein: (value: string) => void;
  onToggleCuisine: (value: string) => void;
  onToggleCookTime: (value: string) => void;
  onTogglePreference: (value: string) => void;
  onGenerateRecipes: () => void;
  onSelectIdea: (idea: RecipeIdea) => void;
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
  smartStatus,
  smartError,
  smartGeneratingRecipe,
  smartSelectedIdeaTitle,
  smartIdeas,
  onToggleProtein,
  onToggleCuisine,
  onToggleCookTime,
  onTogglePreference,
  onGenerateRecipes,
  onSelectIdea,
}: SmartMealBuilderProps) {
  return (
    <aside className="app-panel xl:self-start">
      <div className="p-6">
        <p className="app-kicker">Meal builder</p>
        <h2 className="mt-3 font-display text-[36px] font-semibold tracking-tight text-[color:var(--text)]">Build from a few decisions.</h2>
        <p className="mt-2 text-[16px] leading-7 text-[color:var(--muted)]">Use this when you know the constraints but not the exact dish.</p>

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
            <p className="mb-3 text-[16px] font-semibold text-[color:var(--text)]">Cook Time</p>
            <div className="flex flex-wrap gap-2">
              {["15 min", "30 min", "45 min", "1 hour"].map((option) => (
                <button key={`time-${option}`} type="button" onClick={() => onToggleCookTime(option)} className={chipClasses(smartCookTimes.includes(option))}>
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

          <button
            type="button"
            onClick={onGenerateRecipes}
            disabled={smartLoading}
            className="w-full rounded-full bg-[linear-gradient(135deg,var(--primary)_0%,var(--accent)_100%)] py-3.5 text-[16px] font-semibold text-[#f8fcfb] shadow-[0_18px_30px_rgba(82,124,116,0.18)] transition hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {smartLoading ? "Generating..." : "Generate Recipes"}
          </button>
        </div>

        {smartStatus ? (
          <div className="mt-4 rounded-[22px] border border-[rgba(111,135,103,0.18)] bg-[rgba(111,135,103,0.1)] px-4 py-3 text-sm text-[color:#35513a]">
            {smartStatus}
          </div>
        ) : null}
        {smartError ? <p className="mt-4 text-sm text-red-600">{smartError}</p> : null}
        {smartGeneratingRecipe ? (
          <p className="mt-4 text-sm text-[color:var(--primary)]">
            Building a custom recipe
            {smartSelectedIdeaTitle ? `: ${smartSelectedIdeaTitle}` : ""}.
          </p>
        ) : null}

        {smartIdeas.length > 0 ? (
          <div className="mt-6 border-t border-[rgba(79,54,33,0.08)] pt-5">
            <h3 className="font-display text-[28px] font-semibold text-[color:var(--text)]">Suggested directions</h3>
            <div className="mt-4 grid grid-cols-1 gap-3">
              {smartIdeas.map((idea, index) => (
                <button
                  key={`smart-${idea.title}-${index}`}
                  type="button"
                  onClick={() => onSelectIdea(idea)}
                  disabled={smartGeneratingRecipe}
                  className="cursor-pointer rounded-[24px] border border-[rgba(79,54,33,0.08)] bg-[rgba(255,252,246,0.92)] p-4 text-left transition hover:-translate-y-px hover:shadow-[0_14px_30px_rgba(76,50,24,0.08)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <p className="font-semibold text-[color:var(--text)]">{idea.title}</p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">{idea.description}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(111,102,95,0.8)]">
                    Est. cook time {idea.cook_time_min ?? 30} min
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
