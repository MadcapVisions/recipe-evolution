"use client";

import Image from "next/image";
import { useState } from "react";
import { PhotoGallery } from "@/components/PhotoGallery";
import { PhotoUpload } from "@/components/PhotoUpload";
import { Button } from "@/components/Button";
import { ServingsControl } from "@/components/ServingsControl";
import { versionLabel, type IngredientItem, type RecipeListItem, type RecipeRow, type StepItem, type TimelineVersion, type VersionRow } from "@/components/recipes/version-detail/types";

export function VersionMainPanels({
  recipe,
  version,
  ingredients,
  displayServings,
  canAdjustServings,
  onSetTargetServings,
  steps,
  topPhotoUrl,
  userId,
  onShare,
  onViewVersionHistory,
  versionHistoryOpen,
  timelineVersions,
  timelineHasMore,
  timelineLoadingMore,
  onVersionNavigate,
  onLoadMoreVersions,
  onOpenVersionMenu,
  recipeSearch,
  searchResults,
  onRecipeSearchChange,
  onRecipeNavigate,
  onOpenRecipeMenu,
  recipeSwitchOpen,
  onToggleRecipeSwitch,
  onOpenChefWorkshop,
  onAddToMealPlan,
  photosWithUrls,
  galleryLoading,
}: {
  recipe: RecipeRow;
  version: VersionRow;
  ingredients: IngredientItem[];
  displayServings: number;
  canAdjustServings: boolean;
  onSetTargetServings: (value: number) => void;
  steps: StepItem[];
  topPhotoUrl: string | null;
  userId: string | null;
  onShare: () => void;
  onViewVersionHistory: () => void;
  versionHistoryOpen: boolean;
  timelineVersions: TimelineVersion[];
  timelineHasMore: boolean;
  timelineLoadingMore: boolean;
  onVersionNavigate: (versionId: string) => void;
  onLoadMoreVersions: () => void;
  onOpenVersionMenu: (versionId: string, rect: DOMRect) => void;
  recipeSearch: string;
  searchResults: RecipeListItem[];
  onRecipeSearchChange: (value: string) => void;
  onRecipeNavigate: (recipeId: string) => void;
  onOpenRecipeMenu: (recipeId: string, rect: DOMRect) => void;
  recipeSwitchOpen: boolean;
  onToggleRecipeSwitch: () => void;
  onOpenChefWorkshop: () => void;
  onAddToMealPlan: (day: string) => void;
  photosWithUrls: Array<{ id: string; signedUrl: string; storagePath: string }>;
  galleryLoading: boolean;
}) {
  const weekdayOptions = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
  const todayDay = weekdayOptions[(new Date().getDay() + 6) % 7];
  const [selectedPlanDay, setSelectedPlanDay] = useState<string>(todayDay);

  return (
    <section className="space-y-5">
      <section className="app-panel overflow-hidden">
        {topPhotoUrl ? (
          <div className="relative h-56 overflow-hidden border-b border-[rgba(57,75,70,0.08)] sm:h-64 lg:h-80">
            <Image src={topPhotoUrl} alt={`${recipe.title} recipe`} width={1280} height={720} unoptimized className="h-full w-full object-cover object-center" />
            <button
              type="button"
              onClick={onShare}
              aria-label="Share recipe"
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(255,255,255,0.72)] bg-[rgba(255,251,246,0.94)] text-[color:var(--text)] shadow-[0_10px_24px_rgba(44,26,21,0.16)] backdrop-blur-sm transition hover:bg-white sm:h-12 sm:w-12"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4" />
                <path d="m7 9 5-5 5 5" />
                <path d="M5 20h14" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="relative h-56 bg-gradient-to-br from-[rgba(210,76,47,0.14)] to-[rgba(242,185,75,0.18)] sm:h-64 lg:h-80">
            <button
              type="button"
              onClick={onShare}
              aria-label="Share recipe"
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(255,255,255,0.72)] bg-[rgba(255,251,246,0.94)] text-[color:var(--text)] shadow-[0_10px_24px_rgba(44,26,21,0.16)] backdrop-blur-sm transition hover:bg-white sm:h-12 sm:w-12"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4" />
                <path d="m7 9 5-5 5 5" />
                <path d="M5 20h14" />
              </svg>
            </button>
          </div>
        )}

        <div className="space-y-4 p-4 sm:p-6 lg:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button href="/recipes" variant="secondary" className="justify-center">
                <span aria-hidden="true">←</span>
                My Recipes
              </Button>
              <Button onClick={onOpenChefWorkshop} variant="secondary" className="justify-center">
                Chef Workshop
              </Button>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={onToggleRecipeSwitch}
                className="inline-flex items-center gap-2 rounded-full border border-[rgba(57,75,70,0.12)] bg-[rgba(255,253,249,0.92)] px-4 py-2.5 text-sm font-semibold text-[color:var(--text)] transition hover:bg-white"
              >
                Switch Recipe
              </button>
              {recipeSwitchOpen ? (
                <RecipeSwitchDropdown
                  currentRecipeId={recipe.id}
                  recipeSearch={recipeSearch}
                  searchResults={searchResults}
                  onRecipeSearchChange={onRecipeSearchChange}
                  onRecipeNavigate={onRecipeNavigate}
                  onOpenRecipeMenu={onOpenRecipeMenu}
                />
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="app-kicker">Current version</p>
              <h1 className="mt-3 text-[24px] font-semibold leading-[1.02] tracking-tight text-[color:var(--text)] min-[380px]:text-[28px] sm:text-[32px] lg:text-[42px]">{recipe.title}</h1>
              {recipe.description ? (
                <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--muted)]">{recipe.description}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-[rgba(79,125,115,0.12)] px-3 py-1.5 text-sm font-semibold text-[color:var(--primary)]">
                  {versionLabel(version)}
                </span>
                <span className="rounded-full bg-[rgba(201,123,66,0.1)] px-3 py-1.5 text-sm font-semibold text-[color:var(--text)]">
                  Saved {new Date(version.created_at).toLocaleDateString()}
                </span>
                <span className="rounded-full bg-[rgba(57,75,70,0.06)] px-3 py-1.5 text-sm font-semibold text-[color:var(--text)]">
                  Serves {typeof version.servings === "number" ? displayServings : "-"}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 lg:flex lg:flex-wrap lg:justify-end">
              <Button href={`/recipes/${recipe.id}/versions/${version.id}/cook`} className="w-full justify-center lg:w-auto">
                Cook This Version
              </Button>
              <div className="flex w-full flex-col gap-2 min-[380px]:col-span-2 lg:w-auto lg:flex-row lg:items-center">
                <select
                  value={selectedPlanDay}
                  onChange={(event) => setSelectedPlanDay(event.target.value)}
                  aria-label="Choose meal plan day"
                  className="min-h-11 rounded-full border border-[rgba(142,84,60,0.12)] bg-[rgba(255,249,243,0.96)] px-4 text-sm font-semibold text-[color:var(--text)] shadow-[0_6px_16px_rgba(101,47,29,0.05)]"
                >
                  {weekdayOptions.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
                <Button onClick={() => onAddToMealPlan(selectedPlanDay)} variant="secondary" className="w-full justify-center lg:w-auto">
                  Add to Meal Plan
                </Button>
              </div>
              <div className="relative">
                <Button onClick={onViewVersionHistory} variant="secondary" className="w-full justify-center lg:w-auto">
                  View Version History
                </Button>
                {versionHistoryOpen ? (
                  <VersionHistoryDropdown
                    currentVersionId={version.id}
                    recipe={recipe}
                    timelineVersions={timelineVersions}
                    timelineHasMore={timelineHasMore}
                    timelineLoadingMore={timelineLoadingMore}
                    onVersionNavigate={onVersionNavigate}
                    onLoadMoreVersions={onLoadMoreVersions}
                    onOpenVersionMenu={onOpenVersionMenu}
                  />
                ) : null}
              </div>
            </div>
          </div>

          {version.notes?.trim() ? (
            <div className="rounded-[24px] bg-[rgba(74,106,96,0.07)] p-4 sm:p-5">
              <p className="app-kicker">Chef tips</p>
              <div className="mt-3 space-y-2">
                {version.notes.split("\n").filter((line) => line.trim()).map((line, i) => (
                  <p key={i} className="text-[15px] leading-relaxed text-[color:var(--text)]">{line}</p>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_240px]">
            <div className="rounded-[24px] bg-[rgba(201,123,66,0.08)] p-4 sm:p-5">
              <p className="app-kicker">Change notes</p>
              <p className="mt-3 text-[15px] leading-7 text-[color:var(--muted)]">
                {version.change_summary?.trim().length ? version.change_summary : "No changes yet. This is the original recipe."}
              </p>
            </div>
            <div className="rounded-[24px] border border-[rgba(57,75,70,0.08)] bg-white/80 p-4 sm:p-5">
              <p className="app-kicker">Version frame</p>
              <div className="mt-3 space-y-3 text-sm text-[color:var(--text)]">
                <div>
                  <p className="text-[color:var(--muted)]">Recipe</p>
                  <p className="mt-1 font-semibold">{recipe.title}</p>
                </div>
                <div>
                  <p className="text-[color:var(--muted)]">Stage</p>
                  <p className="mt-1 font-semibold">{version.version_number === 1 ? "Foundational version" : `Iteration ${version.version_number}`}</p>
                </div>
                <div>
                  <p className="text-[color:var(--muted)]">Intent</p>
                  <p className="mt-1 font-semibold">{version.version_label?.trim() || "Original build"}</p>
                </div>
              </div>
            </div>
          </div>

          <ServingsControl
            label="Cook for"
            baseServings={canAdjustServings ? version.servings : null}
            targetServings={displayServings}
            onChange={onSetTargetServings}
          />
        </div>
      </section>

      <IngredientList ingredients={ingredients} />

      <section className="app-panel p-4 sm:p-6">
        <h2 className="text-[22px] font-semibold tracking-tight text-[color:var(--text)] sm:text-[30px]">Cooking Steps</h2>
        <div className="mt-4 flex flex-col gap-3">
          {steps.map((step, index) => (
            <div key={`${step.text}-${index}`} className="flex gap-3 rounded-[22px] bg-[rgba(141,169,187,0.06)] p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] text-[15px] font-semibold text-white">
                {index + 1}
              </div>
              <p className="text-[15px] leading-7 text-[color:var(--text)]">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="app-panel p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="app-kicker">Photos</p>
            <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-[color:var(--text)] sm:text-[30px]">Recipe photos</h2>
          </div>
          <div>{userId ? <PhotoUpload recipeId={recipe.id} userId={userId} versionId={version.id} compact /> : null}</div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {galleryLoading ? <p className="text-sm text-[color:var(--muted)]">Loading photos...</p> : null}
          <PhotoGallery recipeId={recipe.id} versionId={version.id} photos={photosWithUrls} />
        </div>
      </section>
    </section>
  );
}

function RecipeSwitchDropdown({
  currentRecipeId,
  recipeSearch,
  searchResults,
  onRecipeSearchChange,
  onRecipeNavigate,
  onOpenRecipeMenu,
}: {
  currentRecipeId: string;
  recipeSearch: string;
  searchResults: RecipeListItem[];
  onRecipeSearchChange: (value: string) => void;
  onRecipeNavigate: (recipeId: string) => void;
  onOpenRecipeMenu: (recipeId: string, rect: DOMRect) => void;
}) {
  return (
    <div className="absolute left-0 top-[calc(100%+10px)] z-30 w-[min(340px,calc(100vw-2rem))] rounded-[28px] border border-[rgba(57,75,70,0.12)] bg-[rgba(255,253,249,0.98)] p-4 shadow-[0_18px_40px_rgba(52,70,63,0.12)] lg:left-auto lg:right-0">
      <p className="app-kicker">Recipe browser</p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">Switch the center recipe. The workshop and reference panels will follow the recipe you open.</p>
      <input
        type="text"
        value={recipeSearch}
        onChange={(event) => onRecipeSearchChange(event.target.value)}
        placeholder="Jump to another recipe..."
        className="mt-4 w-full"
      />
      <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
        {searchResults.map((userRecipe) => {
          const isActive = userRecipe.id === currentRecipeId;
          return (
            <div
              key={userRecipe.id}
              onClick={() => onRecipeNavigate(userRecipe.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onRecipeNavigate(userRecipe.id);
                }
              }}
              role="button"
              tabIndex={0}
              className={`rounded-[20px] border p-3 transition ${
                isActive
                  ? "border-[rgba(82,124,116,0.2)] bg-[linear-gradient(135deg,rgba(79,125,115,0.12)_0%,rgba(255,251,245,0.98)_100%)] text-[color:var(--primary)]"
                  : "border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.84)] text-[color:var(--text)] hover:bg-white"
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  {isActive ? (
                    <span className="inline-flex rounded-full bg-[rgba(79,125,115,0.14)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--primary)]">
                      Current dish
                    </span>
                  ) : null}
                  <span className="mt-2 block text-[14px] font-medium sm:text-[15px]">{userRecipe.title}</span>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onOpenRecipeMenu(userRecipe.id, event.currentTarget.getBoundingClientRect());
                  }}
                  className="relative z-20 flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--muted)] transition hover:bg-[rgba(141,169,187,0.14)] hover:text-[color:var(--text)]"
                  aria-label={`Open actions for ${userRecipe.title}`}
                >
                  ⋮
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VersionHistoryDropdown({
  currentVersionId,
  recipe,
  timelineVersions,
  timelineHasMore,
  timelineLoadingMore,
  onVersionNavigate,
  onLoadMoreVersions,
  onOpenVersionMenu,
}: {
  currentVersionId: string;
  recipe: RecipeRow;
  timelineVersions: TimelineVersion[];
  timelineHasMore: boolean;
  timelineLoadingMore: boolean;
  onVersionNavigate: (versionId: string) => void;
  onLoadMoreVersions: () => void;
  onOpenVersionMenu: (versionId: string, rect: DOMRect) => void;
}) {
  return (
    <div className="absolute left-0 top-[calc(100%+10px)] z-30 w-[min(420px,calc(100vw-2rem))] rounded-[28px] border border-[rgba(57,75,70,0.12)] bg-[rgba(255,253,249,0.98)] p-4 shadow-[0_18px_40px_rgba(52,70,63,0.12)] lg:left-auto lg:right-0">
      <p className="app-kicker">Version history</p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">Browse the saved lineage for this recipe. Picking a version updates the recipe canvas and the Chef workshop together.</p>
      <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
        {timelineVersions.map((timelineVersion) => {
          const isActive = timelineVersion.id === currentVersionId;
          const isBest = recipe.best_version_id === timelineVersion.id;
          return (
            <div
              key={timelineVersion.id}
              onClick={() => onVersionNavigate(timelineVersion.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onVersionNavigate(timelineVersion.id);
                }
              }}
              role="button"
              tabIndex={0}
              className={`rounded-[20px] p-3 transition ${
                isActive
                  ? "border border-[rgba(82,124,116,0.18)] bg-[linear-gradient(135deg,rgba(79,125,115,0.12)_0%,rgba(255,251,245,0.98)_100%)]"
                  : "border border-[rgba(57,75,70,0.06)] bg-[rgba(255,253,249,0.84)] hover:bg-white"
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 text-left">
                  <div className="flex flex-wrap gap-2">
                    {isActive ? (
                      <span className="rounded-full bg-[rgba(79,125,115,0.14)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--primary)]">
                        Current
                      </span>
                    ) : null}
                    {isBest ? (
                      <span className="rounded-full bg-[rgba(201,123,66,0.14)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text)]">
                        Best
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-[14px] font-medium text-[color:var(--text)] sm:text-[15px]">{versionLabel(timelineVersion)}</p>
                  <p className="mt-2 text-sm text-[color:var(--muted)]">
                    {timelineVersion.change_summary?.trim().length ? timelineVersion.change_summary : "No change note saved for this version."}
                  </p>
                  <p className="mt-2 text-xs text-[color:var(--muted)]">{new Date(timelineVersion.created_at).toLocaleDateString()}</p>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onOpenVersionMenu(timelineVersion.id, event.currentTarget.getBoundingClientRect());
                  }}
                  className="relative z-20 flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--muted)] transition hover:bg-[rgba(141,169,187,0.14)] hover:text-[color:var(--text)]"
                  aria-label={`Open actions for ${versionLabel(timelineVersion)}`}
                >
                  ⋮
                </button>
              </div>
            </div>
          );
        })}
        {timelineHasMore ? (
          <button
            type="button"
            onClick={onLoadMoreVersions}
            disabled={timelineLoadingMore}
            className="w-full rounded-[20px] border border-[rgba(57,75,70,0.12)] px-3 py-2.5 text-sm font-medium text-[color:var(--text)] transition hover:bg-[rgba(141,169,187,0.08)] disabled:opacity-60"
          >
            {timelineLoadingMore ? "Loading more..." : "Show more versions"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function IngredientList({ ingredients }: { ingredients: IngredientItem[] }) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  function toggle(index: number) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <section className="app-panel p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[22px] font-semibold tracking-tight text-[color:var(--text)] sm:text-[30px]">Ingredients</h2>
        {checked.size > 0 ? (
          <button
            type="button"
            onClick={() => setChecked(new Set())}
            className="text-[13px] font-semibold text-[color:var(--muted)] hover:text-[color:var(--text)]"
          >
            Clear ({checked.size})
          </button>
        ) : null}
      </div>
      <ul className="mt-4 flex flex-col gap-3">
        {ingredients.map((ingredient, index) => {
          const isChecked = checked.has(index);
          return (
            <li key={`${ingredient.name}-${index}`}>
              <button
                type="button"
                onClick={() => toggle(index)}
                className={`flex w-full items-start gap-3 rounded-[20px] p-4 text-left text-[15px] leading-7 transition ${
                  isChecked
                    ? "bg-[rgba(142,168,141,0.15)] text-[color:var(--muted)] line-through"
                    : "bg-[rgba(141,169,187,0.06)] text-[color:var(--text)] hover:bg-[rgba(141,169,187,0.12)]"
                }`}
              >
                <span
                  className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                    isChecked
                      ? "border-[color:var(--primary)] bg-[color:var(--primary)]"
                      : "border-[rgba(57,75,70,0.2)] bg-white"
                  }`}
                >
                  {isChecked ? (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </span>
                <span>{ingredient.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
