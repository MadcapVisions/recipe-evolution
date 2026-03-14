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
      if (smartGeneratingRecipe || generatingRecipe || lower.includes("full recipe")) {
        message = "Generating recipe...";
      } else {
        message = "Chef is thinking...";
      }
    } else if (lower.includes("choose an idea") || lower.includes("select an idea")) {
      message = "Suggestions ready";
    } else if (lower.includes("fallback")) {
      message = lower.includes("rate-limited") ? "Using backup recipe engine" : "AI temporarily unavailable";
    } else if (lower.includes("chef responded") || lower.includes("ready to apply")) {
      message = "Suggestions ready";
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
        <section className="app-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="app-kicker">Meal planning</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[color:var(--text)]">Plan multiple recipes together.</h2>
            <p className="mt-2 text-[16px] text-[color:var(--muted)]">Best after you already have recipes you want to combine.</p>
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
              <p className="app-kicker">Library</p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[color:var(--text)]">Recent recipes</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {recentRecipes.map((recipe, index) => (
              <Link
                key={recipe.id}
                href={`/recipes/${recipe.id}`}
                className="overflow-hidden rounded-[28px] border border-[rgba(79,54,33,0.08)] bg-[rgba(255,252,246,0.92)] shadow-[0_12px_24px_rgba(76,50,24,0.06)] transition hover:-translate-y-px hover:shadow-[0_18px_36px_rgba(76,50,24,0.08)]"
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
                    className={`aspect-[4/3] w-full bg-gradient-to-br ${
                      index % 2 === 0 ? "from-[#efd7bc] to-[#d9c0a3]" : "from-[#d8e1d0] to-[#e8d8bb]"
                    }`}
                  />
                )}
                <div className="p-5">
                  <p className="font-semibold text-[color:var(--text)]">{recipe.title}</p>
                  <p className="mt-2 text-sm text-[color:var(--muted)]">
                    Last updated {recipe.updated_at ? new Date(recipe.updated_at).toLocaleDateString() : "-"}
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    Serves {typeof recipe.servings === "number" ? recipe.servings : "-"}
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">Versions: {recipe.version_count}</p>
                </div>
              </Link>
            ))}
          </div>
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
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Recipes created</p>
              <p className="font-display text-5xl font-semibold leading-none text-[color:var(--text)]">{recentRecipes.length}</p>
            </div>
            <div className="flex h-32 flex-col justify-between rounded-[24px] bg-[rgba(111,135,103,0.12)] p-5 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Versions generated</p>
              <p className="font-display text-5xl font-semibold leading-none text-[color:var(--text)]">
                {totalVersionCount}
              </p>
            </div>
            <div className="flex h-32 flex-col justify-between rounded-[24px] bg-[rgba(221,182,90,0.14)] p-5 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Favorites saved</p>
              <p className="font-display text-5xl font-semibold leading-none text-[color:var(--text)]">{favoriteRecipes.length}</p>
            </div>
            <div className="flex h-32 flex-col justify-between rounded-[24px] bg-[rgba(33,27,22,0.05)] p-5 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">AI ideas loaded</p>
              <p className="font-display text-5xl font-semibold leading-none text-[color:var(--text)]">{ideas.length}</p>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
