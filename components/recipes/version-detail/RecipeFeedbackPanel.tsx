"use client";

import { useState } from "react";

type FeedbackSignal = "thumbs_up" | "thumbs_down";
type FeedbackReason = "too_heavy" | "too_spicy" | "dont_like_ingredients" | "not_what_i_wanted";

const REASONS: { value: FeedbackReason; label: string }[] = [
  { value: "too_heavy", label: "Too heavy" },
  { value: "too_spicy", label: "Too spicy" },
  { value: "dont_like_ingredients", label: "Don't like the ingredients" },
  { value: "not_what_i_wanted", label: "Not what I wanted" },
];

type Props = {
  recipeId: string;
  versionId: string;
  recipeTitle: string;
  recipeTags: string[];
  ingredientNames: string[];
  dishFamily: string | null;
};

type State =
  | { kind: "idle" }
  | { kind: "choosing_reason"; signal: "thumbs_down" }
  | { kind: "submitting" }
  | { kind: "done"; signal: FeedbackSignal };

export function RecipeFeedbackPanel({
  recipeId,
  versionId,
  recipeTitle,
  recipeTags,
  ingredientNames,
  dishFamily,
}: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function submit(signal: FeedbackSignal, reason?: FeedbackReason) {
    setState({ kind: "submitting" });
    try {
      await fetch("/api/taste/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe_id: recipeId,
          recipe_version_id: versionId,
          signal,
          reason: reason ?? null,
          recipe_title: recipeTitle,
          recipe_tags: recipeTags,
          recipe_ingredients: ingredientNames,
          dish_family: dishFamily,
        }),
      });
    } catch {
      // fire-and-forget — silent failure is OK here
    }
    setState({ kind: "done", signal });
  }

  function handleThumbsUp() {
    void submit("thumbs_up");
  }

  function handleThumbsDown() {
    setState({ kind: "choosing_reason", signal: "thumbs_down" });
  }

  function handleReason(reason: FeedbackReason) {
    void submit("thumbs_down", reason);
  }

  function handleSkipReason() {
    void submit("thumbs_down");
  }

  if (state.kind === "done") {
    return (
      <section className="app-panel px-4 py-4 sm:px-6">
        <p className="text-[13px] font-semibold text-[color:var(--primary)]">
          {state.signal === "thumbs_up"
            ? "Got it — noted as a good match."
            : "Thanks for the feedback. I'll learn from this."}
        </p>
      </section>
    );
  }

  return (
    <section className="app-panel px-4 py-4 sm:px-6">
      <p className="app-kicker">Taste feedback</p>

      {state.kind === "choosing_reason" ? (
        <div className="mt-3 space-y-3">
          <p className="text-[14px] font-semibold text-[color:var(--text)]">What didn&rsquo;t work for you?</p>
          <div className="flex flex-wrap gap-2">
            {REASONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleReason(value)}
                className="rounded-full border border-[rgba(57,75,70,0.12)] bg-white px-4 py-2 text-[13px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(74,106,96,0.08)]"
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={handleSkipReason}
              className="rounded-full px-4 py-2 text-[13px] font-semibold text-[color:var(--muted)] transition hover:text-[color:var(--text)]"
            >
              Skip
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-3">
          <p className="text-[14px] text-[color:var(--muted)]">Did this fit your taste?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleThumbsUp}
              disabled={state.kind === "submitting"}
              aria-label="This fits my taste"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(57,75,70,0.12)] bg-white text-[18px] transition hover:bg-[rgba(74,106,96,0.08)] disabled:opacity-50"
            >
              👍
            </button>
            <button
              type="button"
              onClick={handleThumbsDown}
              disabled={state.kind === "submitting"}
              aria-label="This doesn't fit my taste"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(57,75,70,0.12)] bg-white text-[18px] transition hover:bg-[rgba(74,106,96,0.08)] disabled:opacity-50"
            >
              👎
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
