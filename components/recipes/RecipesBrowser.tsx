"use client";

import Image from "next/image";
import Link from "next/link";
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { RecipeBrowseItem, RecipeBrowseSort, RecipeBrowseTab } from "@/lib/recipeBrowseData";

type RecipesBrowserProps = {
  initialRecipes: RecipeBrowseItem[];
  initialHasMore: boolean;
};

function chipClass(active: boolean) {
  return active
    ? "app-chip app-chip-active"
    : "app-chip border border-[rgba(57,75,70,0.08)] bg-[rgba(141,169,187,0.08)] hover:bg-[rgba(141,169,187,0.14)]";
}

const PAGE_SIZE = 24;

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
        <section className="app-panel p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="app-kicker">Library</p>
              <h1 className="mt-2 text-[40px] font-semibold tracking-tight text-[color:var(--text)]">Find the recipe you want fast.</h1>
              <p className="mt-3 max-w-2xl text-[16px] text-[color:var(--muted)]">
                Search, filter, and browse without navigating a second panel.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard"
                className="inline-flex rounded-full bg-[color:var(--primary)] px-4 py-2 text-[14px] font-semibold text-white transition hover:bg-[color:var(--primary-strong)]"
              >
                Ask Chef
              </Link>
              <Link
                href="/import"
                className="inline-flex rounded-full border border-[rgba(57,75,70,0.08)] bg-[rgba(141,169,187,0.08)] px-4 py-2 text-[14px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(141,169,187,0.14)]"
              >
                Import from Text
              </Link>
            </div>
          </div>
        </section>

        <section className="app-panel p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
            <label className="block xl:min-w-0 xl:flex-1">
              <span className="mb-2 block text-[15px] font-medium text-[color:var(--text)]">Search</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search recipes..." className="w-full" />
            </label>
            <div className="w-full xl:w-auto xl:min-w-[250px]">
              <p className="mb-2 text-[15px] font-medium text-[color:var(--text)]">View</p>
              <div className="grid grid-cols-3 gap-2 rounded-[24px] bg-[rgba(141,169,187,0.08)] p-1.5">
                {(["active", "hidden", "archived"] as RecipeBrowseTab[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTab(value)}
                    className={`rounded-full px-3 py-2 text-[14px] font-semibold capitalize transition ${
                      tab === value ? "bg-white text-[color:var(--text)] shadow-[0_8px_18px_rgba(52,70,63,0.08)]" : "text-[color:var(--muted)]"
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
                {recipes.length} recipe{recipes.length === 1 ? "" : "s"} loaded
              </p>
              <p className="text-[14px] text-[color:var(--muted)]">
                {hasMore ? "Load more when you want to keep browsing." : "You have reached the end of this view."}
              </p>
            </div>
            <p className="text-[14px] text-[color:var(--muted)]">
              {favorites.length > 0 ? `${favorites.length} favorites in this view` : "No favorites in this view yet"}
            </p>
          </div>
          {actionError ? <p className="mt-3 text-sm text-red-600">{actionError}</p> : null}
        </section>

        {loadError ? <p className="text-sm text-red-600">{loadError}</p> : null}
        {isLoading ? <p className="text-sm text-[color:var(--muted)]">Refreshing recipes...</p> : null}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe, index) => (
            <article
              key={recipe.id}
              className="overflow-hidden rounded-[28px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.92)] shadow-[0_12px_30px_rgba(52,70,63,0.07)] transition hover:-translate-y-px hover:shadow-[0_18px_36px_rgba(52,70,63,0.08)]"
            >
              <Link href={`/recipes/${recipe.id}`} className="block">
                {recipe.cover_image_url ? (
                  <Image src={recipe.cover_image_url} alt={`${recipe.title} cover`} width={640} height={480} unoptimized className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <div
                    className={`aspect-[4/3] w-full ${
                      index % 2 === 0 ? "bg-gradient-to-br from-[#dce7e3] to-[#f0ede4]" : "bg-gradient-to-br from-[#dbe7ef] to-[#e8efe6]"
                    }`}
                  />
                )}
                <div className="space-y-2 p-5">
                  <p className="text-[20px] font-semibold text-[color:var(--text)]">
                    {recipe.is_favorite ? "★ " : ""}
                    {recipe.title}
                  </p>
                  <p className="text-[15px] text-[color:var(--muted)]">
                    Last updated {recipe.updated_at ? new Date(recipe.updated_at).toLocaleDateString() : "-"}
                  </p>
                  <p className="text-[15px] text-[color:var(--muted)]">
                    Serves: {typeof recipe.servings === "number" ? recipe.servings : "-"}
                  </p>
                  <p className="text-[15px] text-[color:var(--muted)]">Versions: {recipe.version_count}</p>
                </div>
              </Link>
              <div className="flex flex-wrap gap-2 border-t border-[rgba(57,75,70,0.08)] px-5 py-4">
                {recipe.latest_version_id ? (
                  <Link
                    href={`/recipes/${recipe.id}/versions/${recipe.latest_version_id}/grocery`}
                    className="rounded-full border border-[rgba(57,75,70,0.12)] bg-white px-4 py-2 text-[14px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(141,169,187,0.08)]"
                  >
                    Shopping List
                  </Link>
                ) : null}
                <Link
                  href={`/planner?recipe=${recipe.id}`}
                  className="rounded-full border border-[rgba(57,75,70,0.12)] bg-white px-4 py-2 text-[14px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(141,169,187,0.08)]"
                >
                  Add to Plan
                </Link>
                {tab === "hidden" ? (
                  <button
                    type="button"
                    onClick={() => void clearRecipeVisibility(recipe.id)}
                    disabled={savingRecipeId === recipe.id}
                    className="rounded-full border border-[rgba(57,75,70,0.12)] bg-white px-4 py-2 text-[14px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(141,169,187,0.08)] disabled:opacity-60"
                  >
                    {savingRecipeId === recipe.id ? "Saving..." : "Unhide"}
                  </button>
                ) : tab === "archived" ? (
                  <button
                    type="button"
                    onClick={() => void clearRecipeVisibility(recipe.id)}
                    disabled={savingRecipeId === recipe.id}
                    className="rounded-full border border-[rgba(57,75,70,0.12)] bg-white px-4 py-2 text-[14px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(141,169,187,0.08)] disabled:opacity-60"
                  >
                    {savingRecipeId === recipe.id ? "Saving..." : "Unarchive"}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void hideRecipe(recipe.id)}
                      disabled={savingRecipeId === recipe.id}
                      className="rounded-full border border-[rgba(57,75,70,0.12)] bg-white px-4 py-2 text-[14px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(141,169,187,0.08)] disabled:opacity-60"
                    >
                      {savingRecipeId === recipe.id ? "Saving..." : "Hide"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void archiveRecipe(recipe.id)}
                      disabled={savingRecipeId === recipe.id}
                      className="rounded-full border border-[rgba(57,75,70,0.12)] bg-white px-4 py-2 text-[14px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(141,169,187,0.08)] disabled:opacity-60"
                    >
                      {savingRecipeId === recipe.id ? "Saving..." : "Archive"}
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
        {!isLoading && recipes.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[rgba(57,75,70,0.12)] bg-[rgba(255,253,249,0.72)] px-6 py-10 text-center">
            <p className="text-[17px] font-semibold text-[color:var(--text)]">No recipes in this view.</p>
            <p className="mt-2 text-[15px] text-[color:var(--muted)]">Try a different tab, remove the search, or create a new recipe.</p>
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
              {isLoadingMore ? "Loading more..." : "Load more recipes"}
            </button>
          </div>
        ) : null}
    </section>
  );
}
