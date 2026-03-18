"use client";

import { useEffect, useState } from "react";
import { HomeHeroPanel } from "@/components/home/HomeHeroPanel";
import { RecipeIdeasPanel } from "@/components/home/RecipeIdeasPanel";
import { SmartMealBuilder } from "@/components/home/SmartMealBuilder";
import { TonightSuggestions } from "@/components/home/TonightSuggestions";
import { useHomeHubAi } from "@/components/home/useHomeHubAi";
import type { HomeHubProps } from "@/components/home/types";
import { ShellContextPanel } from "@/components/shell/ShellContextPanel";
import { publishAiStatus } from "@/lib/ui/aiStatusBus";

export function HomeHub({ recentRecipes, userTasteProfile }: HomeHubProps) {
  const {
    MAX_IDEA_COUNT,
    promptInput,
    setPromptInput,
    loading,
    generatingRecipe,
    selectedIdeaTitle,
    error,
    status,
    ideas,
    smartProteins,
    smartCuisines,
    smartCookTimes,
    smartPreferences,
    smartIdeas,
    smartLoading,
    smartGeneratingRecipe,
    smartSelectedIdeaTitle,
    smartError,
    smartStatus,
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
    handleGenerateMoreIdeas,
    handleSelectIdea,
    toggleSmartPreference,
    toggleSmartProtein,
    toggleSmartCuisine,
    toggleSmartCookTime,
    handleGenerateSmartMeals,
    handleSelectSmartIdea,
  } = useHomeHubAi(userTasteProfile);

  const [filtersPanelOpen, setFiltersPanelOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<string[]>([]);
  const chatStarted = heroChatMessages.length > 0;

  // Close filters panel when the user starts a conversation
  useEffect(() => {
    if (chatStarted) {
      setFiltersPanelOpen(false);
    }
  }, [chatStarted]);

  function handleApplyFilters() {
    const all = [...smartProteins, ...smartCuisines, ...smartCookTimes, ...smartPreferences];
    setAppliedFilters(all);
    setFiltersPanelOpen(false);
    void handleGenerateSmartMeals();
  }

  function handleRemoveAppliedFilter(filter: string) {
    setAppliedFilters((prev) => prev.filter((f) => f !== filter));
  }

  const activeFilterCount =
    smartProteins.length + smartCuisines.length + smartCookTimes.length + smartPreferences.length;

  useEffect(() => {
    const activeStatus = smartStatus || status;
    const activeLoading = smartLoading || loading || smartGeneratingRecipe || generatingRecipe;

    if (!activeStatus) {
      publishAiStatus({ message: null });
      return;
    }

    const lower = activeStatus.toLowerCase();
    const tone =
      activeLoading
        ? "loading"
        : lower.includes("fallback") || lower.includes("unavailable") || lower.includes("rate-limited")
        ? "fallback"
        : "success";

    let message = activeStatus;
    if (activeLoading) {
      if (smartGeneratingRecipe || generatingRecipe || lower.includes("full recipe") || lower.includes("building")) {
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
  }, [status, smartStatus, loading, smartLoading, generatingRecipe, smartGeneratingRecipe]);

  const activeIdeaPanel = smartIdeas.length > 0 ? "smart" : ideas.length > 0 ? "ideas" : null;

  const filtersContent = (
    <SmartMealBuilder
      smartProteins={smartProteins}
      smartCuisines={smartCuisines}
      smartCookTimes={smartCookTimes}
      smartPreferences={smartPreferences}
      smartLoading={smartLoading}
      smartError={smartError}
      onToggleProtein={toggleSmartProtein}
      onToggleCuisine={toggleSmartCuisine}
      onToggleCookTime={toggleSmartCookTime}
      onTogglePreference={toggleSmartPreference}
      onGenerateRecipes={handleApplyFilters}
    />
  );

  return (
    <div className="mx-auto w-full max-w-[1380px] space-y-8">
      {/* Mobile shell panel — left = filters */}
      <ShellContextPanel
        side="left"
        label="Filters"
        title="Quick filters"
        description="Set your protein, cuisine, or time constraint and Chef builds around it."
      >
        {filtersContent}
      </ShellContextPanel>

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

      {/* Desktop filters slide-in panel */}
      {filtersPanelOpen ? (
        <>
          <div
            className="fixed inset-0 z-40 hidden xl:block"
            onClick={() => setFiltersPanelOpen(false)}
          />
          <div className="fixed left-2 top-1/2 z-50 hidden max-h-[calc(100vh-100px)] w-[320px] -translate-y-1/2 overflow-y-auto rounded-[24px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.98)] p-5 shadow-[4px_8px_32px_rgba(52,70,63,0.12)] xl:block">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="app-kicker">Filters</p>
                <h2 className="mt-1.5 font-display text-[20px] font-semibold tracking-tight text-[color:var(--text)]">Set your rails</h2>
                <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">Chef will use these as the starting context for every direction it suggests.</p>
              </div>
              <button
                type="button"
                onClick={() => setFiltersPanelOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[color:var(--muted)] transition hover:bg-[rgba(141,169,187,0.14)] hover:text-[color:var(--text)]"
                aria-label="Close filters"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {filtersContent}
          </div>
        </>
      ) : null}

      {/* Desktop edge trigger — filters, xl only, hidden once chat started */}
      {!filtersPanelOpen && !chatStarted ? (
        <button
          type="button"
          onClick={() => setFiltersPanelOpen(true)}
          className="fixed left-0 top-1/2 z-40 hidden -translate-y-1/2 xl:flex"
          aria-label="Open filters panel"
        >
          <div className="flex flex-col items-center gap-2 rounded-r-[16px] border border-l-0 border-[rgba(57,75,70,0.1)] bg-[rgba(255,253,249,0.96)] py-4 pl-2 pr-3 shadow-[2px_0_12px_rgba(52,70,63,0.08)] transition hover:bg-white">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-[color:var(--primary)]">
              <path d="M5 2L10 7L5 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
              {activeFilterCount > 0 ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"}` : "Filters"}
            </p>
          </div>
        </button>
      ) : null}

      {/* Main content — full width */}
      <div className="space-y-6">
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
          appliedFilters={appliedFilters}
          onRemoveFilter={handleRemoveAppliedFilter}
        />

        {activeIdeaPanel === "ideas" ? (
          <RecipeIdeasPanel
            ideas={ideas}
            generatingRecipe={generatingRecipe}
            selectedIdeaTitle={selectedIdeaTitle}
            loading={loading}
            maxIdeaCount={MAX_IDEA_COUNT}
            onSelectIdea={(idea) => void handleSelectIdea(idea)}
            onGenerateMoreIdeas={() => void handleGenerateMoreIdeas()}
          />
        ) : null}

        {activeIdeaPanel === "smart" ? (
          <TonightSuggestions
            ideas={smartIdeas}
            kicker="Suggested directions"
            heading="Built from your filters"
            description="Choose one of these meal directions to generate the full recipe."
            onCookThis={async (title) => {
              const selectedIdea = smartIdeas.find((idea) => idea.title === title);
              if (selectedIdea) {
                await handleSelectSmartIdea(selectedIdea);
              }
            }}
            loading={smartGeneratingRecipe}
            activeTitle={smartSelectedIdeaTitle}
          />
        ) : null}
      </div>
    </div>
  );
}
