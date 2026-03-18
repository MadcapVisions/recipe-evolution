"use client";

import Image from "next/image";
import Link from "next/link";
import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RecipeBrowseItem, RecipeBrowseSort, RecipeBrowseTab } from "@/lib/recipeBrowseData";

type RecipesBrowserProps = {
  initialRecipes: RecipeBrowseItem[];
  initialHasMore: boolean;
};

const PAGE_SIZE = 24;

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
              {recipes.length} recipe{recipes.length === 1 ? "" : "s"} on this shelf
            </p>
            <p className="text-[14px] text-[color:var(--muted)]">
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
        {recipes.map((recipe, index) => (
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

      {!isLoading && recipes.length === 0 ? (
        <div className="app-empty-state animate-rise-in px-6 py-10 text-center">
          <p className="app-kicker">My Recipes</p>
          <p className="mt-3 font-display text-[36px] font-semibold text-[color:var(--text)]">
            {deferredSearch.trim() ? "No recipes match that search." : "Nothing is on this shelf yet."}
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-7 text-[color:var(--muted)]">
            {deferredSearch.trim()
              ? "Try a different word, switch to another shelf, or clear the search to browse everything."
              : "Try another shelf, or add a new dish to the cookbook so this section starts to fill with recipes worth revisiting."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {deferredSearch.trim() ? (
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
