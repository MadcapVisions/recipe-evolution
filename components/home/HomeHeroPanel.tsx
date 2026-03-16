"use client";

import type { RefObject, KeyboardEvent as ReactKeyboardEvent } from "react";
import type { ChatMessage } from "@/components/home/types";

type HomeHeroPanelProps = {
  heroChatMessages: ChatMessage[];
  promptInput: string;
  loading: boolean;
  heroChatReadyToApply: boolean;
  activeChatRecipeIndex: number | null;
  error: string | null;
  onPromptInputChange: (value: string) => void;
  onPromptInputKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onAskChef: () => void;
  onApplySuggestions: () => void;
  onCreateRecipeFromReply: (replyIndex: number) => void;
  heroChatFrameRef: RefObject<HTMLDivElement | null>;
  heroChatViewportRef: RefObject<HTMLDivElement | null>;
};

export function HomeHeroPanel({
  heroChatMessages,
  promptInput,
  loading,
  heroChatReadyToApply,
  activeChatRecipeIndex,
  error,
  onPromptInputChange,
  onPromptInputKeyDown,
  onAskChef,
  onApplySuggestions,
  onCreateRecipeFromReply,
  heroChatFrameRef,
  heroChatViewportRef,
}: HomeHeroPanelProps) {
  const hasConversation = heroChatMessages.length > 0;
  const promptSuggestions = [
    "Bright 30-minute chicken dinner with herbs",
    "A cozy vegetarian skillet with depth",
    "Something sharp, fast, and weeknight-friendly",
  ];

  return (
    <section className="app-panel flex h-full min-h-0 flex-col overflow-hidden">
      <div
        className={`hidden overflow-hidden border-b border-[rgba(57,75,70,0.08)] px-5 transition-[max-height,padding,opacity] duration-300 md:block md:px-6 lg:px-8 ${
          hasConversation ? "md:max-h-0 md:border-b-0 md:py-0 md:opacity-0" : "md:max-h-[340px] md:py-6 md:opacity-100 lg:max-h-[360px] lg:py-8"
        }`}
      >
          <div className="space-y-4">
            <div className="space-y-3">
              <p className="app-kicker">Develop a dish</p>
              <h1 className="font-display text-[28px] font-semibold leading-[0.98] tracking-tight text-[color:var(--text)] sm:text-[46px] lg:text-[52px]">
                Start with a direction. Save the version worth keeping.
              </h1>
              <p className="max-w-2xl text-[16px] leading-7 text-[color:var(--muted)] sm:text-[18px] sm:leading-8">
                Bring a craving, ingredient, or constraint. Chef helps you sharpen the dish before it becomes part of your cookbook.
              </p>
            </div>

          <div className="flex flex-wrap gap-2">
            {promptSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onPromptInputChange(suggestion)}
                className="rounded-full border border-[rgba(57,75,70,0.08)] bg-[rgba(255,255,255,0.82)] px-4 py-2 text-[13px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(142,168,141,0.1)]"
              >
                {suggestion}
              </button>
            ))}
          </div>
          <div className="rounded-[24px] border border-[rgba(181,123,77,0.1)] bg-[rgba(255,246,237,0.92)] p-4">
            <p className="text-[15px] font-semibold text-[color:var(--text)]">Best first move</p>
            <p className="mt-2 text-[15px] leading-7 text-[color:var(--muted)]">
              Explore one strong direction first. Build the recipe only when the flavor, fit, and effort level feel right.
            </p>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col bg-[rgba(255,255,255,0.22)] p-5 sm:p-6 lg:p-8">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="app-kicker">Chef session</p>
            <p className="mt-2 text-[18px] font-semibold text-[color:var(--text)]">
              {hasConversation ? "Keep shaping the dish." : "Give Chef a starting point."}
            </p>
          </div>
        </div>

        <div ref={heroChatFrameRef} className="flex min-h-[300px] flex-1 rounded-[28px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,250,0.9)] p-3 sm:min-h-[420px] sm:p-4 lg:min-h-[480px]">
          <div
            ref={heroChatViewportRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-[24px] border border-[rgba(57,75,70,0.08)] bg-white p-4"
          >
            {heroChatMessages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-[14px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Start with a prompt like this</p>
                <p className="text-[18px] font-semibold text-[color:var(--text)]">“I want a bright, quick dinner with chicken, lemon, and some crunch.”</p>
                <p className="max-w-2xl text-[16px] leading-7 text-[color:var(--muted)]">
                  Ask for structure, technique, substitutions, or flavor balance before you turn it into a saved recipe.
                </p>
              </div>
            ) : (
              heroChatMessages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] ${message.role === "user" ? "" : "space-y-2"}`}>
                    <div
                      className={`rounded-[22px] px-4 py-3 text-[15px] leading-6 ${
                        message.role === "user"
                          ? "bg-[color:var(--primary)] text-white"
                          : "border border-[rgba(57,75,70,0.08)] bg-[rgba(250,248,242,0.94)] text-[color:var(--text)]"
                      }`}
                    >
                      {message.text}
                    </div>
                    {message.role === "ai" ? (
                      <button
                        type="button"
                        onClick={() => onCreateRecipeFromReply(index)}
                        disabled={loading}
                        className="rounded-full border border-[rgba(57,75,70,0.12)] bg-white px-4 py-2 text-[13px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(74,106,96,0.08)] disabled:opacity-60"
                      >
                        {activeChatRecipeIndex === index && loading ? "Building recipe..." : "Build recipe from this direction"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <input
            value={promptInput}
            onChange={(event) => onPromptInputChange(event.target.value)}
            onKeyDown={onPromptInputKeyDown}
            placeholder="Describe the dish, ingredient set, or constraint..."
            className="min-h-12 flex-1 rounded-full bg-white px-5 text-[16px]"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onAskChef}
              disabled={loading}
              className="w-full rounded-full bg-[color:var(--primary)] px-5 py-3 text-[16px] font-semibold text-white transition hover:bg-[color:var(--primary-strong)] disabled:opacity-60"
            >
              Explore with Chef
            </button>
            <button
              type="button"
              onClick={onApplySuggestions}
              disabled={loading || !heroChatReadyToApply}
              className="w-full rounded-full border border-[rgba(57,75,70,0.12)] bg-[rgba(255,252,246,0.94)] px-5 py-3 text-[16px] font-semibold text-[color:var(--text)] transition hover:bg-white disabled:opacity-60"
            >
              Build Recipe
            </button>
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </div>
    </section>
  );
}
