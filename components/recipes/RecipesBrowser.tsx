"use client";

import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RecipeBrowseItem, RecipeBrowseSort, RecipeBrowseTab } from "@/lib/recipeBrowseData";

type RecipesBrowserProps = {
  initialRecipes: RecipeBrowseItem[];
  initialHasMore: boolean;
};

const PAGE_SIZE = 24;
const DESKTOP_RAIL_LEFT = "max(10px, calc((100vw - 1440px) / 2 + 12px))";

// Filter chip definitions for the My Recipes filter panel
const FILTER_GROUPS = [
  {
    label: "Protein",
    options: ["Chicken", "Beef", "Fish", "Pork", "Tofu", "Beans", "Eggs"],
  },
  {
    label: "Cook Time",
    options: ["15 min", "30 min", "45 min", "1 hour"],
  },
  {
    label: "Cuisine / Style",
    options: ["Italian", "Mexican", "Asian", "Mediterranean", "Comfort Food", "Healthy"],
  },
];

// Keyword aliases for fuzzy text matching (AND logic across all active filters)
const FILTER_KEYWORDS: Record<string, string[]> = {
  chicken: ["chicken", "pollo"],
  beef: ["beef", "steak", "burger", "brisket"],
  fish: ["fish", "salmon", "tuna", "cod", "halibut", "shrimp", "seafood", "prawn"],
  pork: ["pork", "bacon", "ham", "prosciutto", "chorizo"],
  tofu: ["tofu"],
  beans: ["bean", "lentil", "chickpea", "legume"],
  eggs: ["egg"],
  "15 min": ["15 min", "15-min", "15 minute", "quick", "fast"],
  "30 min": ["30 min", "30-min", "30 minute"],
  "45 min": ["45 min", "45-min", "45 minute"],
  "1 hour": ["1 hour", "1-hour", "60 min", "slow cook"],
  italian: ["italian", "pasta", "risotto", "pizza", "lasagna"],
  mexican: ["mexican", "taco", "burrito", "enchilada", "salsa", "guacamole"],
  asian: ["asian", "thai", "chinese", "japanese", "korean", "ramen", "stir-fry", "stir fry"],
  mediterranean: ["mediterranean", "greek", "hummus", "falafel"],
  "comfort food": ["comfort", "mac and cheese", "casserole", "stew", "soup", "chili"],
  healthy: ["healthy", "salad", "light", "vegan", "vegetarian", "grain bowl"],
};

function recipeMatchesFilters(recipe: RecipeBrowseItem, activeFilters: string[]): boolean {
  if (activeFilters.length === 0) return true;
  const haystack = [recipe.title, ...recipe.tags].join(" ").toLowerCase();
  return activeFilters.every((filter) => {
    const key = filter.toLowerCase();
    const keywords = FILTER_KEYWORDS[key] ?? [key];
    return keywords.some((kw) => haystack.includes(kw));
  });
}

function getCoverAnnotation(recipe: RecipeBrowseItem) {
  if (recipe.is_favorite) {
    return "Worth keeping.";
  }

  if (recipe.version_count > 1) {
    return `Refined ${recipe.version_count} times.`;
  }

  return "First saved version.";
}

export function RecipesBrowser({ initialRecipes, initialHasMore }: RecipesBrowserProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [tab, setTab] = useState<RecipeBrowseTab>("active");
  const [sortMode, setSortMode] = useState<RecipeBrowseSort>("recent");
  const [recipes, setRecipes] = useState<RecipeBrowseItem[]>(initialRecipes);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [savingRecipeId, setSavingRecipeId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [filtersPanelOpen, setFiltersPanelOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  function toggleFilter(option: string) {
    setActiveFilters((prev) =>
      prev.includes(option) ? prev.filter((f) => f !== option) : [...prev, option]
    );
  }

  const filteredRecipes = useMemo(
    () => recipes.filter((recipe) => recipeMatchesFilters(recipe, activeFilters)),
    [recipes, activeFilters]
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!openMenuId) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openMenuId]);

  const favorites = useMemo(
    () => recipes.filter((recipe) => recipe.is_favorite).sort((a, b) => a.title.localeCompare(b.title)).slice(0, 8),
    [recipes]
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadRecipes() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const params = new URLSearchParams({
          tab,
          sort: sortMode,
          search: deferredSearch.trim(),
          offset: "0",
          limit: String(PAGE_SIZE),
        });
        const response = await fetch(`/api/recipes/browse?${params.toString()}`, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          recipes?: RecipeBrowseItem[];
          hasMore?: boolean;
          error?: boolean;
          message?: string;
        };

        if (!response.ok || payload.error) {
          throw new Error(payload.message ?? "Could not load recipes.");
        }

        startTransition(() => {
          setRecipes(payload.recipes ?? []);
          setHasMore(Boolean(payload.hasMore));
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setLoadError(error instanceof Error ? error.message : "Could not load recipes.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadRecipes();

    return () => {
      controller.abort();
    };
  }, [deferredSearch, sortMode, tab]);

  async function setRecipeVisibility(recipeId: string, state: "hidden" | "archived" | null) {
    setSavingRecipeId(recipeId);
    setActionError(null);

    try {
      if (state === null) {
        const response = await fetch(`/api/recipes/${recipeId}/visibility`, {
          method: "DELETE",
        });
        if (!response.ok) {
          setActionError("Could not update recipe visibility.");
          return false;
        }
        return true;
      }

      const response = await fetch(`/api/recipes/${recipeId}/visibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state }),
      });

      if (!response.ok) {
        setActionError("Could not update recipe visibility.");
        return false;
      }

      return true;
    } finally {
      setSavingRecipeId(null);
    }
  }

  async function hideRecipe(recipeId: string) {
    const updated = await setRecipeVisibility(recipeId, "hidden");
    if (!updated) return;
    setRecipes((current) => current.filter((recipe) => recipe.id !== recipeId));
    router.refresh();
  }

  async function archiveRecipe(recipeId: string) {
    const updated = await setRecipeVisibility(recipeId, "archived");
    if (!updated) return;
    setRecipes((current) => current.filter((recipe) => recipe.id !== recipeId));
    router.refresh();
  }

  async function clearRecipeVisibility(recipeId: string) {
    const updated = await setRecipeVisibility(recipeId, null);
    if (!updated) return;
    setRecipes((current) => current.filter((recipe) => recipe.id !== recipeId));
    router.refresh();
  }

  async function loadMoreRecipes() {
    setIsLoadingMore(true);
    setLoadError(null);

    try {
      const params = new URLSearchParams({
        tab,
        sort: sortMode,
        search: deferredSearch.trim(),
        offset: String(recipes.length),
        limit: String(PAGE_SIZE),
      });
      const response = await fetch(`/api/recipes/browse?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        recipes?: RecipeBrowseItem[];
        hasMore?: boolean;
        error?: boolean;
        message?: string;
      };

      if (!response.ok || payload.error) {
        throw new Error(payload.message ?? "Could not load more recipes.");
      }

      setRecipes((current) => {
        const existingIds = new Set(current.map((recipe) => recipe.id));
        return current.concat((payload.recipes ?? []).filter((recipe) => !existingIds.has(recipe.id)));
      });
      setHasMore(Boolean(payload.hasMore));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load more recipes.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <section className="space-y-5">
      {isMounted
        ? createPortal(
            <>
              {filtersPanelOpen ? (
                <>
                  <div
                    className="fixed inset-0 z-40 hidden xl:block"
                    onClick={() => setFiltersPanelOpen(false)}
                  />
                  <div
                    className="fixed top-1/2 z-50 hidden max-h-[calc(100vh-100px)] w-[300px] -translate-y-1/2 overflow-y-auto rounded-[24px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.98)] p-5 shadow-[4px_8px_32px_rgba(52,70,63,0.12)] xl:block"
                    style={{ left: DESKTOP_RAIL_LEFT }}
                  >
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <div>
                        <p className="app-kicker">Filters</p>
                        <h2 className="mt-1.5 font-display text-[20px] font-semibold tracking-tight text-[color:var(--text)]">Filter your recipes</h2>
                        <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">Select any combination — only recipes matching all selected filters will show.</p>
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

                    {activeFilters.length > 0 ? (
                      <div className="mb-4 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[color:var(--primary)]">{activeFilters.length} active</p>
                        <button
                          type="button"
                          onClick={() => setActiveFilters([])}
                          className="text-xs font-semibold text-[color:var(--muted)] underline underline-offset-2 hover:text-[color:var(--text)]"
                        >
                          Clear all
                        </button>
                      </div>
                    ) : null}

                    <div className="space-y-5">
                      {FILTER_GROUPS.map((group) => (
                        <div key={group.label}>
                          <p className="mb-2 text-[13px] font-semibold text-[color:var(--text)]">{group.label}</p>
                          <div className="flex flex-wrap gap-2">
                            {group.options.map((option) => {
                              const active = activeFilters.includes(option);
                              return (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() => toggleFilter(option)}
                                  className={`rounded-full px-3 py-1.5 text-[13px] font-semibold transition ${
                                    active
                                      ? "bg-[color:var(--primary)] text-white"
                                      : "border border-[rgba(79,54,33,0.1)] bg-[rgba(111,102,95,0.06)] text-[color:var(--text)] hover:bg-[rgba(111,102,95,0.1)]"
                                  }`}
                                >
                                  {option}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setFiltersPanelOpen(true)}
                  className="fixed top-1/2 z-40 hidden -translate-y-1/2 hover:translate-y-[-50%] active:translate-y-[-50%] xl:flex"
                  style={{ left: DESKTOP_RAIL_LEFT }}
                  aria-label="Open filters panel"
                >
                  <div className="flex flex-col items-center gap-2 rounded-r-[16px] border border-l-0 border-[rgba(57,75,70,0.1)] bg-[rgba(255,253,249,0.96)] py-4 pl-2 pr-3 shadow-[2px_0_12px_rgba(52,70,63,0.08)] transition hover:bg-white">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-[color:var(--primary)]">
                      <path d="M5 2L10 7L5 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                      {activeFilters.length > 0 ? `${activeFilters.length} filter${activeFilters.length === 1 ? "" : "s"}` : "Filters"}
                    </p>
                  </div>
                </button>
              )}
            </>,
            document.body
          )
        : null}

      <section className="app-panel polish-card animate-rise-in p-4 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="app-kicker">My Recipes</p>
            <h1 className="mt-2 font-display text-[30px] font-semibold tracking-tight text-[color:var(--text)] min-[380px]:text-[34px] sm:text-[44px]">
              The dishes worth keeping live here.
            </h1>
            <p className="mt-3 text-[16px] leading-7 text-[color:var(--muted)]">
              Browse the recipes you have developed, revisit strong versions, and keep your collection organized around what actually works in your kitchen.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 justify-center rounded-full bg-[color:var(--primary)] px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-[color:var(--primary-strong)]"
            >
              Create New Dish
            </Link>
            <Link
              href="/import"
              className="inline-flex min-h-11 justify-center rounded-full border border-[rgba(57,75,70,0.08)] bg-[rgba(255,252,246,0.94)] px-4 py-2 text-[14px] font-semibold text-[color:var(--text)] transition hover:bg-white"
            >
              Import a Recipe
            </Link>
          </div>
        </div>
      </section>

      <section className="app-panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
          <label className="block xl:min-w-0 xl:flex-1">
            <span className="mb-2 block text-[15px] font-medium text-[color:var(--text)]">Search my recipes</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search dishes, ideas, or titles..." className="w-full" />
          </label>
          <div className="w-full xl:w-auto xl:min-w-[250px]">
            <div className="grid grid-cols-3 gap-2 rounded-[24px] border border-[rgba(57,75,70,0.06)] bg-[rgba(250,248,242,0.92)] p-1.5">
              {(["active", "hidden", "archived"] as RecipeBrowseTab[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={`rounded-full px-3 py-2 text-[14px] font-semibold capitalize transition ${
                    tab === value ? "bg-white text-[color:var(--text)] shadow-[0_6px_14px_rgba(52,70,63,0.06)]" : "text-[color:var(--muted)]"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <label className="block w-full xl:w-[220px] xl:shrink-0">
            <span className="mb-2 block text-[15px] font-medium text-[color:var(--text)]">Sort by</span>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as RecipeBrowseSort)}
              className="settings-field min-h-11 w-full"
            >
              <option value="recent">Recent</option>
              <option value="alphabetical">Alphabetical</option>
              <option value="favorites">Favorites</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-[24px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.72)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[15px] font-semibold text-[color:var(--text)]">
              {activeFilters.length > 0
                ? `${filteredRecipes.length} of ${recipes.length} recipe${recipes.length === 1 ? "" : "s"} match`
                : `${recipes.length} recipe${recipes.length === 1 ? "" : "s"} on this shelf`}
            </p>
            <p className="text-[14px] text-[color:var(--muted)]">
              {activeFilters.length > 0
                ? `${activeFilters.join(", ")} · `
                : ""}
              {hasMore ? "Load more when you want to keep browsing." : "You have reached the end of this shelf."}
            </p>
          </div>
          <p className="text-[14px] text-[color:var(--muted)]">
            {favorites.length > 0 ? `${favorites.length} favorites in view` : "No favorites in this view yet"}
          </p>
        </div>
        {actionError ? <p className="mt-3 text-sm text-red-600">{actionError}</p> : null}
      </section>

      {loadError ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{loadError}</div>
      ) : null}
      {isLoading ? (
        <div className="rounded-[24px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.72)] px-5 py-4 text-sm text-[color:var(--muted)]">Refreshing...</div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filteredRecipes.map((recipe, index) => (
          <article
            key={recipe.id}
            className="recipe-cover-wrap polish-card animate-rise-in relative overflow-hidden rounded-[28px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.92)] shadow-[0_12px_30px_rgba(52,70,63,0.07)] transition hover:-translate-y-px hover:shadow-[0_18px_36px_rgba(52,70,63,0.08)]"
          >
            {/* Stretched link covers the whole card */}
            <Link href={`/recipes/${recipe.id}`} className="absolute inset-0 z-0" aria-label={`Open ${recipe.title}`} />

            {/* Card content — pointer-events-none so clicks fall through to the link */}
            <div className="pointer-events-none">
              {recipe.cover_image_url ? (
                <Image src={recipe.cover_image_url} alt={`${recipe.title} cover`} width={640} height={480} unoptimized className="recipe-cover aspect-[4/3] w-full object-cover" />
              ) : (
                <div className={`editorial-frame aspect-[4/3] w-full ${index % 3 === 0 ? "cover-wash-saffron" : index % 3 === 1 ? "cover-wash-herb" : "cover-wash-tomato"}`}>
                  <div className="flex h-full items-end p-5">
                    <div className="annotation-note max-w-[15rem] px-4 py-2.5 shadow-[0_4px_10px_rgba(76,50,24,0.04)]">
                      <p className="font-annotate annotation-script text-[16px] leading-6">
                        {getCoverAnnotation(recipe)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div className="space-y-3 p-5">
                <div className="flex flex-wrap gap-2">
                  {recipe.is_favorite ? (
                    <span className="rounded-full bg-[rgba(201,123,66,0.12)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text)]">
                      Favorite
                    </span>
                  ) : null}
                  <span className="rounded-full bg-[rgba(79,125,115,0.1)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--primary)]">
                    {recipe.version_count} version{recipe.version_count === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="font-display text-[30px] font-semibold leading-[0.98] text-[color:var(--text)]">{recipe.title}</p>
                <div className="artifact-divider pt-3 text-[15px] text-[color:var(--muted)]">
                  <p>Last updated {recipe.updated_at ? new Date(recipe.updated_at).toLocaleDateString() : "-"}</p>
                  <p>Serves {typeof recipe.servings === "number" ? recipe.servings : "-"}</p>
                </div>
              </div>
            </div>

            {/* Actions row — z-10 so it sits above the stretched link */}
            <div className="artifact-divider relative z-10 flex items-center justify-between gap-3 px-5 py-4" ref={openMenuId === recipe.id ? menuRef : null}>
              <Link
                href={`/recipes/${recipe.id}`}
                className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-[color:var(--primary-strong)]"
              >
                Open
              </Link>
              <div className="relative">
                <button
                  type="button"
                  aria-label="More actions"
                  aria-expanded={openMenuId === recipe.id}
                  onClick={() => setOpenMenuId(openMenuId === recipe.id ? null : recipe.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(57,75,70,0.12)] bg-white text-[color:var(--muted)] transition hover:bg-[rgba(74,106,96,0.08)] hover:text-[color:var(--text)]"
                >
                  •••
                </button>
                {openMenuId === recipe.id ? (
                  <div className="absolute bottom-full right-0 z-20 mb-2 min-w-[190px] overflow-hidden rounded-[20px] border border-[rgba(57,75,70,0.1)] bg-white shadow-[0_16px_36px_rgba(52,70,63,0.14)]">
                    {recipe.latest_version_id ? (
                      <Link
                        href={`/recipes/${recipe.id}/versions/${recipe.latest_version_id}`}
                        className="block px-4 py-3 text-[14px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(74,106,96,0.06)]"
                        onClick={() => setOpenMenuId(null)}
                      >
                        Open Latest Version
                      </Link>
                    ) : null}
                    {recipe.latest_version_id ? (
                      <Link
                        href={`/recipes/${recipe.id}/versions/${recipe.latest_version_id}/grocery`}
                        className="block px-4 py-3 text-[14px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(74,106,96,0.06)]"
                        onClick={() => setOpenMenuId(null)}
                      >
                        Shopping List
                      </Link>
                    ) : null}
                    <Link
                      href={`/planner?recipe=${recipe.id}`}
                      className="block px-4 py-3 text-[14px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(74,106,96,0.06)]"
                      onClick={() => setOpenMenuId(null)}
                    >
                      Add to Plan
                    </Link>
                    <div className="mx-4 border-t border-[rgba(57,75,70,0.08)]" />
                    {tab === "hidden" || tab === "archived" ? (
                      <button
                        type="button"
                        onClick={() => { setOpenMenuId(null); void clearRecipeVisibility(recipe.id); }}
                        disabled={savingRecipeId === recipe.id}
                        className="block w-full px-4 py-3 text-left text-[14px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(74,106,96,0.06)] disabled:opacity-60"
                      >
                        {savingRecipeId === recipe.id ? "Saving..." : "Restore to My Recipes"}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => { setOpenMenuId(null); void hideRecipe(recipe.id); }}
                          disabled={savingRecipeId === recipe.id}
                          className="block w-full px-4 py-3 text-left text-[14px] font-semibold text-[color:var(--muted)] transition hover:bg-[rgba(74,106,96,0.06)] disabled:opacity-60"
                        >
                          {savingRecipeId === recipe.id ? "Saving..." : "Hide"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setOpenMenuId(null); void archiveRecipe(recipe.id); }}
                          disabled={savingRecipeId === recipe.id}
                          className="block w-full px-4 py-3 text-left text-[14px] font-semibold text-[color:var(--muted)] transition hover:bg-[rgba(74,106,96,0.06)] disabled:opacity-60"
                        >
                          {savingRecipeId === recipe.id ? "Saving..." : "Archive"}
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>

      {!isLoading && filteredRecipes.length === 0 ? (
        <div className="app-empty-state animate-rise-in px-6 py-10 text-center">
          <p className="app-kicker">My Recipes</p>
          <p className="mt-3 font-display text-[36px] font-semibold text-[color:var(--text)]">
            {activeFilters.length > 0
              ? "No recipes match these filters."
              : deferredSearch.trim()
              ? "No recipes match that search."
              : "Nothing is on this shelf yet."}
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-7 text-[color:var(--muted)]">
            {activeFilters.length > 0
              ? "Try removing a filter or two to widen the results."
              : deferredSearch.trim()
              ? "Try a different word, switch to another shelf, or clear the search to browse everything."
              : "Try another shelf, or add a new dish to the cookbook so this section starts to fill with recipes worth revisiting."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {activeFilters.length > 0 ? (
              <button type="button" onClick={() => setActiveFilters([])} className="ui-btn ui-btn-solid">
                Clear Filters
              </button>
            ) : deferredSearch.trim() ? (
              <button type="button" onClick={() => setSearch("")} className="ui-btn ui-btn-solid">
                Clear Search
              </button>
            ) : (
              <Link href="/dashboard" className="ui-btn ui-btn-solid">
                Create New Dish
              </Link>
            )}
            <Link href="/import" className="ui-btn ui-btn-light">
              Import a Recipe
            </Link>
          </div>
        </div>
      ) : null}

      {hasMore ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void loadMoreRecipes()}
            disabled={isLoadingMore}
            className={`min-w-[220px] rounded-full px-5 py-3 text-[15px] font-semibold transition ${
              isLoadingMore
                ? "bg-[rgba(141,169,187,0.14)] text-[color:var(--muted)]"
                : "bg-[color:var(--primary)] text-white hover:opacity-90"
            }`}
          >
            {isLoadingMore ? "Loading more..." : "Load More"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
