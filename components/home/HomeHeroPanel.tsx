"use client";

import type { RefObject, KeyboardEvent as ReactKeyboardEvent } from "react";
import type { ChatMessage } from "@/components/home/types";

type HomeHeroPanelProps = {
  heroChatMessages: ChatMessage[];
  promptInput: string;
  loading: boolean;
  heroChatReadyToApply: boolean;
  error: string | null;
  onPromptInputChange: (value: string) => void;
  onPromptInputKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onAskChef: () => void;
  onApplySuggestions: () => void;
  heroChatFrameRef: RefObject<HTMLDivElement | null>;
  heroChatViewportRef: RefObject<HTMLDivElement | null>;
};

export function HomeHeroPanel({
  heroChatMessages,
  promptInput,
  loading,
  heroChatReadyToApply,
  error,
  onPromptInputChange,
  onPromptInputKeyDown,
  onAskChef,
  onApplySuggestions,
  heroChatFrameRef,
  heroChatViewportRef,
}: HomeHeroPanelProps) {
  const promptSuggestions = [
    "30-minute high-protein dinner",
    "Something fresh with chicken and herbs",
    "Easy comfort food for tonight",
  ];

  return (
    <section className="app-panel overflow-hidden">
      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.4fr)_300px] lg:p-8">
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="app-kicker">Start here</p>
            <h1 className="font-display text-[40px] font-semibold leading-[1.02] tracking-tight text-[color:var(--text)] sm:text-[52px]">
              What do you want to cook today?
            </h1>
            <p className="max-w-2xl text-[18px] leading-8 text-[color:var(--muted)]">
              Begin with a simple idea. Describe the dish, ingredients, or constraint, then let Chef AI help shape it into something useful.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {promptSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onPromptInputChange(suggestion)}
                className="app-chip border border-[rgba(57,75,70,0.08)] bg-[rgba(142,168,141,0.08)] text-[15px] hover:bg-[rgba(142,168,141,0.14)]"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        <aside className="rounded-[28px] border border-[rgba(57,75,70,0.08)] bg-[rgba(141,169,187,0.08)] p-5">
          <p className="app-kicker">How it works</p>
          <div className="mt-4 space-y-4 text-[15px] leading-6 text-[color:var(--muted)]">
            <div className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] text-sm font-semibold text-white">1</span>
              <p>Type a short idea or pick one of the examples.</p>
            </div>
            <div className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] text-sm font-semibold text-white">2</span>
              <p>Ask Chef for refinements, swaps, or technique help.</p>
            </div>
            <div className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] text-sm font-semibold text-white">3</span>
              <p>Apply suggestions when the direction feels right.</p>
            </div>
          </div>
        </aside>
      </div>

      <div className="border-t border-[rgba(57,75,70,0.08)] bg-[rgba(255,255,255,0.34)] p-6 lg:p-8">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="app-kicker">Chef conversation</p>
            <p className="mt-2 text-[18px] font-semibold text-[color:var(--text)]">First action: tell Chef what you want.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(82,124,116,0.16)] bg-[rgba(82,124,116,0.08)] px-3 py-1.5 text-sm font-semibold text-[color:var(--primary)]">
            <span className="h-2 w-2 rounded-full bg-[color:var(--primary)]" />
            Ready to help
          </div>
        </div>

        <div ref={heroChatFrameRef} className="rounded-[28px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,250,0.84)] p-4">
          <div
            ref={heroChatViewportRef}
            className="min-h-[220px] space-y-3 overflow-y-auto rounded-[24px] border border-[rgba(57,75,70,0.08)] bg-white p-4"
          >
            {heroChatMessages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-[14px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Example prompt</p>
                <p className="text-[18px] font-semibold text-[color:var(--text)]">“I want a quick, healthy dinner with chicken and lemon.”</p>
                <p className="max-w-2xl text-[16px] leading-7 text-[color:var(--muted)]">
                  Ask for substitutions, flavor ideas, ingredient combinations, or better technique. Nothing becomes a recipe until you apply suggestions.
                </p>
              </div>
            ) : (
              heroChatMessages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[88%] rounded-[22px] px-4 py-3 text-[15px] leading-6 ${
                      message.role === "user"
                        ? "bg-[color:var(--primary)] text-white"
                        : "border border-[rgba(57,75,70,0.08)] bg-[rgba(141,169,187,0.07)] text-[color:var(--text)]"
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row">
          <input
            value={promptInput}
            onChange={(event) => onPromptInputChange(event.target.value)}
            onKeyDown={onPromptInputKeyDown}
            placeholder="Describe the dish, ingredients, or constraint..."
            className="min-h-12 flex-1 rounded-full bg-white px-5 text-[16px]"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onAskChef}
              disabled={loading}
              className="min-w-[140px] rounded-full bg-[color:var(--primary)] px-5 py-3 text-[16px] font-semibold text-white transition hover:bg-[color:var(--primary-strong)] disabled:opacity-60"
            >
              Ask Chef
            </button>
            <button
              type="button"
              onClick={onApplySuggestions}
              disabled={loading || !heroChatReadyToApply}
              className="min-w-[180px] rounded-full border border-[rgba(57,75,70,0.12)] bg-[rgba(141,169,187,0.08)] px-5 py-3 text-[16px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(141,169,187,0.14)] disabled:opacity-60"
            >
              Apply Suggestions
            </button>
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </div>
    </section>
  );
}
