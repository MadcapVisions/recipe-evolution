"use client";

import type { RefObject, KeyboardEvent as ReactKeyboardEvent } from "react";
import type { LockedDirectionRefinement } from "@/lib/ai/contracts/lockedDirectionSession";
import type { ChatMessage, SelectedChefDirection } from "@/components/home/types";
import type { BuildFailureState, LaunchDecision, SuggestedAction } from "@/components/home/useHomeHubAi";

function distillRefinementLabels(refinements: LockedDirectionRefinement[]): string | null {
  const added: string[] = [];
  const removed: string[] = [];
  const seen = new Set<string>();

  for (const r of refinements) {
    const changes = r.extracted_changes;
    for (const item of [...(changes.required_ingredients ?? []), ...(changes.preferred_ingredients ?? [])]) {
      const key = `+${item.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        added.push(item);
      }
    }
    for (const item of changes.forbidden_ingredients ?? []) {
      const key = `-${item.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        removed.push(item);
      }
    }
    // Style tags are excluded — they're extracted from combined user+assistant text
    // and often reflect the chef's own language, not explicit user requests.
  }

  const parts = [
    ...added.map((item) => `+ ${item}`),
    ...removed.map((item) => `- ${item}`),
  ];

  if (parts.length === 0) {
    return null;
  }

  const label = parts.slice(0, 4).join(", ");
  return parts.length > 4 ? `${label} (+${parts.length - 4} more)` : label;
}

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
    } else if (normalized.includes("writing")) {
      stageLabel = "Writing the recipe";
      waitMessage = "Chef is drafting the full recipe now.";
    } else if (normalized.includes("retrying")) {
      stageLabel = "Retrying";
      waitMessage = "Chef is making another attempt at the recipe.";
    } else if (normalized.includes("trying a different")) {
      stageLabel = "Trying a different approach";
      waitMessage = "Chef is switching strategies to get you a better result.";
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

// ── Graceful failure card (rendered when graceful mode is enabled) ──────────

const MODE_STYLES: Record<string, { border: string; bg: string; kicker: string }> = {
  MISSING_REQUIRED_INGREDIENT: {
    border: "border-[rgba(181,123,77,0.2)]",
    bg: "bg-[rgba(255,246,237,0.95)]",
    kicker: "text-[color:var(--amber)]",
  },
  CLARIFY_INTENT: {
    border: "border-[rgba(181,123,77,0.2)]",
    bg: "bg-[rgba(255,246,237,0.95)]",
    kicker: "text-[color:var(--amber)]",
  },
  CONSTRAINT_CONFLICT: {
    border: "border-[rgba(57,75,70,0.1)]",
    bg: "bg-[rgba(255,255,255,0.9)]",
    kicker: "text-[color:var(--muted)]",
  },
  GENERATION_RECOVERY: {
    border: "border-[rgba(57,75,70,0.1)]",
    bg: "bg-[rgba(255,255,255,0.9)]",
    kicker: "text-[color:var(--muted)]",
  },
  HARD_FAIL: {
    border: "border-[rgba(57,75,70,0.1)]",
    bg: "bg-[rgba(255,255,255,0.9)]",
    kicker: "text-[color:var(--muted)]",
  },
  SHOW_RECIPE_WITH_WARNING: {
    border: "border-[rgba(181,123,77,0.12)]",
    bg: "bg-[rgba(255,252,243,0.95)]",
    kicker: "text-[color:var(--amber)]",
  },
};

const MODE_TITLES: Record<string, string> = {
  MISSING_REQUIRED_INGREDIENT: "Chef couldn\u2019t include that ingredient",
  CLARIFY_INTENT: "Chef needs a bit more direction",
  CONSTRAINT_CONFLICT: "Those constraints are hard to reconcile",
  GENERATION_RECOVERY: "Chef had trouble building that recipe",
  HARD_FAIL: "Chef couldn\u2019t build that reliably",
  SHOW_RECIPE_WITH_WARNING: "Recipe built with extra effort",
};

function GracefulFailureCard({
  launchDecision,
  loading,
  generatingRecipe,
  onAction,
  onClarify,
  onClear,
}: {
  launchDecision: LaunchDecision;
  loading: boolean;
  generatingRecipe: boolean;
  onAction: (action: SuggestedAction) => void;
  onClarify: (option: string) => void;
  onClear: () => void;
}) {
  const style = MODE_STYLES[launchDecision.mode] ?? MODE_STYLES.HARD_FAIL!;
  const title = MODE_TITLES[launchDecision.mode] ?? "Chef ran into a problem";

  const showClarifyOptions = launchDecision.mode === "CLARIFY_INTENT";
  const showClearOption = launchDecision.mode === "CONSTRAINT_CONFLICT";

  return (
    <div className={`mt-3 rounded-[20px] border ${style.border} ${style.bg} px-4 py-4`}>
      <p className={`app-kicker ${style.kicker}`}>{launchDecision.warningLabel ?? "Build issue"}</p>
      <p className="mt-1 text-[15px] font-semibold text-[color:var(--text)]">{title}</p>
      <p className="mt-1 text-[13px] leading-5 text-[color:var(--muted)]">{launchDecision.primaryMessage}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {launchDecision.suggestedActions.map((action, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onAction(action)}
            disabled={loading || generatingRecipe}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold transition disabled:opacity-60 ${
              i === 0
                ? "bg-[color:var(--primary)] text-white hover:bg-[color:var(--primary-strong)]"
                : "border border-[rgba(57,75,70,0.12)] bg-white text-[color:var(--text)] hover:bg-[rgba(74,106,96,0.08)]"
            }`}
          >
            {action.label}
          </button>
        ))}
        {showClarifyOptions
          ? ["Quick & easy", "Comfort food", "Something simple"].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onClarify(opt)}
                disabled={loading || generatingRecipe}
                className="rounded-full border border-[rgba(57,75,70,0.12)] bg-white px-4 py-2 text-[13px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(74,106,96,0.08)] disabled:opacity-50"
              >
                {opt}
              </button>
            ))
          : null}
        {showClearOption ? (
          <button
            type="button"
            onClick={onClear}
            disabled={loading || generatingRecipe}
            className="rounded-full border border-[rgba(57,75,70,0.12)] bg-white px-4 py-2 text-[13px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(74,106,96,0.08)] disabled:opacity-50"
          >
            Change direction
          </button>
        ) : null}
      </div>
    </div>
  );
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
  buildFailureState: BuildFailureState | null;
  launchDecision?: LaunchDecision | null;
  gracefulMode?: boolean;
  isBuildLong: boolean;
  onPromptInputChange: (value: string) => void;
  onPromptInputKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onAskChef: () => void;
  onBuildSelectedDirection: () => void;
  onCreateRecipeFromReply: (replyIndex: number) => void;
  onSelectChefDirection: (replyIndex: number, option: { id: string; title: string; summary: string; tags: string[] }) => void;
  onClearChefDirection: () => void;
  onRemoveLastRefinement: () => void;
  onRetryBuild: () => void;
  onRetryWithAction?: (action: SuggestedAction) => void;
  onClarificationQuickSelect: (option: string) => void;
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
  activeChatRecipeIndex: _activeChatRecipeIndex,
  error,
  status,
  buildFailureState,
  launchDecision,
  gracefulMode,
  isBuildLong,
  onPromptInputChange,
  onPromptInputKeyDown,
  onAskChef,
  onBuildSelectedDirection,
  onCreateRecipeFromReply,
  onSelectChefDirection,
  onClearChefDirection,
  onRemoveLastRefinement: _onRemoveLastRefinement,
  onRetryBuild,
  onRetryWithAction,
  onClarificationQuickSelect,
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
              <h1 className="font-display text-[24px] font-semibold leading-[0.98] tracking-tight text-[color:var(--text)] min-[480px]:text-[36px] sm:text-[52px] lg:text-[60px]">
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
            <p className="mt-2 text-[16px] font-semibold text-[color:var(--text)] sm:text-[18px]">
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
                <p className="mt-1 text-[15px] font-semibold sm:text-[18px] md:text-[20px]">{statusPresentation.stageLabel}</p>
                <p className="mt-1 text-[13px] leading-6 opacity-90 sm:text-[14px] md:text-[15px]">{statusPresentation.waitMessage}</p>
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
                <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Start with a prompt like this</p>
                <p className="text-[15px] font-semibold text-[color:var(--text)] sm:text-[18px]">&ldquo;I want a bright, quick dinner with chicken, lemon, and some crunch.&rdquo;</p>
                <p className="max-w-2xl text-[14px] leading-6 text-[color:var(--muted)] sm:text-[16px] sm:leading-7">
                  Ask for structure, technique, substitutions, timing, or flavor balance before you turn it into a saved recipe.
                </p>
              </div>
            ) : (
              <>
                {heroChatMessages.map((message, index) => {
                  const _isLastAiMessage =
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
                          {!selectedChefDirection && !selectedFromThisMessage && options.length === 0 ? (
                            <button
                              type="button"
                              onClick={() => onCreateRecipeFromReply(index)}
                              disabled={loading || generatingRecipe}
                              className="rounded-full border border-[rgba(57,75,70,0.12)] bg-white px-4 py-2 text-[13px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(74,106,96,0.08)] disabled:opacity-60"
                            >
                              {generatingRecipe ? "Building recipe..." : "Build recipe from this direction"}
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
            <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
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
                      const distilled = distillRefinementLabels(appliedRefinements);
                      if (distilled) return distilled;
                      return "Base direction locked";
                    })()}
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
            className="min-h-14 flex-1 rounded-full bg-white px-5 py-3 text-[16px] sm:text-[18px]"
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
        {!heroChatReadyToApply && !hasConversation && !error && !buildFailureState && !loading ? (
          <p className="mt-3 text-sm text-[color:var(--muted)]">Talk to Chef first, then build the recipe when the direction feels right.</p>
        ) : null}

        {/* ── Build failure UX ─────────────────────────────────────────── */}
        {gracefulMode && launchDecision && !generatingRecipe && (launchDecision.mode !== "SHOW_RECIPE") ? (
          <GracefulFailureCard
            launchDecision={launchDecision}
            loading={loading}
            generatingRecipe={generatingRecipe}
            onAction={(action) => onRetryWithAction?.(action)}
            onClarify={onClarificationQuickSelect}
            onClear={onClearChefDirection}
          />
        ) : buildFailureState?.kind === "clarification_needed" ? (
          <div className="mt-3 rounded-[20px] border border-[rgba(181,123,77,0.2)] bg-[rgba(255,246,237,0.95)] px-4 py-4">
            <p className="text-[15px] font-semibold text-[color:var(--text)]">What kind of meal are you in the mood for?</p>
            <p className="mt-1 text-[13px] leading-5 text-[color:var(--muted)]">Give me a bit more direction and I&rsquo;ll build something for you.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Quick & easy", "Healthy", "Comfort food", "Something impressive"].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onClarificationQuickSelect(opt)}
                  className="rounded-full border border-[rgba(181,123,77,0.2)] bg-white px-4 py-2 text-[13px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(181,123,77,0.08)]"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ) : buildFailureState?.kind === "infeasible" ? (
          <div className="mt-3 rounded-[20px] border border-[rgba(57,75,70,0.1)] bg-[rgba(255,255,255,0.9)] px-4 py-4">
            <p className="text-[15px] font-semibold text-[color:var(--text)]">That combination is hard to make work</p>
            <p className="mt-1 text-[13px] leading-5 text-[color:var(--muted)]">
              {buildFailureState.reasons[0] ?? "Those constraints don\u2019t leave enough flexibility for a reliable result."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void onRetryBuild()}
                disabled={loading || generatingRecipe}
                className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[color:var(--primary-strong)] disabled:opacity-60"
              >
                Adjust it for me
              </button>
              <button
                type="button"
                onClick={onClearChefDirection}
                disabled={loading || generatingRecipe}
                className="rounded-full border border-[rgba(57,75,70,0.12)] bg-white px-4 py-2 text-[13px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(74,106,96,0.08)] disabled:opacity-50"
              >
                Show me a close alternative
              </button>
            </div>
          </div>
        ) : buildFailureState?.kind === "hard_failure" ? (
          <div className="mt-3 rounded-[20px] border border-[rgba(57,75,70,0.1)] bg-[rgba(255,255,255,0.9)] px-4 py-4">
            <p className="text-[15px] font-semibold text-[color:var(--text)]">I couldn&rsquo;t build that recipe reliably</p>
            <p className="mt-1 text-[13px] leading-5 text-[color:var(--muted)]">Let&rsquo;s try a simpler version or a different approach.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void onRetryBuild()}
                disabled={loading || generatingRecipe}
                className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[color:var(--primary-strong)] disabled:opacity-60"
              >
                Try again
              </button>
              {["Quick meal", "Healthy option", "Comfort dish"].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onClarificationQuickSelect(opt)}
                  className="rounded-full border border-[rgba(57,75,70,0.12)] bg-white px-4 py-2 text-[13px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(74,106,96,0.08)]"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ) : error ? (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        ) : null}

        {/* ── Latency guardrail ─────────────────────────────────────────── */}
        {generatingRecipe && isBuildLong ? (
          <div className="mt-3 rounded-[20px] border border-[rgba(57,75,70,0.06)] bg-[rgba(255,255,255,0.7)] px-4 py-3">
            <p className="text-[13px] text-[color:var(--muted)]">This is taking a bit longer than usual. Chef is still working — hang tight.</p>
          </div>
        ) : null}

        {!buildFailureState && !error && status && !loading && !generatingRecipe ? (
          <p className="mt-3 text-sm text-[color:var(--muted)]">{status}</p>
        ) : null}

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
