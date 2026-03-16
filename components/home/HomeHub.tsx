"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { HomeHeroPanel } from "@/components/home/HomeHeroPanel";
import { RecipeIdeasPanel } from "@/components/home/RecipeIdeasPanel";
import { SmartMealBuilder } from "@/components/home/SmartMealBuilder";
import { TonightSuggestions } from "@/components/home/TonightSuggestions";
import { useHomeHubAi } from "@/components/home/useHomeHubAi";
import type { HomeHubProps } from "@/components/home/types";
import { publishAiStatus } from "@/lib/ui/aiStatusBus";

export function HomeHub({ recentRecipes, totalVersionCount, userTasteProfile }: HomeHubProps) {
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
    heroChatReadyToApply,
    activeChatRecipeIndex,
    heroChatFrameRef,
    heroChatViewportRef,
    handleHeroInputKeyDown,
    handleAskChefInHero,
    handleApplyHeroChatIdeas,
    handleCreateRecipeFromReply,
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

  const favoriteRecipes = useMemo(
    () =>
      recentRecipes
        .filter((recipe) => recipe.is_favorite)
        .sort((a, b) => {
          const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, 6),
    [recentRecipes]
  );

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

  return (
    <div className="mx-auto w-full max-w-[1380px] space-y-8">
      <section className="space-y-6">
        <HomeHeroPanel
          heroChatMessages={heroChatMessages}
          promptInput={promptInput}
          loading={loading}
          heroChatReadyToApply={heroChatReadyToApply}
          activeChatRecipeIndex={activeChatRecipeIndex}
          error={error}
          onPromptInputChange={setPromptInput}
          onPromptInputKeyDown={handleHeroInputKeyDown}
          onAskChef={() => void handleAskChefInHero()}
          onApplySuggestions={() => void handleApplyHeroChatIdeas()}
          onCreateRecipeFromReply={(replyIndex) => void handleCreateRecipeFromReply(replyIndex)}
          heroChatFrameRef={heroChatFrameRef}
          heroChatViewportRef={heroChatViewportRef}
        />

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
      </section>

      <section className="space-y-6">
        <section className="app-panel polish-card animate-rise-in flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="app-kicker">Meal planning</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[color:var(--text)]">Turn developed recipes into a working kitchen plan.</h2>
            <p className="mt-2 text-[16px] text-[color:var(--muted)]">Best once you already have versions you trust and want to cook together.</p>
          </div>
          <Link href="/planner" className="app-chip app-chip-active justify-center self-start sm:self-auto">
            Open Planner
          </Link>
        </section>

        <RecipeIdeasPanel
          ideas={ideas}
          generatingRecipe={generatingRecipe}
          selectedIdeaTitle={selectedIdeaTitle}
          loading={loading}
          maxIdeaCount={MAX_IDEA_COUNT}
          onSelectIdea={(idea) => void handleSelectIdea(idea)}
          onGenerateMoreIdeas={() => void handleGenerateMoreIdeas()}
        />

        {smartIdeas.length > 0 ? (
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

        {ideas.length === 0 && smartIdeas.length === 0 ? (
          <TonightSuggestions
            onCookThis={generateRecipeFromIdea}
            loading={generatingRecipe}
            activeTitle={selectedIdeaTitle}
          />
        ) : null}

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="app-kicker">Cookbook</p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[color:var(--text)]">Recent dishes in your system</h2>
            </div>
          </div>
          {recentRecipes.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {recentRecipes.map((recipe, index) => (
                <Link
                  key={recipe.id}
                  href={`/recipes/${recipe.id}`}
                  className="recipe-cover-wrap polish-card animate-rise-in overflow-hidden rounded-[28px] border border-[rgba(79,54,33,0.08)] bg-[rgba(255,252,246,0.92)] shadow-[0_12px_24px_rgba(76,50,24,0.06)] transition hover:-translate-y-px hover:shadow-[0_18px_36px_rgba(76,50,24,0.08)]"
                >
                  {recipe.cover_image_url ? (
                    <Image
                      src={recipe.cover_image_url}
                      alt={`${recipe.title} cover`}
                      width={640}
                      height={480}
                      unoptimized
                      className="recipe-cover aspect-[4/3] w-full object-cover"
                    />
                  ) : (
                    <div
                      className={`editorial-frame aspect-[4/3] w-full ${
                        index % 2 === 0 ? "bg-gradient-to-br from-[#efcfb0] to-[#d7b38d]" : "bg-gradient-to-br from-[#dce4d3] to-[#ead7b6]"
                      }`}
                    />
                  )}
                  <div className="p-5">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-[rgba(79,125,115,0.1)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--primary)]">
                        Recipe asset
                      </span>
                      <span className="rounded-full bg-[rgba(201,123,66,0.1)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text)]">
                        {recipe.version_count} version{recipe.version_count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <p className="mt-3 font-display text-[32px] font-semibold leading-[0.98] text-[color:var(--text)]">{recipe.title}</p>
                    <div className="mt-3 space-y-1 text-sm text-[color:var(--muted)]">
                      <p>Last updated {recipe.updated_at ? new Date(recipe.updated_at).toLocaleDateString() : "-"}</p>
                      <p>Serves {typeof recipe.servings === "number" ? recipe.servings : "-"}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="app-empty-state animate-rise-in px-6 py-10">
              <p className="app-kicker">Cookbook</p>
              <h3 className="mt-3 font-display text-[34px] font-semibold tracking-tight text-[color:var(--text)]">Your first saved dish will live here.</h3>
              <p className="mt-3 max-w-2xl text-[16px] leading-7 text-[color:var(--muted)]">
                Start with Chef, import an old favorite, or capture a new recipe from scratch. Once you save it, the cookbook begins to take shape.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/dashboard" className="ui-btn ui-btn-solid">
                  Start with Chef
                </Link>
                <Link href="/recipes/new" className="ui-btn ui-btn-light">
                  Create from Scratch
                </Link>
              </div>
            </div>
          )}
        </section>

        <section className="app-panel p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="app-kicker">Snapshot</p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[color:var(--text)]">Collection overview</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-[color:var(--muted)]">A lightweight summary of what you already have, kept below the main creation flow.</p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="flex h-32 flex-col justify-between rounded-[24px] bg-[rgba(188,92,47,0.1)] p-5 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Recipes saved</p>
              <p className="font-display text-5xl font-semibold leading-none text-[color:var(--text)]">{recentRecipes.length}</p>
            </div>
            <div className="flex h-32 flex-col justify-between rounded-[24px] bg-[rgba(111,135,103,0.12)] p-5 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Versions developed</p>
              <p className="font-display text-5xl font-semibold leading-none text-[color:var(--text)]">
                {totalVersionCount}
              </p>
            </div>
            <div className="flex h-32 flex-col justify-between rounded-[24px] bg-[rgba(221,182,90,0.14)] p-5 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Favorites saved</p>
              <p className="font-display text-5xl font-semibold leading-none text-[color:var(--text)]">{favoriteRecipes.length}</p>
            </div>
            <div className="flex h-32 flex-col justify-between rounded-[24px] bg-[rgba(33,27,22,0.05)] p-5 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Chef directions ready</p>
              <p className="font-display text-5xl font-semibold leading-none text-[color:var(--text)]">{ideas.length}</p>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
