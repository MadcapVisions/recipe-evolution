"use client";

import { useMemo, useState } from "react";
import type { RecipeListItem } from "@/components/recipes/version-detail/types";

export function useRecipeSidebarState(input: {
  userRecipes: RecipeListItem[];
  hiddenRecipeIds: string[];
  archivedRecipeIds: string[];
}) {
  const [recipeSearch, setRecipeSearch] = useState("");
  const [deletingRecipeId, setDeletingRecipeId] = useState<string | null>(null);
  const [openMenuRecipeId, setOpenMenuRecipeId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null);
  const [recipeListView, setRecipeListView] = useState<"active" | "hidden" | "archived">("active");
  const [sidebarActionError, setSidebarActionError] = useState<string | null>(null);
  const [openVersionMenuId, setOpenVersionMenuId] = useState<string | null>(null);
  const [versionMenuAnchor, setVersionMenuAnchor] = useState<{ top: number; left: number } | null>(null);

  const categorizedRecipes = useMemo(() => {
    const q = recipeSearch.trim().toLowerCase();
    const matchesSearch = (recipeItem: RecipeListItem) => {
      if (!q) {
        return true;
      }
      const tagsText = Array.isArray(recipeItem.tags) ? recipeItem.tags.join(" ").toLowerCase() : "";
      return recipeItem.title.toLowerCase().includes(q) || tagsText.includes(q);
    };

    const inCurrentView = (recipeItem: RecipeListItem) => {
      const isHidden = input.hiddenRecipeIds.includes(recipeItem.id);
      const isArchived = input.archivedRecipeIds.includes(recipeItem.id);
      if (recipeListView === "hidden") {
        return isHidden;
      }
      if (recipeListView === "archived") {
        return isArchived;
      }
      return !isHidden && !isArchived;
    };

    const filteredRecipes = input.userRecipes.filter((recipeItem) => inCurrentView(recipeItem) && matchesSearch(recipeItem));
    const groups = new Map<string, RecipeListItem[]>();

    const getCategory = (recipeItem: RecipeListItem) => {
      const haystack = `${recipeItem.title} ${Array.isArray(recipeItem.tags) ? recipeItem.tags.join(" ") : ""}`.toLowerCase();
      if (haystack.includes("dessert") || haystack.includes("cake") || haystack.includes("cookie") || haystack.includes("flan")) {
        return "Desserts";
      }
      if (haystack.includes("chicken") || haystack.includes("beef") || haystack.includes("pork") || haystack.includes("protein")) {
        return "Protein Dishes";
      }
      if (haystack.includes("shrimp") || haystack.includes("fish") || haystack.includes("salmon") || haystack.includes("seafood")) {
        return "Seafood";
      }
      if (haystack.includes("vegetarian") || haystack.includes("veggie") || haystack.includes("salad")) {
        return "Vegetarian";
      }
      if (haystack.includes("spicy") || haystack.includes("chili") || haystack.includes("sriracha")) {
        return "Spicy";
      }
      return "Other";
    };

    for (const recipeItem of filteredRecipes) {
      const category = getCategory(recipeItem);
      const current = groups.get(category) ?? [];
      current.push(recipeItem);
      groups.set(category, current);
    }

    const order = ["Protein Dishes", "Seafood", "Vegetarian", "Spicy", "Desserts", "Other"];
    return order.filter((category) => groups.has(category)).map((category) => ({ category, recipes: groups.get(category) ?? [] }));
  }, [recipeSearch, recipeListView, input.userRecipes, input.hiddenRecipeIds, input.archivedRecipeIds]);

  return {
    recipeSearch,
    setRecipeSearch,
    deletingRecipeId,
    setDeletingRecipeId,
    openMenuRecipeId,
    setOpenMenuRecipeId,
    menuAnchor,
    setMenuAnchor,
    recipeListView,
    setRecipeListView,
    sidebarActionError,
    setSidebarActionError,
    openVersionMenuId,
    setOpenVersionMenuId,
    versionMenuAnchor,
    setVersionMenuAnchor,
    categorizedRecipes,
  };
}
