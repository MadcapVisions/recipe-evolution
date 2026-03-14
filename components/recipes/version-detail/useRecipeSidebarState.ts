"use client";

import { useMemo, useState } from "react";
import type { RecipeListItem } from "@/components/recipes/version-detail/types";

export function useRecipeSidebarState(input: {
  quickRecipes: RecipeListItem[];
}) {
  const [recipeSearch, setRecipeSearch] = useState("");
  const [deletingRecipeId, setDeletingRecipeId] = useState<string | null>(null);
  const [openMenuRecipeId, setOpenMenuRecipeId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null);
  const [sidebarActionError, setSidebarActionError] = useState<string | null>(null);
  const [openVersionMenuId, setOpenVersionMenuId] = useState<string | null>(null);
  const [versionMenuAnchor, setVersionMenuAnchor] = useState<{ top: number; left: number } | null>(null);

  const searchResults = useMemo(() => {
    const q = recipeSearch.trim().toLowerCase();
    if (!q) {
      return input.quickRecipes;
    }

    return input.quickRecipes.filter((recipeItem) => {
      const tagsText = Array.isArray(recipeItem.tags) ? recipeItem.tags.join(" ").toLowerCase() : "";
      return recipeItem.title.toLowerCase().includes(q) || tagsText.includes(q);
    });
  }, [recipeSearch, input.quickRecipes]);

  return {
    recipeSearch,
    setRecipeSearch,
    deletingRecipeId,
    setDeletingRecipeId,
    openMenuRecipeId,
    setOpenMenuRecipeId,
    menuAnchor,
    setMenuAnchor,
    sidebarActionError,
    setSidebarActionError,
    openVersionMenuId,
    setOpenVersionMenuId,
    versionMenuAnchor,
    setVersionMenuAnchor,
    searchResults,
  };
}
