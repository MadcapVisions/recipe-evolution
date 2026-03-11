"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type BrowserRecipe = {
  id: string;
  title: string;
  updated_at: string | null;
  is_favorite?: boolean;
  version_count: number;
  cover_image_url?: string | null;
  tags?: string[] | null;
};

type SortMode = "recent" | "alphabetical" | "most_versions" | "favorites";
type RecipeTab = "active" | "hidden" | "archived";
type CategoryFilter =
  | "all"
  | "beef"
  | "poultry"
  | "pork"
  | "seafood"
  | "vegetarian"
  | "pasta"
  | "salads"
  | "soups_stews"
  | "casseroles"
  | "breads"
  | "desserts";

type RecipesBrowserProps = {
  ownerId: string;
  recipes: BrowserRecipe[];
  initialVisibilityStates: Array<{
    recipe_id: string;
    state: "hidden" | "archived";
  }>;
};

const CATEGORY_OPTIONS: Array<{ key: CategoryFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "beef", label: "Beef" },
  { key: "poultry", label: "Poultry" },
  { key: "pork", label: "Pork" },
  { key: "seafood", label: "Seafood" },
  { key: "vegetarian", label: "Vegetarian" },
  { key: "pasta", label: "Pasta" },
  { key: "salads", label: "Salads" },
  { key: "soups_stews", label: "Soups/Stews" },
  { key: "casseroles", label: "Casseroles" },
  { key: "breads", label: "Breads" },
  { key: "desserts", label: "Desserts" },
];

function matchesCategoryFilter(recipe: BrowserRecipe, filter: CategoryFilter): boolean {
  if (filter === "all") return true;
  const haystack = `${recipe.title} ${(recipe.tags ?? []).join(" ")}`.toLowerCase();
  if (filter === "beef") return haystack.includes("beef") || haystack.includes("steak");
  if (filter === "poultry") return haystack.includes("chicken") || haystack.includes("turkey");
  if (filter === "pork") return haystack.includes("pork") || haystack.includes("bacon") || haystack.includes("ham");
  if (filter === "seafood") {
    return haystack.includes("seafood") || haystack.includes("fish") || haystack.includes("salmon") || haystack.includes("shrimp");
  }
  if (filter === "vegetarian") {
    return haystack.includes("vegetarian") || haystack.includes("veggie") || haystack.includes("tofu") || haystack.includes("chickpea");
  }
  if (filter === "pasta") return haystack.includes("pasta") || haystack.includes("noodle");
  if (filter === "salads") return haystack.includes("salad");
  if (filter === "soups_stews") return haystack.includes("soup") || haystack.includes("stew");
  if (filter === "casseroles") return haystack.includes("casserole") || haystack.includes("bake");
  if (filter === "breads") return haystack.includes("bread") || haystack.includes("sandwich");
  if (filter === "desserts") {
    return haystack.includes("dessert") || haystack.includes("cake") || haystack.includes("pie") || haystack.includes("cookie") || haystack.includes("flan");
  }
  return true;
}

function chipClass(active: boolean) {
  return active
    ? "app-chip app-chip-active"
    : "app-chip border border-[rgba(57,75,70,0.08)] bg-[rgba(141,169,187,0.08)] hover:bg-[rgba(141,169,187,0.14)]";
}

export function RecipesBrowser({ ownerId, recipes, initialVisibilityStates }: RecipesBrowserProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<RecipeTab>("active");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [hiddenRecipeIds, setHiddenRecipeIds] = useState<string[]>(
    initialVisibilityStates.filter((state) => state.state === "hidden").map((state) => state.recipe_id)
  );
  const [archivedRecipeIds, setArchivedRecipeIds] = useState<string[]>(
    initialVisibilityStates.filter((state) => state.state === "archived").map((state) => state.recipe_id)
  );
  const [savingRecipeId, setSavingRecipeId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const favorites = useMemo(
    () => recipes.filter((recipe) => recipe.is_favorite).sort((a, b) => a.title.localeCompare(b.title)).slice(0, 8),
    [recipes]
  );

  const visibleRecipes = useMemo(() => {
    const q = search.trim().toLowerCase();
    let next = recipes.filter((recipe) => {
      const hidden = hiddenRecipeIds.includes(recipe.id);
      const archived = archivedRecipeIds.includes(recipe.id);

      if (tab === "active" && (hidden || archived)) return false;
      if (tab === "hidden" && !hidden) return false;
      if (tab === "archived" && !archived) return false;
      if (!matchesCategoryFilter(recipe, categoryFilter)) return false;
      if (q && !recipe.title.toLowerCase().includes(q)) return false;
      return true;
    });

    if (sortMode === "alphabetical") {
      next = [...next].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortMode === "most_versions") {
      next = [...next].sort((a, b) => b.version_count - a.version_count);
    } else if (sortMode === "favorites") {
      next = [...next].sort((a, b) => Number(Boolean(b.is_favorite)) - Number(Boolean(a.is_favorite)));
    } else {
      next = [...next].sort((a, b) => {
        const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return bTime - aTime;
      });
    }

    return next;
  }, [archivedRecipeIds, categoryFilter, hiddenRecipeIds, recipes, search, sortMode, tab]);

  async function setRecipeVisibility(recipeId: string, state: "hidden" | "archived" | null) {
    setSavingRecipeId(recipeId);
    setActionError(null);

    try {
      if (state === null) {
        const { error } = await supabase.from("recipe_visibility_states").delete().eq("owner_id", ownerId).eq("recipe_id", recipeId);
        if (error) {
          setActionError("Could not update recipe visibility.");
          return false;
        }
        return true;
      }

      const { error } = await supabase.from("recipe_visibility_states").upsert(
        { owner_id: ownerId, recipe_id: recipeId, state },
        { onConflict: "owner_id,recipe_id" }
      );

      if (error) {
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
    setHiddenRecipeIds((current) => (current.includes(recipeId) ? current : [...current, recipeId]));
    setArchivedRecipeIds((current) => current.filter((value) => value !== recipeId));
    router.refresh();
  }

  async function archiveRecipe(recipeId: string) {
    const updated = await setRecipeVisibility(recipeId, "archived");
    if (!updated) return;
    setArchivedRecipeIds((current) => (current.includes(recipeId) ? current : [...current, recipeId]));
    setHiddenRecipeIds((current) => current.filter((value) => value !== recipeId));
    router.refresh();
  }

  async function clearRecipeVisibility(recipeId: string) {
    const updated = await setRecipeVisibility(recipeId, null);
    if (!updated) return;
    setHiddenRecipeIds((current) => current.filter((value) => value !== recipeId));
    setArchivedRecipeIds((current) => current.filter((value) => value !== recipeId));
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)_290px]">
      <aside className="space-y-4">
        <section className="app-panel p-5">
          <p className="app-kicker">Browse</p>
          <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-[color:var(--text)]">Recipe library</h2>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search recipes..." className="mt-4 w-full" />
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-[24px] bg-[rgba(141,169,187,0.08)] p-1.5">
            {(["active", "hidden", "archived"] as RecipeTab[]).map((value) => (
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
          <div className="mt-5 space-y-2">
            {visibleRecipes.slice(0, 7).map((recipe) => (
              <Link
                key={`nav-${recipe.id}`}
                href={`/recipes/${recipe.id}`}
                className="block rounded-[22px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.84)] px-4 py-3 text-[15px] font-medium text-[color:var(--text)] transition hover:bg-white"
              >
                {recipe.is_favorite ? "★ " : ""}
                {recipe.title}
              </Link>
            ))}
            {visibleRecipes.length === 0 ? <p className="text-sm text-[color:var(--muted)]">No recipes found.</p> : null}
          </div>
          {actionError ? <p className="mt-3 text-sm text-red-600">{actionError}</p> : null}
        </section>

        <section className="app-panel p-5">
          <p className="app-kicker">Saved</p>
          <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-[color:var(--text)]">Favorites</h2>
          <div className="mt-4 space-y-2">
            {favorites.map((recipe) => (
              <Link
                key={`favorite-${recipe.id}`}
                href={`/recipes/${recipe.id}`}
                className="block rounded-[22px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.84)] px-4 py-3 text-[15px] font-medium text-[color:var(--text)] transition hover:bg-white"
              >
                ★ {recipe.title}
              </Link>
            ))}
            {favorites.length === 0 ? <p className="text-sm text-[color:var(--muted)]">No favorites yet.</p> : null}
          </div>
        </section>
      </aside>

      <section className="space-y-5">
        <section className="app-panel p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="app-kicker">All recipes</p>
              <h1 className="mt-2 text-[40px] font-semibold tracking-tight text-[color:var(--text)]">Find the recipe you want fast.</h1>
              <p className="mt-2 text-[16px] leading-7 text-[color:var(--muted)]">
                Browse by category, sort by recency, or open favorites from the side rail.
              </p>
            </div>
            <div className="rounded-[24px] bg-[rgba(141,169,187,0.08)] px-4 py-3 text-[15px] text-[color:var(--muted)]">
              {visibleRecipes.length} recipe{visibleRecipes.length === 1 ? "" : "s"} shown
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((category) => (
              <button key={category.key} type="button" onClick={() => setCategoryFilter(category.key)} className={chipClass(categoryFilter === category.key)}>
                {category.label}
              </button>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {visibleRecipes.map((recipe, index) => (
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
                  <p className="text-[15px] text-[color:var(--muted)]">Versions: {recipe.version_count}</p>
                </div>
              </Link>
              <div className="flex flex-wrap gap-2 border-t border-[rgba(57,75,70,0.08)] px-5 py-4">
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
      </section>

      <aside className="space-y-4">
        <section className="app-panel p-5">
          <p className="app-kicker">Sort</p>
          <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-[color:var(--text)]">Sort by</h2>
          <div className="mt-4 space-y-2">
            {[
              { key: "recent", label: "Recent" },
              { key: "alphabetical", label: "Alphabetical" },
              { key: "most_versions", label: "Most versions" },
              { key: "favorites", label: "Favorites" },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setSortMode(option.key as SortMode)}
                className={`w-full rounded-[22px] px-4 py-3 text-left text-[15px] font-semibold transition ${
                  sortMode === option.key
                    ? "bg-[linear-gradient(135deg,var(--primary)_0%,var(--accent)_100%)] text-white"
                    : "border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.84)] text-[color:var(--text)] hover:bg-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="app-panel p-5">
          <p className="app-kicker">Filters</p>
          <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-[color:var(--text)]">Category</h2>
          <div className="mt-4 space-y-2">
            {CATEGORY_OPTIONS.filter((option) => option.key !== "all").map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setCategoryFilter(option.key)}
                className={`w-full rounded-[22px] px-4 py-3 text-left text-[15px] font-semibold transition ${
                  categoryFilter === option.key
                    ? "bg-[linear-gradient(135deg,var(--primary)_0%,var(--accent)_100%)] text-white"
                    : "border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.84)] text-[color:var(--text)] hover:bg-white"
                }`}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className="w-full rounded-[22px] border border-[rgba(57,75,70,0.12)] bg-white px-4 py-3 text-left text-[15px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(141,169,187,0.08)]"
            >
              Clear filters
            </button>
          </div>
        </section>

        <section className="app-panel p-5">
          <p className="app-kicker">Visibility</p>
          <p className="mt-3 rounded-[22px] bg-[rgba(141,169,187,0.08)] px-4 py-4 text-[15px] leading-7 text-[color:var(--muted)]">
            Hidden and archived recipes stay attached to your account and stay consistent across pages.
          </p>
        </section>
      </aside>
    </div>
  );
}
