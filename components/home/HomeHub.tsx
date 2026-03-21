"use client";

import { useEffect, useState } from "react";
import { HomeHeroPanel } from "@/components/home/HomeHeroPanel";
import { useHomeHubAi, type BuildDebugEntry } from "@/components/home/useHomeHubAi";
import type { HomeHubProps } from "@/components/home/types";
import { publishAiStatus } from "@/lib/ui/aiStatusBus";

function BuildDebugPanel({ log }: { log: BuildDebugEntry[] }) {
  const [open, setOpen] = useState(true);
  if (log.length === 0) return null;
  return (
    <div className="mt-4 rounded-xl border border-amber-400/40 bg-neutral-950 text-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left font-mono text-amber-300 hover:bg-white/5"
      >
        <span className="text-amber-500">⚠</span>
        <span className="font-semibold uppercase tracking-widest">AI Debug Log</span>
        <span className="ml-auto text-neutral-500">{open ? "▲ hide" : "▼ show"}</span>
      </button>
      {open && (
        <div className="max-h-80 overflow-y-auto px-4 pb-4 font-mono">
          {log.map((entry, i) => {
            const time = new Date(entry.ts).toISOString().slice(11, 23);
            if (entry.type === "status") {
              return (
                <div key={i} className="mt-1 text-neutral-400">
                  <span className="text-neutral-600">{time}</span>{" "}
                  <span className="text-sky-400">STATUS</span>{" "}
                  {entry.message}
                </div>
              );
            }
            if (entry.type === "result") {
              return (
                <div key={i} className="mt-1 text-neutral-400">
                  <span className="text-neutral-600">{time}</span>{" "}
                  <span className="text-emerald-400">RESULT</span>{" "}
                  {entry.title}
                </div>
              );
            }
            return (
              <div key={i} className="mt-2 rounded border border-red-900/60 bg-red-950/40 p-2 text-red-300">
                <div>
                  <span className="text-neutral-600">{time}</span>{" "}
                  <span className="text-red-400 font-semibold">ERROR</span>{" "}
                  {entry.message}
                </div>
                {entry.failure_kind && (
                  <div className="mt-0.5 text-neutral-500">kind: <span className="text-red-400">{entry.failure_kind}</span></div>
                )}
                {entry.retry_strategy && (
                  <div className="text-neutral-500">strategy: <span className="text-amber-400">{entry.retry_strategy}</span></div>
                )}
                {entry.reasons && entry.reasons.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {entry.reasons.map((r, j) => (
                      <li key={j} className="text-neutral-400">— {r}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function HomeHub({ recentRecipes, userTasteProfile }: HomeHubProps) {
  const {
    promptInput,
    setPromptInput,
    loading,
    generatingRecipe,
    error,
    status,
    buildDebugLog,
    heroChatMessages,
    selectedChefDirection,
    appliedRefinements,
    heroChatReadyToApply,
    activeChatRecipeIndex,
    heroChatFrameRef,
    heroChatViewportRef,
    handleHeroInputKeyDown,
    handleAskChefInHero,
    handleCreateRecipeFromReply,
    handleSelectChefDirection,
    handleClearChefDirection,
    handleRemoveLastRefinement,
    handleBuildSelectedDirection,
    handleStartOver,
  } = useHomeHubAi(userTasteProfile);

  useEffect(() => {
    if (!status) {
      publishAiStatus({ message: null });
      return;
    }

    const lower = status.toLowerCase();
    const tone =
      loading || generatingRecipe
        ? "loading"
        : lower.includes("fallback") || lower.includes("unavailable") || lower.includes("rate-limited")
        ? "fallback"
        : "success";

    let message = status;
    if (loading || generatingRecipe) {
      if (generatingRecipe || lower.includes("full recipe") || lower.includes("building")) {
        message = "Building dish...";
      } else {
        message = "Chef is refining...";
      }
    } else if (lower.includes("choose a direction") || lower.includes("select a direction")) {
      message = "Directions ready";
    } else if (lower.includes("fallback")) {
      message = lower.includes("rate-limited") ? "Using backup kitchen engine" : "Chef temporarily unavailable";
    } else if (lower.includes("chef responded") || lower.includes("ready to apply")) {
      message = "Directions ready";
    }

    publishAiStatus({ message, tone });

    return () => {
      publishAiStatus({ message: null });
    };
  }, [status, loading, generatingRecipe]);

  return (
    <div className="mx-auto flex min-h-[calc(100svh-8rem)] w-full max-w-[1380px] flex-col space-y-6">
      {/* Main content — full width */}
      <div className="flex min-h-0 flex-1 flex-col">
        <HomeHeroPanel
          heroChatMessages={heroChatMessages}
          selectedChefDirection={selectedChefDirection}
          appliedRefinements={appliedRefinements}
          promptInput={promptInput}
          loading={loading}
          generatingRecipe={generatingRecipe}
          heroChatReadyToApply={heroChatReadyToApply}
          activeChatRecipeIndex={activeChatRecipeIndex}
          error={error}
          status={status}
          onPromptInputChange={setPromptInput}
          onPromptInputKeyDown={handleHeroInputKeyDown}
          onAskChef={() => void handleAskChefInHero()}
          onBuildSelectedDirection={() => void handleBuildSelectedDirection()}
          onCreateRecipeFromReply={(replyIndex) => void handleCreateRecipeFromReply(replyIndex)}
          onSelectChefDirection={handleSelectChefDirection}
          onClearChefDirection={handleClearChefDirection}
          onRemoveLastRefinement={handleRemoveLastRefinement}
          onStartOver={handleStartOver}
          heroChatFrameRef={heroChatFrameRef}
          heroChatViewportRef={heroChatViewportRef}
        />
        <BuildDebugPanel log={buildDebugLog} />
      </div>
    </div>
  );
}
