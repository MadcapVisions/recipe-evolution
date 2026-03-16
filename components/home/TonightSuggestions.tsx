"use client";

import { useEffect, useMemo, useState } from "react";
import type { RecipeIdea } from "@/components/home/types";
import { trendingRecipes, type TrendingRecipe } from "@/lib/trendingRecipes";

type TonightSuggestionsProps = {
  onCookThis: (title: string) => Promise<void>;
  loading: boolean;
  activeTitle: string | null;
  ideas?: RecipeIdea[] | null;
  kicker?: string;
  heading?: string;
  description?: string;
};

const iconByTag: Record<string, string> = {
  spicy: "🔥",
  healthy: "🥗",
  protein: "💪",
  mexican: "🌮",
  pasta: "🍝",
  quick: "⚡",
};

const pickRandom = (items: TrendingRecipe[], count: number) =>
  [...items]
    .sort(() => 0.5 - Math.random())
    .slice(0, Math.min(count, items.length));

export function TonightSuggestions({
  onCookThis,
  loading,
  activeTitle,
  ideas,
  kicker = "Starting points",
  heading = "Strong directions to develop next",
  description = "Pick a direction, then turn it into a recipe you would actually want to keep.",
}: TonightSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<TrendingRecipe[]>(() => trendingRecipes.slice(0, 3));
  const [localError, setLocalError] = useState<string | null>(null);
  const byTitle = useMemo(() => new Map(trendingRecipes.map((item) => [item.title, item])), []);
  const customIdeas = Array.isArray(ideas) && ideas.length > 0 ? ideas : null;

  useEffect(() => {
    if (customIdeas) {
      return;
    }
    setSuggestions(pickRandom(trendingRecipes, 3));
  }, [customIdeas]);

  const swapIdea = (index: number) => {
    setSuggestions((current) => {
      const currentTitles = new Set(current.map((item) => item.title));
      const pool = trendingRecipes.filter((item) => !currentTitles.has(item.title) || item.title === current[index]?.title);
      const choices = pool.filter((item) => item.title !== current[index]?.title);
      if (choices.length === 0) return current;
      const replacement = choices[Math.floor(Math.random() * choices.length)];
      const next = [...current];
      next[index] = replacement;
      return next;
    });
  };

  const handleCook = async (title: string) => {
    setLocalError(null);
    const candidate = byTitle.get(title);
    if (!candidate) {
      setLocalError("Could not load recipe idea.");
      return;
    }
    try {
      await onCookThis(candidate.title);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Could not generate recipe.");
    }
  };

  return (
    <section className="app-panel p-6">
      <p className="app-kicker">{kicker}</p>
      <h2 className="mt-2 font-display text-[36px] font-semibold tracking-tight text-[color:var(--text)]">{heading}</h2>
      <p className="mt-2 text-[16px] text-[color:var(--muted)]">{description}</p>
      {loading && activeTitle ? (
        <div className="mt-4 rounded-[22px] border border-[rgba(111,135,103,0.18)] bg-[rgba(111,135,103,0.1)] px-4 py-3 text-sm text-[color:#35513a]">
          Building <span className="font-semibold">{activeTitle}</span> now. Please wait...
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(customIdeas ?? suggestions).map((suggestion, index) => (
          <article
            key={`${suggestion.title}-${index}`}
            className="flex h-full cursor-pointer flex-col rounded-[26px] border border-[rgba(79,54,33,0.08)] bg-[rgba(255,252,246,0.94)] p-4 shadow-[0_8px_18px_rgba(76,50,24,0.05)] transition hover:-translate-y-px hover:shadow-[0_12px_24px_rgba(76,50,24,0.06)] sm:p-5"
          >
            <h3 className="text-[18px] font-semibold text-[color:var(--text)]">{suggestion.title}</h3>
            <p className="mt-1 text-[15px] leading-6 text-[color:var(--muted)] sm:text-[16px] sm:leading-7">
              {suggestion.description}
            </p>
            {"cookTime" in suggestion ? (
              <>
                <p className="mt-3 text-[16px] font-medium text-[color:var(--text)]">⏱ {suggestion.cookTime}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestion.tags.slice(0, 1).map((tag) => (
                    <span key={`${suggestion.title}-${tag}`} className="rounded-full bg-[rgba(111,102,95,0.08)] px-2.5 py-1 text-xs font-medium text-[color:var(--muted)]">
                      {iconByTag[tag] ? `${iconByTag[tag]} ` : ""}
                      {tag}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(111,102,95,0.8)]">
                Est. cook time {suggestion.cook_time_min ?? 30} min
              </p>
            )}
            <div className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row">
              <button
                type="button"
                onClick={() => void handleCook(suggestion.title)}
                disabled={loading}
                className="flex-1 rounded-full bg-[color:var(--primary)] px-4 py-3 text-[16px] font-semibold text-[#f8fcfb] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_18px_rgba(58,84,76,0.16)] transition hover:bg-[color:var(--primary-strong)] disabled:opacity-60"
              >
                {activeTitle === suggestion.title ? "Building..." : "Build This Dish"}
              </button>
              {!customIdeas ? (
                <button
                  type="button"
                  onClick={() => swapIdea(index)}
                  disabled={loading}
                  className="flex-1 rounded-full border border-[rgba(57,75,70,0.12)] bg-[rgba(255,252,246,0.92)] px-4 py-3 text-[16px] font-semibold text-[color:var(--text)] transition hover:bg-white disabled:opacity-60"
                >
                  Swap Direction
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {localError ? <p className="mt-3 text-sm text-red-600">{localError}</p> : null}
    </section>
  );
}
