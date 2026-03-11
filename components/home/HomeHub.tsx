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

export function HomeHub({ recentRecipes, versionTimelineByRecipe }: HomeHubProps) {
  const [recipesState, setRecipesState] = useState(recentRecipes);
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
    heroChatFrameRef,
    heroChatViewportRef,
    handleHeroInputKeyDown,
    handleAskChefInHero,
    handleApplyHeroChatIdeas,
    handleGenerateMoreIdeas,
    handleSelectIdea,
    generateRecipeFromIdea,
    toggleSmartPreference,
    toggleSmartProtein,
    toggleSmartCuisine,
    toggleSmartCookTime,
    handleGenerateSmartMeals,
    handleSelectSmartIdea,
  } = useHomeHubAi();

  const favoriteRecipes = recipesState
    .filter((recipe) => recipe.is_favorite)
    .sort((a, b) => {
      const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 6);

  useEffect(() => {
    setRecipesState(recentRecipes);
  }, [recentRecipes]);

  return (
    <div className="mx-auto w-full max-w-[1380px] space-y-8">
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.9fr)_minmax(360px,1fr)] xl:items-stretch">
        <div className="space-y-6">
          <HomeHeroPanel
            heroChatMessages={heroChatMessages}
            promptInput={promptInput}
            loading={loading}
            heroChatReadyToApply={heroChatReadyToApply}
            error={error}
            onPromptInputChange={setPromptInput}
            onPromptInputKeyDown={handleHeroInputKeyDown}
            onAskChef={() => void handleAskChefInHero()}
            onApplySuggestions={handleApplyHeroChatIdeas}
            heroChatFrameRef={heroChatFrameRef}
            heroChatViewportRef={heroChatViewportRef}
          />

          {status ? (
            <section className="app-panel p-4">
              <div
                className={`rounded-[22px] border px-4 py-3 text-base font-semibold shadow-sm ${
                  loading
                    ? "border-emerald-300 bg-emerald-100 text-emerald-900"
                    : "border-emerald-200 bg-emerald-50 text-emerald-900"
                }`}
                role="status"
                aria-live="polite"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-2.5 w-2.5 rounded-full ${
                      loading ? "animate-pulse bg-emerald-500" : "bg-emerald-500"
                    }`}
                    aria-hidden="true"
                  />
                  <span>{status}</span>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <SmartMealBuilder
          smartProteins={smartProteins}
          smartCuisines={smartCuisines}
          smartCookTimes={smartCookTimes}
          smartPreferences={smartPreferences}
          smartLoading={smartLoading}
          smartStatus={smartStatus}
          smartError={smartError}
          smartGeneratingRecipe={smartGeneratingRecipe}
          smartSelectedIdeaTitle={smartSelectedIdeaTitle}
          smartIdeas={smartIdeas}
          onToggleProtein={toggleSmartProtein}
          onToggleCuisine={toggleSmartCuisine}
          onToggleCookTime={toggleSmartCookTime}
          onTogglePreference={toggleSmartPreference}
          onGenerateRecipes={() => void handleGenerateSmartMeals()}
          onSelectIdea={(idea) => void handleSelectSmartIdea(idea)}
        />
      </section>

      <section className="space-y-6">
        <RecipeIdeasPanel
          ideas={ideas}
          generatingRecipe={generatingRecipe}
          selectedIdeaTitle={selectedIdeaTitle}
          loading={loading}
          maxIdeaCount={MAX_IDEA_COUNT}
          onSelectIdea={(idea) => void handleSelectIdea(idea)}
          onGenerateMoreIdeas={() => void handleGenerateMoreIdeas()}
        />

        {ideas.length === 0 ? (
          <TonightSuggestions
            onCookThis={generateRecipeFromIdea}
            loading={generatingRecipe}
            activeTitle={selectedIdeaTitle}
          />
        ) : null}

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="app-kicker">Your library</p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[color:var(--text)]">Recent recipes</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
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
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[color:var(--text)]">Your cooking stats</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-[color:var(--muted)]">A quick view of momentum in your recipe collection and AI-assisted iterations.</p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="flex h-32 flex-col justify-between rounded-[24px] bg-[rgba(188,92,47,0.1)] p-5 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Recipes created</p>
              <p className="font-display text-5xl font-semibold leading-none text-[color:var(--text)]">{recentRecipes.length}</p>
            </div>
            <div className="flex h-32 flex-col justify-between rounded-[24px] bg-[rgba(111,135,103,0.12)] p-5 text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Versions generated</p>
              <p className="font-display text-5xl font-semibold leading-none text-[color:var(--text)]">
                {Object.values(versionTimelineByRecipe).reduce((sum, versions) => sum + versions.length, 0)}
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
