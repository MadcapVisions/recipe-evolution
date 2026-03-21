"use client";

import type { RefObject, KeyboardEvent as ReactKeyboardEvent } from "react";
import type { LockedDirectionRefinement } from "@/lib/ai/contracts/lockedDirectionSession";
import type { ChatMessage, SelectedChefDirection } from "@/components/home/types";

function compactOptionSummary(summary: string) {
  const firstSentence = summary.split(/[.!?]/)[0]?.trim() ?? summary.trim();
  return firstSentence.length > 88 ? `${firstSentence.slice(0, 85).trim()}...` : firstSentence;
}

function getStatusPresentation(input: { loading: boolean; generatingRecipe: boolean; status: string | null }) {
  const normalized = input.status?.toLowerCase() ?? "";

  if (input.generatingRecipe) {
    let stageLabel = "Building recipe";
    let waitMessage = "Chef is assembling the final recipe. Stay here while the build finishes.";

    if (normalized.includes("understanding")) {
      stageLabel = "Understanding your request";
      waitMessage = "Chef is locking the dish direction before writing the recipe.";
    } else if (normalized.includes("planning")) {
      stageLabel = "Planning the recipe";
      waitMessage = "Chef is mapping the structure, ingredients, and technique.";
    } else if (normalized.includes("writing") || normalized.includes("retrying")) {
      stageLabel = "Writing the recipe";
      waitMessage = "Chef is drafting the full recipe now.";
    } else if (normalized.includes("checking")) {
      stageLabel = "Checking the recipe";
      waitMessage = "Chef is verifying that the recipe still matches your selected direction.";
    } else if (normalized.includes("saving")) {
      stageLabel = "Saving your recipe";
      waitMessage = "Chef finished the recipe. Saving it to your cookbook now.";
    } else if (normalized.includes("tightening")) {
      stageLabel = "Tightening constraints";
      waitMessage = "Chef is correcting drift and rebuilding with stricter constraints.";
    }

    return {
      kicker: "Recipe in progress",
      stageLabel,
      waitMessage,
      toneClass: "border-[rgba(74,106,96,0.16)] bg-[rgba(247,250,248,0.96)] text-[color:var(--primary)]",
    };
  }

  if (input.loading) {
    return {
      kicker: "Chef is working",
      stageLabel: "Refining the direction",
      waitMessage: "Chef is thinking through your request. Give it a moment.",
      toneClass: "border-[rgba(181,123,77,0.14)] bg-[rgba(255,246,237,0.96)] text-[color:var(--text)]",
    };
  }

  return null;
}

type HomeHeroPanelProps = {
  heroChatMessages: ChatMessage[];
  selectedChefDirection: SelectedChefDirection | null;
  appliedRefinements: LockedDirectionRefinement[];
  promptInput: string;
  loading: boolean;
  generatingRecipe: boolean;
  heroChatReadyToApply: boolean;
  activeChatRecipeIndex: number | null;
  error: string | null;
  status: string | null;
  onPromptInputChange: (value: string) => void;
  onPromptInputKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onAskChef: () => void;
  onBuildSelectedDirection: () => void;
  onCreateRecipeFromReply: (replyIndex: number) => void;
  onSelectChefDirection: (replyIndex: number, option: { id: string; title: string; summary: string; tags: string[] }) => void;
  onClearChefDirection: () => void;
  onRemoveLastRefinement: () => void;
  onStartOver: () => void;
  heroChatFrameRef: RefObject<HTMLDivElement | null>;
  heroChatViewportRef: RefObject<HTMLDivElement | null>;
};

export function HomeHeroPanel({
  heroChatMessages,
  selectedChefDirection,
  appliedRefinements,
  promptInput,
  loading,
  generatingRecipe,
  heroChatReadyToApply,
  activeChatRecipeIndex,
  error,
  status,
  onPromptInputChange,
  onPromptInputKeyDown,
  onAskChef,
  onBuildSelectedDirection,
  onCreateRecipeFromReply,
  onSelectChefDirection,
  onClearChefDirection,
  onRemoveLastRefinement,
  onStartOver,
  heroChatFrameRef,
  heroChatViewportRef,
}: HomeHeroPanelProps) {
  const hasConversation = heroChatMessages.length > 0;
  const isRefining = selectedChefDirection != null;
  const statusPresentation = getStatusPresentation({ loading, generatingRecipe, status });
  const promptSuggestions = [
    "Bright 30-minute chicken dinner with herbs",
    "A cozy vegetarian skillet with depth",
    "Something sharp, fast, and weeknight-friendly",
  ];

  return (
    <section className="app-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className={`overflow-hidden border-b border-[rgba(57,75,70,0.08)] px-5 transition-[max-height,padding,opacity] duration-300 md:px-6 lg:px-8 ${
          hasConversation ? "max-h-0 border-b-0 py-0 opacity-0" : "max-h-[420px] py-4 opacity-100 md:max-h-[320px] md:py-5 lg:max-h-[340px] lg:py-6"
        }`}
      >
          <div className="space-y-4">
            <div className="space-y-3">
              <p className="app-kicker">Your personal Chef</p>
              <h1 className="font-display text-[28px] font-semibold leading-[0.98] tracking-tight text-[color:var(--text)] sm:text-[52px] lg:text-[60px]">
                What do you feel like cooking tonight?
              </h1>
              <p className="max-w-2xl text-[16px] leading-7 text-[color:var(--muted)] sm:text-[18px] sm:leading-8">
                Bring a craving, ingredient, or constraint. Chef helps you shape the dish before it becomes a saved recipe in your cookbook.
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

      <div className="flex min-h-0 flex-1 flex-col bg-[rgba(255,255,255,0.22)] p-4 sm:p-5 lg:p-6">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="app-kicker">Chef session</p>
            <p className="mt-2 text-[18px] font-semibold text-[color:var(--text)]">
              {isRefining ? "Refine the selected direction." : hasConversation ? "Keep shaping the dish." : "What do you want to cook?"}
            </p>
          </div>
        </div>

        {statusPresentation && !(generatingRecipe && selectedChefDirection) ? (
          <div className={`mb-4 rounded-[24px] border px-4 py-4 shadow-[0_12px_30px_rgba(57,75,70,0.08)] ${statusPresentation.toneClass}`}>
            <div className="flex items-start gap-3">
              <div className="mt-1 flex shrink-0 gap-1.5">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-current" />
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-current [animation-delay:180ms]" />
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-current [animation-delay:360ms]" />
              </div>
              <div className="min-w-0">
                <p className="app-kicker opacity-80">{statusPresentation.kicker}</p>
                <p className="mt-1 text-[18px] font-semibold md:text-[20px]">{statusPresentation.stageLabel}</p>
                <p className="mt-1 text-[14px] leading-6 opacity-90 md:text-[15px]">{statusPresentation.waitMessage}</p>
                {status ? <p className="mt-2 text-[13px] font-medium opacity-75">{status}</p> : null}
              </div>
            </div>
          </div>
        ) : null}


        <div ref={heroChatFrameRef} className="flex min-h-[280px] flex-1 rounded-[28px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,250,0.9)] p-3 sm:min-h-[360px] sm:p-4">
          <div
            ref={heroChatViewportRef}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-[24px] border border-[rgba(57,75,70,0.08)] bg-white p-4"
          >
            {heroChatMessages.length === 0 && !loading ? (
              <div className="space-y-3">
                <p className="text-[14px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Start with a prompt like this</p>
                <p className="text-[18px] font-semibold text-[color:var(--text)]">"I want a bright, quick dinner with chicken, lemon, and some crunch."</p>
                <p className="max-w-2xl text-[16px] leading-7 text-[color:var(--muted)]">
                  Ask for structure, technique, substitutions, timing, or flavor balance before you turn it into a saved recipe.
                </p>
              </div>
            ) : (
              <>
                {heroChatMessages.map((message, index) => {
                  const isLastAiMessage =
                    message.role === "ai" &&
                    heroChatMessages.slice(index + 1).every((m) => m.role !== "ai");
                  const options = message.role === "ai" ? message.options ?? [] : [];
                  const selectedFromThisMessage = selectedChefDirection?.replyIndex === index ? selectedChefDirection : null;
                  return (
                  <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[88%] ${message.role === "user" ? "" : "space-y-2"}`}>
                      <div
                        className={`rounded-[22px] px-4 py-3 text-[15px] leading-6 ${
                          message.kind === "direction_selected"
                            ? "border border-[rgba(74,106,96,0.12)] bg-[rgba(247,250,248,0.95)] text-[color:var(--text)] shadow-[inset_3px_0_0_var(--primary)]"
                            : message.role === "user"
                            ? "bg-[color:var(--primary)] text-white"
                            : "border border-[rgba(57,75,70,0.08)] bg-[rgba(250,248,242,0.94)] text-[color:var(--text)]"
                        }`}
                      >
                        {message.text}
                      </div>
                      {message.role === "ai" ? (
                        <div className="space-y-2">
                          {options.length > 0 && !selectedChefDirection && !selectedFromThisMessage ? (
                            <div className="space-y-2">
                              <div className="space-y-2 md:hidden">
                                {options.map((option) => {
                                  const recommended = message.recommendedOptionId === option.id;
                                  return (
                                    <button
                                      key={option.id}
                                      type="button"
                                      onClick={() => onSelectChefDirection(index, option)}
                                      className="w-full rounded-[18px] border border-[rgba(57,75,70,0.08)] bg-white px-3 py-3 text-left transition hover:bg-[rgba(74,106,96,0.05)]"
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-2">
                                            <p className="text-[14px] font-semibold text-[color:var(--text)]">{option.title}</p>
                                            {recommended ? (
                                              <span className="shrink-0 rounded-full bg-[rgba(74,106,96,0.1)] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[color:var(--primary)]">
                                                Best pick
                                              </span>
                                            ) : null}
                                          </div>
                                          <p className="mt-1 text-[12px] leading-5 text-[color:var(--muted)]">{compactOptionSummary(option.summary)}</p>
                                          {option.tags.length > 0 ? (
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                              {option.tags.slice(0, 2).map((tag) => (
                                                <span key={`${option.id}-${tag}`} className="rounded-full bg-[rgba(111,102,95,0.08)] px-2 py-1 text-[10px] font-medium text-[color:var(--muted)]">
                                                  {tag}
                                                </span>
                                              ))}
                                            </div>
                                          ) : null}
                                        </div>
                                        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--primary)]">
                                          Choose
                                        </span>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="hidden gap-2 md:grid md:grid-cols-2">
                              {options.map((option) => {
                                const recommended = message.recommendedOptionId === option.id;
                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => onSelectChefDirection(index, option)}
                                    className={`rounded-[20px] border px-4 py-3 text-left transition ${
                                      "border-[rgba(57,75,70,0.08)] bg-white hover:bg-[rgba(74,106,96,0.05)]"
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <p className="text-[15px] font-semibold text-[color:var(--text)]">{option.title}</p>
                                      {recommended ? (
                                        <span className="shrink-0 rounded-full bg-[rgba(74,106,96,0.1)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--primary)]">
                                          Best pick
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="mt-1 text-[13px] leading-6 text-[color:var(--muted)]">{compactOptionSummary(option.summary)}</p>
                                    {option.tags.length > 0 ? (
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {option.tags.slice(0, 3).map((tag) => (
                                          <span key={`${option.id}-${tag}`} className="rounded-full bg-[rgba(111,102,95,0.08)] px-2 py-1 text-[11px] font-medium text-[color:var(--muted)]">
                                            {tag}
                                          </span>
                                        ))}
                                      </div>
                                    ) : null}
                                    <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-[color:var(--primary)]">
                                      Choose this direction
                                    </p>
                                  </button>
                                );
                              })}
                              </div>
                            </div>
                          ) : null}
                          {!selectedChefDirection && !selectedFromThisMessage ? (
                            <button
                              type="button"
                              onClick={() => onCreateRecipeFromReply(index)}
                              disabled={loading || generatingRecipe}
                              className="rounded-full border border-[rgba(57,75,70,0.12)] bg-white px-4 py-2 text-[13px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(74,106,96,0.08)] disabled:opacity-60"
                            >
                              {generatingRecipe
                                ? "Building recipe..."
                                : options.length > 0
                                ? "Build from this reply"
                                : "Build recipe from this direction"}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )})}
                {loading ? (
                  <div className="flex justify-start">
                    <div className="rounded-[22px] border border-[rgba(181,123,77,0.14)] bg-[rgba(255,246,237,0.96)] px-4 py-3 text-[15px] font-medium text-[color:var(--text)]">
                      Chef is refining your direction. Hold on.
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        {selectedChefDirection ? (
          <div
            className={`mt-3 rounded-[20px] border px-4 py-3 transition-all duration-500 ${
              generatingRecipe
                ? "border-[rgba(74,106,96,0.35)] bg-[rgba(247,250,248,0.98)] shadow-[inset_3px_0_0_var(--primary),0_0_0_3px_rgba(74,106,96,0.12),0_0_20px_rgba(74,106,96,0.18)] animate-pulse-border"
                : "border-[rgba(74,106,96,0.18)] bg-[rgba(247,250,248,0.95)] shadow-[inset_3px_0_0_var(--primary)]"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="app-kicker text-[color:var(--primary)]">Current direction</p>
                <p className="mt-1 truncate text-[15px] font-semibold text-[color:var(--text)]">{selectedChefDirection.title}</p>
                {generatingRecipe ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[color:var(--primary)]" />
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[color:var(--primary)] [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[color:var(--primary)] [animation-delay:300ms]" />
                    <p className="text-[12px] font-medium text-[color:var(--primary)]">
                      {status ?? "Building recipe…"}
                    </p>
                  </div>
                ) : appliedRefinements.length > 0 ? (
                  <p className="mt-0.5 text-[12px] text-[color:var(--muted)]">
                    {(() => {
                      const last = appliedRefinements[appliedRefinements.length - 1].user_text;
                      return last.length > 48 ? `${last.slice(0, 45).trim()}…` : last;
                    })()}
                    {appliedRefinements.length > 1 ? ` (+${appliedRefinements.length - 1} more)` : ""}
                  </p>
                ) : (
                  <p className="mt-0.5 text-[12px] text-[color:var(--muted)]">Base direction locked</p>
                )}
              </div>
              {!generatingRecipe ? (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={onClearChefDirection}
                    disabled={loading}
                    className="rounded-full border border-[rgba(57,75,70,0.12)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(74,106,96,0.08)] disabled:opacity-50"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={onBuildSelectedDirection}
                    disabled={loading}
                    className="rounded-full bg-[color:var(--primary)] px-4 py-1.5 text-[13px] font-semibold text-white transition hover:bg-[color:var(--primary-strong)] disabled:opacity-60"
                  >
                    Build recipe
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex flex-col gap-3">
          <input
            value={promptInput}
            onChange={(event) => onPromptInputChange(event.target.value)}
            onKeyDown={onPromptInputKeyDown}
            placeholder={
              isRefining
                ? "Refine this direction: flavor, texture, timing, substitutions..."
                : "What do you feel like cooking? Describe a dish, ingredient, or constraint..."
            }
            className="min-h-14 flex-1 rounded-full bg-white px-5 py-3 text-[18px]"
          />
          <button
            type="button"
            onClick={onAskChef}
            disabled={loading || generatingRecipe}
            className="w-full rounded-full bg-[color:var(--primary)] px-5 py-3.5 text-[16px] font-semibold text-white transition hover:bg-[color:var(--primary-strong)] disabled:opacity-60"
          >
            {loading ? "Chef is thinking..." : generatingRecipe ? "Building your dish..." : "Ask Chef"}
          </button>
        </div>

        {loading ? (
          <div className="mt-3 rounded-[20px] border border-[rgba(57,75,70,0.1)] bg-[rgba(255,255,255,0.82)] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[color:var(--primary)]" />
              <p className="text-sm font-semibold text-[color:var(--text)]">Chef is working on your request.</p>
            </div>
            <p className="mt-1 text-sm text-[color:var(--muted)]">Wait for Chef to finish refining before sending another message.</p>
          </div>
        ) : null}
        {!heroChatReadyToApply && !hasConversation && !error && !loading ? (
          <p className="mt-3 text-sm text-[color:var(--muted)]">Talk to Chef first, then build the recipe when the direction feels right.</p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {!error && status && !loading && !generatingRecipe ? <p className="mt-3 text-sm text-[color:var(--muted)]">{status}</p> : null}

        {hasConversation ? (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onStartOver}
              className="text-sm text-[color:var(--muted)] underline underline-offset-2 hover:text-[color:var(--text)] transition"
            >
              Start over
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
