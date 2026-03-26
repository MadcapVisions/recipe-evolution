"use client";

import { useEffect, useState } from "react";
import type { WhyFitsResponse } from "@/app/api/taste/why-fits/route";

type Props = {
  recipeTitle: string;
  recipeTags: string[];
  ingredientNames: string[];
  dishFamily: string | null;
};

type State =
  | { kind: "loading" }
  | { kind: "hidden" }
  | { kind: "ready"; lines: string[] };

export function RecipeWhyFitsPanel({ recipeTitle, recipeTags, ingredientNames, dishFamily }: Props) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/taste/why-fits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipe_title: recipeTitle,
            recipe_tags: recipeTags,
            recipe_ingredients: ingredientNames,
            dish_family: dishFamily,
          }),
        });

        if (!res.ok || cancelled) return;

        const data = (await res.json()) as WhyFitsResponse;
        if (cancelled) return;

        if (data.show && data.lines.length > 0) {
          setState({ kind: "ready", lines: data.lines });
        } else {
          setState({ kind: "hidden" });
        }
      } catch {
        if (!cancelled) setState({ kind: "hidden" });
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally only runs once on mount — recipe features don't change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.kind === "loading" || state.kind === "hidden") return null;

  return (
    <section className="app-panel px-4 py-4 sm:px-6">
      <p className="app-kicker">Why this fits you</p>
      <ul className="mt-3 space-y-2">
        {state.lines.map((line, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[14px] leading-6 text-[color:var(--text)]">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--primary)]" />
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}
