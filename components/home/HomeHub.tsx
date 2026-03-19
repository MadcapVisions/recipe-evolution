"use client";

import { useEffect } from "react";
import { HomeHeroPanel } from "@/components/home/HomeHeroPanel";
import { useHomeHubAi } from "@/components/home/useHomeHubAi";
import type { HomeHubProps } from "@/components/home/types";
import { ShellContextPanel } from "@/components/shell/ShellContextPanel";
import { publishAiStatus } from "@/lib/ui/aiStatusBus";

export function HomeHub({ recentRecipes, userTasteProfile }: HomeHubProps) {
  const {
    promptInput,
    setPromptInput,
    loading,
    generatingRecipe,
    error,
    status,
    heroChatMessages,
    selectedChefDirection,
    heroChatReadyToApply,
    activeChatRecipeIndex,
    heroChatFrameRef,
    heroChatViewportRef,
    handleHeroInputKeyDown,
    handleAskChefInHero,
    handleCreateRecipeFromReply,
    handleSelectChefDirection,
    handleClearChefDirection,
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
      {/* Mobile shell panel — right = recents */}
      <ShellContextPanel
        side="right"
        label="Recents"
        title="Recent dishes"
        description="Jump back into a recipe you already built."
      >
        <div className="space-y-2">
          {recentRecipes.length > 0 ? (
            recentRecipes.slice(0, 8).map((recipe) => (
              <a
                key={recipe.id}
                href={`/recipes/${recipe.id}`}
                className="block rounded-[20px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.92)] px-4 py-3 transition hover:bg-white"
              >
                <p className="text-[15px] font-semibold leading-6 text-[color:var(--text)]">{recipe.title}</p>
                <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                  {recipe.version_count} version{recipe.version_count === 1 ? "" : "s"} · {recipe.updated_at ? new Date(recipe.updated_at).toLocaleDateString() : "—"}
                </p>
              </a>
            ))
          ) : (
            <div className="rounded-[20px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.92)] px-4 py-4 text-sm text-[color:var(--muted)]">
              No saved dishes yet. Start with Chef to create your first one.
            </div>
          )}
        </div>
      </ShellContextPanel>

      {/* Main content — full width */}
      <div className="flex min-h-0 flex-1 flex-col">
        <HomeHeroPanel
          heroChatMessages={heroChatMessages}
          selectedChefDirection={selectedChefDirection}
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
          onCreateRecipeFromReply={(replyIndex) => void handleCreateRecipeFromReply(replyIndex)}
          onSelectChefDirection={handleSelectChefDirection}
          onClearChefDirection={handleClearChefDirection}
          onStartOver={handleStartOver}
          heroChatFrameRef={heroChatFrameRef}
          heroChatViewportRef={heroChatViewportRef}
        />
      </div>
    </div>
  );
}
