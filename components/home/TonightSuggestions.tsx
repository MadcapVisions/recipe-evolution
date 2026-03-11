"use client";

import { useEffect, useMemo, useState } from "react";
import { trendingRecipes, type TrendingRecipe } from "@/lib/trendingRecipes";

type TonightSuggestionsProps = {
  onCookThis: (title: string) => Promise<void>;
  loading: boolean;
  activeTitle: string | null;
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

export function TonightSuggestions({ onCookThis, loading, activeTitle }: TonightSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<TrendingRecipe[]>(() => trendingRecipes.slice(0, 3));
  const [localError, setLocalError] = useState<string | null>(null);
  const byTitle = useMemo(() => new Map(trendingRecipes.map((item) => [item.title, item])), []);

  useEffect(() => {
    setSuggestions(pickRandom(trendingRecipes, 3));
  }, []);

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
      <p className="app-kicker">Starting points</p>
      <h2 className="mt-2 font-display text-[36px] font-semibold tracking-tight text-[color:var(--text)]">What should I cook tonight?</h2>
      <p className="mt-2 text-[16px] text-[color:var(--muted)]">Popular meals people are cooking right now.</p>
      {loading && activeTitle ? (
        <div className="mt-4 rounded-[22px] border border-[rgba(111,135,103,0.18)] bg-[rgba(111,135,103,0.1)] px-4 py-3 text-sm text-[color:#35513a]">
          Creating <span className="font-semibold">{activeTitle}</span> now. Please wait...
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {suggestions.map((suggestion, index) => (
          <article
            key={`${suggestion.title}-${index}`}
            className="flex h-full cursor-pointer flex-col rounded-[26px] border border-[rgba(79,54,33,0.08)] bg-[rgba(255,252,246,0.92)] p-5 shadow-[0_12px_24px_rgba(76,50,24,0.06)] transition hover:-translate-y-px hover:shadow-[0_18px_36px_rgba(76,50,24,0.08)]"
          >
            <h3 className="text-[18px] font-semibold text-[color:var(--text)]">{suggestion.title}</h3>
            <p className="mt-1 text-[16px] leading-7 text-[color:var(--muted)]">{suggestion.description}</p>
            <p className="mt-3 text-[16px] font-medium text-[color:var(--text)]">⏱ {suggestion.cookTime}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {suggestion.tags.slice(0, 2).map((tag) => (
                <span key={`${suggestion.title}-${tag}`} className="rounded-full bg-[rgba(111,102,95,0.08)] px-2.5 py-1 text-xs font-medium text-[color:var(--muted)]">
                  {iconByTag[tag] ? `${iconByTag[tag]} ` : ""}
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-auto flex gap-2 pt-4">
              <button
                type="button"
                onClick={() => void handleCook(suggestion.title)}
                disabled={loading}
                className="flex-1 rounded-full bg-[linear-gradient(135deg,var(--primary)_0%,var(--accent)_100%)] px-4 py-3 text-[16px] font-semibold text-[#f8fcfb] transition hover:brightness-[1.03] disabled:opacity-60"
              >
                {activeTitle === suggestion.title ? "Cooking..." : "Cook This"}
              </button>
              <button
                type="button"
                onClick={() => swapIdea(index)}
                disabled={loading}
                className="flex-1 rounded-full border border-[rgba(57,75,70,0.12)] bg-[rgba(255,252,246,0.92)] px-4 py-3 text-[16px] font-semibold text-[color:var(--text)] transition hover:bg-white disabled:opacity-60"
              >
                Swap Idea
              </button>
            </div>
          </article>
        ))}
      </div>

      {localError ? <p className="mt-3 text-sm text-red-600">{localError}</p> : null}
    </section>
  );
}
