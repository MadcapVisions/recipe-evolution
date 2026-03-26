"use client";

import { useEffect, useState } from "react";
import { HomeHeroPanel } from "@/components/home/HomeHeroPanel";
import { TasteSummaryPanel } from "@/components/home/TasteSummaryPanel";
import { useHomeHubAi, type BuildDebugEntry, type BuildFailureState } from "@/components/home/useHomeHubAi";

import type { HomeHubProps } from "@/components/home/types";
import { publishAiStatus } from "@/lib/ui/aiStatusBus";

const CHECK_LABELS: Record<string, string> = {
  dish_family_match: "dish family",
  centerpiece_match: "centerpiece",
  required_ingredients_present: "required ingredients",
  forbidden_ingredients_avoided: "no forbidden",
  style_match: "style",
  title_quality_pass: "title",
  recipe_completeness_pass: "complete",
};

function DebugChecks({ checks }: { checks: Record<string, unknown> }) {
  const entries = Object.entries(checks);
  if (entries.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
      {entries.map(([key, val]) => (
        <span key={key} className={val ? "text-emerald-400" : "text-red-400"}>
          {val ? "✓" : "✗"} {CHECK_LABELS[key] ?? key}
        </span>
      ))}
    </div>
  );
}

function DebugBriefEntry({ data, time }: { data: Record<string, unknown>; time: string }) {
  return (
    <div className="mt-2 rounded border border-violet-900/50 bg-violet-950/20 p-2">
      <div className="mb-1 text-violet-400 font-semibold">BRIEF</div>
      <div className="space-y-0.5 text-neutral-400">
        {data.normalized_name != null && (
          <div><span className="text-neutral-600">name:</span> <span className="text-violet-300">{String(data.normalized_name)}</span></div>
        )}
        {data.dish_family != null && (
          <div><span className="text-neutral-600">family:</span> <span className="text-violet-300">{String(data.dish_family)}</span></div>
        )}
        {data.centerpiece != null && (
          <div><span className="text-neutral-600">centerpiece:</span> <span className="text-violet-300">{String(data.centerpiece)}</span></div>
        )}
        {Array.isArray(data.required) && data.required.length > 0 && (
          <div><span className="text-neutral-600">required:</span> {(data.required as string[]).join(", ")}</div>
        )}
        {Array.isArray(data.forbidden) && data.forbidden.length > 0 && (
          <div><span className="text-neutral-600">forbidden:</span> <span className="text-red-400">{(data.forbidden as string[]).join(", ")}</span></div>
        )}
        {Array.isArray(data.style_tags) && data.style_tags.length > 0 && (
          <div><span className="text-neutral-600">style:</span> {(data.style_tags as string[]).join(", ")}</div>
        )}
        <div className="text-neutral-600">{time} confidence: {typeof data.confidence === "number" ? data.confidence.toFixed(2) : "—"}</div>
      </div>
    </div>
  );
}

function DebugAttemptEntry({ data, time, terminal }: { data: Record<string, unknown>; time: string; terminal?: boolean }) {
  const checks = data.checks && typeof data.checks === "object" ? data.checks as Record<string, unknown> : null;
  const reasons = Array.isArray(data.reasons) ? data.reasons as string[] : [];
  const model = typeof data.model === "string" ? data.model : null;
  const borderColor = terminal ? "border-orange-900/60 bg-orange-950/20" : "border-yellow-900/50 bg-yellow-950/10";
  const labelColor = terminal ? "text-orange-400" : "text-yellow-400";
  return (
    <div className={`mt-2 rounded border ${borderColor} p-2`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className={`font-semibold ${labelColor}`}>
          {terminal ? "TERMINAL FAILURE" : `ATTEMPT ${String(data.attempt ?? "?")} FAILED`}
        </span>
        <span className="text-neutral-600">{time}</span>
        {data.kind != null && <span className="text-neutral-500">kind: <span className="text-amber-400">{String(data.kind)}</span></span>}
        {data.strategy != null && <span className="text-neutral-500">→ <span className="text-sky-400">{String(data.strategy)}</span></span>}
      </div>
      {model && (
        <div className="mt-1 text-neutral-500">
          model: <span className="text-fuchsia-400">{model}</span>
        </div>
      )}
      {checks && <DebugChecks checks={checks} />}
      {reasons.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {reasons.map((r, j) => (
            <li key={j} className="text-neutral-400 break-all">— {r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
        <div className="max-h-[32rem] overflow-y-auto px-4 pb-4 font-mono">
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
            if (entry.type === "debug") {
              if (entry.label === "brief") {
                return <DebugBriefEntry key={i} data={entry.data} time={time} />;
              }
              if (entry.label === "attempt_failed") {
                return <DebugAttemptEntry key={i} data={entry.data} time={time} />;
              }
              if (entry.label === "terminal_failure") {
                return <DebugAttemptEntry key={i} data={entry.data} time={time} terminal />;
              }
              return null;
            }
            if (entry.type === "result") {
              return (
                <div key={i} className="mt-1 text-emerald-400">
                  <span className="text-neutral-600">{time}</span>{" "}
                  <span className="font-semibold">RESULT</span>{" "}
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
                {entry.model && (
                  <div className="text-neutral-500">model: <span className="text-fuchsia-400">{entry.model}</span></div>
                )}
                {entry.reasons && entry.reasons.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {entry.reasons.map((r, j) => (
                      <li key={j} className="text-neutral-400 break-all">— {r}</li>
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

export function HomeHub({ recentRecipes: _recentRecipes, userTasteProfile, gracefulModeEnabled = false }: HomeHubProps) {
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
    buildFailureState,
    launchDecision,
    isBuildLong,
    handleRetryBuild,
    handleRetryWithAction,
    handleClarificationQuickSelect,
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
          buildFailureState={buildFailureState}
          launchDecision={launchDecision}
          gracefulMode={gracefulModeEnabled}
          isBuildLong={isBuildLong}
          onRetryBuild={() => void handleRetryBuild()}
          onRetryWithAction={(action) => void handleRetryWithAction(action)}
          onClarificationQuickSelect={handleClarificationQuickSelect}
        />
        {!gracefulModeEnabled ? <BuildDebugPanel log={buildDebugLog} /> : null}
      </div>
      <TasteSummaryPanel
        profile={userTasteProfile}
        onPromptSelect={(text) => {
          setPromptInput(text);
        }}
      />
    </div>
  );
}
