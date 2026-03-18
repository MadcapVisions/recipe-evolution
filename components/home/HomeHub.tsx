"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { HomeHeroPanel } from "@/components/home/HomeHeroPanel";
import { RecipeIdeasPanel } from "@/components/home/RecipeIdeasPanel";
import { SmartMealBuilder } from "@/components/home/SmartMealBuilder";
import { TonightSuggestions } from "@/components/home/TonightSuggestions";
import { useHomeHubAi } from "@/components/home/useHomeHubAi";
import type { HomeHubProps } from "@/components/home/types";
import { ShellContextPanel } from "@/components/shell/ShellContextPanel";
import { publishAiStatus } from "@/lib/ui/aiStatusBus";

function CompactRecentRecipes({
  recentRecipes,
}: {
  recentRecipes: HomeHubProps["recentRecipes"];
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="app-kicker">Recent dishes</p>
          <h2 className="mt-2 font-display text-[28px] font-semibold tracking-tight text-[color:var(--text)]">Back to something you already trust.</h2>
        </div>
        <Link href="/recipes" className="app-chip justify-center">
          My Recipes
        </Link>
      </div>
      {recentRecipes.length > 0 ? (
        <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
          {recentRecipes.slice(0, 3).map((recipe, index) => (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}`}
              className="recipe-cover-wrap min-w-[250px] max-w-[250px] snap-start overflow-hidden rounded-[24px] border border-[rgba(79,54,33,0.08)] bg-[rgba(255,252,246,0.92)] shadow-[0_10px_20px_rgba(76,50,24,0.05)]"
            >
              {recipe.cover_image_url ? (
                <Image
                  src={recipe.cover_image_url}
                  alt={`${recipe.title} cover`}
                  width={640}
                  height={480}
                  unoptimized
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div
                  className={`aspect-[4/3] w-full ${
                    index % 2 === 0 ? "bg-gradient-to-br from-[#efcfb0] to-[#d7b38d]" : "bg-gradient-to-br from-[#dce4d3] to-[#ead7b6]"
                  }`}
                />
              )}
              <div className="p-4">
                <p className="text-[18px] font-semibold leading-tight text-[color:var(--text)]">{recipe.title}</p>
                <p className="mt-2 text-sm text-[color:var(--muted)]">
                  {recipe.version_count} version{recipe.version_count === 1 ? "" : "s"} · Serves {typeof recipe.servings === "number" ? recipe.servings : "-"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-[24px] border border-[rgba(79,54,33,0.08)] bg-[rgba(255,252,246,0.92)] p-5">
          <p className="text-sm leading-6 text-[color:var(--muted)]">Your first saved recipe will show up here. Start with Chef or create one from scratch.</p>
        </div>
      )}
    </section>
  );
}

function DashboardRecentRecipesPanel({
  recentRecipes,
  onClose,
}: {
  recentRecipes: HomeHubProps["recentRecipes"];
  onClose?: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="app-kicker">My Recipes</p>
          <h2 className="mt-2 font-display text-[22px] font-semibold tracking-tight text-[color:var(--text)]">Recent dishes</h2>
          <p className="mt-1.5 text-sm leading-6 text-[color:var(--muted)]">Jump back into something you already built.</p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[color:var(--muted)] transition hover:bg-[rgba(141,169,187,0.14)] hover:text-[color:var(--text)]"
            aria-label="Close panel"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/recipes" className="app-chip justify-center">
          My Recipes
        </Link>
        <Link href="/planner" className="app-chip justify-center">
          Weekly Planner
        </Link>
      </div>

      <div className="space-y-2">
        {recentRecipes.length > 0 ? (
          recentRecipes.slice(0, 8).map((recipe) => (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}`}
              className="block rounded-[20px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.92)] px-4 py-3 transition hover:bg-white"
            >
              <p className="text-[15px] font-semibold leading-6 text-[color:var(--text)]">{recipe.title}</p>
              <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                {recipe.version_count} version{recipe.version_count === 1 ? "" : "s"} · {recipe.updated_at ? new Date(recipe.updated_at).toLocaleDateString() : "—"}
              </p>
            </Link>
          ))
        ) : (
          <div className="rounded-[20px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.92)] px-4 py-4 text-sm text-[color:var(--muted)]">
            No saved dishes yet. Start with Chef to create your first one.
          </div>
        )}
      </div>
    </div>
  );
}

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
    generateRecipeFromIdea,
    toggleSmartPreference,
    toggleSmartProtein,
    toggleSmartCuisine,
    toggleSmartCookTime,
    handleGenerateSmartMeals,
    handleSelectSmartIdea,
  } = useHomeHubAi(userTasteProfile);

  const [recentPanelOpen, setRecentPanelOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const activeStatus = smartStatus || status;
    const activeLoading = smartLoading || loading || smartGeneratingRecipe || generatingRecipe;

    if (!activeStatus) {
      publishAiStatus({ message: null });
      return;
    }

    const lower = activeStatus.toLowerCase();
    const tone = activeLoading ? "loading" : lower.includes("fallback") || lower.includes("unavailable") || lower.includes("rate-limited") ? "fallback" : "success";

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

  const panelLabel = recentRecipes.length > 0
    ? `${recentRecipes.length} dish${recentRecipes.length === 1 ? "" : "es"}`
    : "Recent";

  return (
    <div className="mx-auto w-full max-w-[1380px] space-y-8">
      {/* Mobile/tablet shell panels */}
      <ShellContextPanel
        side="left"
        label="Recents"
        title="Recent dishes"
        description="Browse recently updated recipes and jump back into one without leaving Create."
      >
        <DashboardRecentRecipesPanel recentRecipes={recentRecipes} />
      </ShellContextPanel>

      <ShellContextPanel
        side="right"
        label="Filters"
        title="Quick filters"
        description="Already know the protein, time, or style? Set it here and Chef returns tighter directions."
      >
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
          onGenerateRecipes={() => void handleGenerateSmartMeals()}
        />
      </ShellContextPanel>

      {/* Desktop slide-in recent panel */}
      {recentPanelOpen ? (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 hidden xl:block"
            onClick={() => setRecentPanelOpen(false)}
          />
          {/* Panel */}
          <div className="fixed left-0 top-0 z-50 hidden h-full w-[320px] overflow-y-auto border-r border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.98)] p-5 shadow-[4px_0_32px_rgba(52,70,63,0.10)] xl:block">
            <DashboardRecentRecipesPanel
              recentRecipes={recentRecipes}
              onClose={() => setRecentPanelOpen(false)}
            />
          </div>
        </>
      ) : null}

      {/* Desktop edge trigger — left side, xl only */}
      {!recentPanelOpen ? (
        <button
          type="button"
          onClick={() => setRecentPanelOpen(true)}
          className="fixed left-0 top-1/2 z-40 hidden -translate-y-1/2 xl:flex"
          aria-label="Open recent dishes panel"
        >
          <div className="flex flex-col items-center gap-2 rounded-r-[16px] border border-l-0 border-[rgba(57,75,70,0.1)] bg-[rgba(255,253,249,0.96)] py-4 pl-2 pr-3 shadow-[2px_0_12px_rgba(52,70,63,0.08)] transition hover:bg-white">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-[color:var(--primary)]">
              <path d="M5 2L10 7L5 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
              {panelLabel}
            </p>
          </div>
        </button>
      ) : null}

      {/* Main content — full width, centered */}
      <div className="mx-auto w-full max-w-[760px] space-y-6">
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

        {/* Filters toggle */}
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setShowFilters((prev) => !prev)}
            className="text-sm text-[color:var(--muted)] underline underline-offset-2 transition hover:text-[color:var(--text)]"
          >
            {showFilters ? "Hide filters" : "Use filters instead →"}
          </button>
        </div>

        {/* Inline filters */}
        {showFilters ? (
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
            onGenerateRecipes={() => void handleGenerateSmartMeals()}
          />
        ) : null}

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

        {/* Mobile: compact recent recipes */}
        <div className="xl:hidden">
          <CompactRecentRecipes recentRecipes={recentRecipes} />
        </div>
      </div>
    </div>
  );
}
