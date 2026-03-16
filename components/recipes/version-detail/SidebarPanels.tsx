"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/Button";
import { versionLabel, type RecipeListItem, type RecipeRow, type TimelineVersion, type VersionRow } from "@/components/recipes/version-detail/types";

type MenuAnchor = { top: number; left: number };

type RecipeActionMenuProps = {
  activeRecipe: RecipeListItem | null;
  menuAnchor: MenuAnchor | null;
  deletingRecipeId: string | null;
  onClose: () => void;
  onDelete: (recipeId: string, title: string) => void;
  onHide: (recipeId: string) => void;
  onArchive: (recipeId: string) => void;
};

export function RecipeActionMenu({
  activeRecipe,
  menuAnchor,
  deletingRecipeId,
  onClose,
  onDelete,
  onHide,
  onArchive,
}: RecipeActionMenuProps) {
  if (!activeRecipe || !menuAnchor) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(35,49,45,0.12)]" onClick={onClose}>
      <div
        className="absolute w-full max-w-xs rounded-[24px] border border-[rgba(57,75,70,0.12)] bg-[rgba(255,253,249,0.98)] p-2 shadow-[0_18px_40px_rgba(52,70,63,0.12)]"
        style={{ top: menuAnchor.top, left: menuAnchor.left }}
        onClick={(event) => event.stopPropagation()}
      >
        <MenuButton onClick={() => onHide(activeRecipe.id)}>Hide</MenuButton>
        <MenuButton onClick={() => onArchive(activeRecipe.id)}>Archive</MenuButton>
        <MenuButton danger disabled={deletingRecipeId === activeRecipe.id} onClick={() => onDelete(activeRecipe.id, activeRecipe.title)}>
          {deletingRecipeId === activeRecipe.id ? "Deleting..." : "Delete"}
        </MenuButton>
        <MenuButton secondary onClick={onClose}>
          Cancel
        </MenuButton>
      </div>
    </div>
  );
}

type VersionActionMenuProps = {
  activeVersion: TimelineVersion | null;
  versionMenuAnchor: MenuAnchor | null;
  bestVersionId?: string | null;
  onClose: () => void;
  onRename: (versionId: string, currentLabel: string | null) => void;
  onFavorite: (versionId: string) => void;
  onDelete: (versionId: string) => void;
};

export function VersionActionMenu({
  activeVersion,
  versionMenuAnchor,
  bestVersionId,
  onClose,
  onRename,
  onFavorite,
  onDelete,
}: VersionActionMenuProps) {
  if (!activeVersion || !versionMenuAnchor) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(35,49,45,0.12)]" onClick={onClose}>
      <div
        className="absolute w-full max-w-xs rounded-[24px] border border-[rgba(57,75,70,0.12)] bg-[rgba(255,253,249,0.98)] p-2 shadow-[0_18px_40px_rgba(52,70,63,0.12)]"
        style={{ top: versionMenuAnchor.top, left: versionMenuAnchor.left }}
        onClick={(event) => event.stopPropagation()}
      >
        <MenuButton onClick={() => onRename(activeVersion.id, activeVersion.version_label)}>Rename</MenuButton>
        <MenuButton onClick={() => onFavorite(activeVersion.id)}>
          {bestVersionId === activeVersion.id ? "Unfavorite Version" : "Favorite Version"}
        </MenuButton>
        <MenuButton danger onClick={() => onDelete(activeVersion.id)}>
          Delete
        </MenuButton>
        <MenuButton secondary onClick={onClose}>
          Cancel
        </MenuButton>
      </div>
    </div>
  );
}

type RecipeSidebarProps = {
  currentRecipeId: string;
  currentVersion: VersionRow;
  recipe: RecipeRow;
  recipeSearch: string;
  searchResults: RecipeListItem[];
  timelineVersions: TimelineVersion[];
  timelineHasMore: boolean;
  timelineLoadingMore: boolean;
  sidebarActionError: string | null;
  onRecipeSearchChange: (value: string) => void;
  onRecipeNavigate: (recipeId: string) => void;
  onVersionNavigate: (versionId: string) => void;
  onLoadMoreVersions: () => void;
  onOpenRecipeMenu: (recipeId: string, rect: DOMRect) => void;
  onOpenVersionMenu: (versionId: string, rect: DOMRect) => void;
};

export function RecipeSidebar({
  currentRecipeId,
  currentVersion,
  recipe,
  recipeSearch,
  searchResults,
  timelineVersions,
  timelineHasMore,
  timelineLoadingMore,
  sidebarActionError,
  onRecipeSearchChange,
  onRecipeNavigate,
  onVersionNavigate,
  onLoadMoreVersions,
  onOpenRecipeMenu,
  onOpenVersionMenu,
}: RecipeSidebarProps) {
  return (
    <aside className="flex flex-col gap-4">
      <section className="app-panel p-4 sm:p-5">
        <p className="app-kicker">Cookbook</p>
        <p className="mt-2 font-display text-[22px] font-semibold leading-tight text-[color:var(--text)] sm:text-[26px]">{recipe.title}</p>
        <p className="mt-2 text-sm text-[color:var(--muted)]">Move across your saved dishes without losing the version context of this one.</p>
        <input
          type="text"
          value={recipeSearch}
          onChange={(event) => onRecipeSearchChange(event.target.value)}
          placeholder="Jump to another recipe..."
          className="mt-4 w-full"
        />
        <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1 sm:max-h-80 sm:space-y-3">
          {recipeSearch.trim().length > 0 && searchResults.length === 0 ? (
            <p className="text-sm text-[color:var(--muted)]">No matches in this quick list. Open the cookbook to search everything.</p>
          ) : null}
          {searchResults.map((userRecipe) => {
            const isActive = userRecipe.id === currentRecipeId;
            return (
              <div
                key={userRecipe.id}
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
                    <button type="button" onClick={() => onRecipeNavigate(userRecipe.id)} className="mt-2 block w-full text-left text-[14px] font-medium sm:text-[15px]">
                      {userRecipe.title}
                    </button>
                  </div>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onOpenRecipeMenu(userRecipe.id, event.currentTarget.getBoundingClientRect());
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onOpenRecipeMenu(userRecipe.id, (event.currentTarget as HTMLElement).getBoundingClientRect());
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
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
        {sidebarActionError ? <p className="mt-3 text-sm text-red-600">{sidebarActionError}</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button href="/recipes" variant="secondary" className="w-full justify-center">
            Cookbook
          </Button>
          <Button href="/dashboard" variant="secondary" className="w-full justify-center">
            Ask Chef
          </Button>
        </div>
      </section>

      <section className="app-panel p-4 sm:p-5">
        <p className="app-kicker">Version rail</p>
        <p className="mt-2 text-sm text-[color:var(--muted)]">Follow the progression of this dish from the original build through each saved iteration.</p>
        <div className="mt-4 space-y-2">
          {timelineVersions.map((timelineVersion) => {
            const isActive = timelineVersion.id === currentVersion.id;
            const isBest = recipe.best_version_id === timelineVersion.id;
            const stageLabel = timelineVersion.version_number === 1 ? "Original build" : `Iteration ${timelineVersion.version_number}`;
            return (
              <div
                key={timelineVersion.id}
                className={`rounded-[20px] p-3 transition ${
                  isActive
                    ? "border border-[rgba(82,124,116,0.18)] bg-[linear-gradient(135deg,rgba(79,125,115,0.12)_0%,rgba(255,251,245,0.98)_100%)]"
                    : "border border-[rgba(57,75,70,0.06)] bg-[rgba(255,253,249,0.84)] hover:bg-white"
                }`}
              >
                <div className="flex items-start gap-2">
                  <button type="button" onClick={() => onVersionNavigate(timelineVersion.id)} className="flex-1 text-left">
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
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">{stageLabel}</p>
                    <p className="mt-2 text-sm text-[color:var(--muted)]">
                      {timelineVersion.change_summary?.trim().length
                        ? timelineVersion.change_summary
                        : "No change note saved for this version."}
                    </p>
                    <p className="mt-2 text-xs text-[color:var(--muted)]">{new Date(timelineVersion.created_at).toLocaleDateString()}</p>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(event) => {
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
      </section>
    </aside>
  );
}

function MenuButton({
  children,
  onClick,
  danger = false,
  secondary = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const className = secondary
    ? "w-full rounded-[20px] border border-[rgba(57,75,70,0.12)] px-3 py-2.5 text-left text-sm font-medium text-[color:var(--muted)] transition hover:bg-[rgba(141,169,187,0.08)]"
    : danger
      ? "w-full rounded-[20px] px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
      : "w-full rounded-[20px] px-3 py-2.5 text-left text-sm font-medium text-[color:var(--text)] transition hover:bg-[rgba(141,169,187,0.08)]";

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}
