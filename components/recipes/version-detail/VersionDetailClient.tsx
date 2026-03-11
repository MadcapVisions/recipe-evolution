"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ChefAiPanel, MetricsPanel, NutritionPanel } from "@/components/recipes/version-detail/AiPanels";
import { VersionMainPanels } from "@/components/recipes/version-detail/MainPanels";
import { RecipeActionMenu, RecipeSidebar, VersionActionMenu } from "@/components/recipes/version-detail/SidebarPanels";
import { useRecipeAssistant } from "@/components/recipes/version-detail/useRecipeAssistant";
import { useRecipeSidebarState } from "@/components/recipes/version-detail/useRecipeSidebarState";
import {
  buildVersionLabelFromInstruction,
  normalizeIngredients,
  normalizeSteps,
  versionLabel,
  type ConversationMessage,
  type RecipeListItem,
  type RecipeRow,
  type SuggestedChange,
  type TimelineVersion,
  type VersionRow,
} from "@/components/recipes/version-detail/types";
import type { RecipeSidebarData } from "@/lib/recipeSidebarData";
import type { VersionDetailData } from "@/lib/versionDetailData";

export function VersionDetailClient({
  recipeId,
  versionId,
  initialData,
}: {
  recipeId: string;
  versionId: string;
  initialData: VersionDetailData;
}) {
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeRow | null>(initialData.recipe);
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [sidebarData, setSidebarData] = useState<RecipeSidebarData>({
    userRecipes: [],
    hiddenRecipeIds: [],
    archivedRecipeIds: [],
  });
  const [timelineVersions, setTimelineVersions] = useState<TimelineVersion[]>(initialData.timelineVersions);
  const [version, setVersion] = useState<VersionRow | null>(initialData.version);
  const [userId] = useState<string | null>(initialData.userId);
  const [photosWithUrls, setPhotosWithUrls] = useState<Array<{ id: string; signedUrl: string; storagePath: string }>>(initialData.photosWithUrls);
  const assistant = useRecipeAssistant(recipeId);
  const sidebar = useRecipeSidebarState({
    userRecipes: sidebarData.userRecipes,
    hiddenRecipeIds: sidebarData.hiddenRecipeIds,
    archivedRecipeIds: sidebarData.archivedRecipeIds,
  });

  const ingredients = useMemo(() => normalizeIngredients(version?.ingredients_json), [version]);
  const steps = useMemo(() => normalizeSteps(version?.steps_json), [version]);
  const prepMinutes = typeof version?.prep_time_min === "number" && version.prep_time_min > 0 ? version.prep_time_min : 15;
  const cookMinutes = typeof version?.cook_time_min === "number" && version.cook_time_min > 0 ? version.cook_time_min : 25;
  const totalMinutes = prepMinutes + cookMinutes;
  const servings = typeof version?.servings === "number" ? version.servings : 4;
  const difficulty = version?.difficulty?.trim() || "Easy";
  const recentRecipeItems = useMemo(() => sidebarData.userRecipes.slice(0, 4), [sidebarData.userRecipes]);
  const favoriteRecipeItems = useMemo(
    () => sidebarData.userRecipes.filter((recipeItem) => recipeItem.is_favorite).slice(0, 4),
    [sidebarData.userRecipes]
  );
  const nutrition = useMemo(() => {
    const ingredientCount = Math.max(ingredients.length, 1);
    return {
      calories: ingredientCount * 55,
      fat: ingredientCount * 2,
      carbs: ingredientCount * 6,
      protein: ingredientCount * 3,
    };
  }, [ingredients.length]);
  const topPhotoUrl = photosWithUrls[0]?.signedUrl ?? null;

  useEffect(() => {
    let cancelled = false;

    const loadSidebar = async () => {
      setSidebarLoading(true);
      try {
        const response = await fetch("/api/recipes/sidebar", {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as RecipeSidebarData;
        if (cancelled) {
          return;
        }

        setSidebarData(payload);
      } finally {
        if (!cancelled) {
          setSidebarLoading(false);
        }
      }
    };

    void loadSidebar();

    return () => {
      cancelled = true;
    };
  }, []);

  const closeRecipeMenu = () => {
    sidebar.setOpenMenuRecipeId(null);
    sidebar.setMenuAnchor(null);
  };

  const closeVersionMenu = () => {
    sidebar.setOpenVersionMenuId(null);
    sidebar.setVersionMenuAnchor(null);
  };

  async function requestAiSuggestion(instruction: string): Promise<SuggestedChange | null> {
    if (!recipe || !version) {
      return null;
    }

    const response = await fetch("/api/ai/improve-recipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipeId,
        versionId,
        instruction,
        recipe: {
          title: recipe.title,
          servings: version.servings,
          prep_time_min: version.prep_time_min,
          cook_time_min: version.cook_time_min,
          difficulty: version.difficulty,
          ingredients,
          steps,
        },
      }),
    });

    const data = (await response.json()) as {
      error?: boolean;
      message?: string;
      recipe?: {
        ingredients?: Array<{ name: string }>;
        steps?: Array<{ text: string }>;
        explanation?: string;
        servings?: number;
        prep_time_min?: number;
        cook_time_min?: number;
        difficulty?: string;
      };
    };

    if (!response.ok || data.error) {
      return null;
    }

    const improved = (data?.recipe ?? data) as {
      ingredients?: Array<{ name: string }>;
      steps?: Array<{ text: string }>;
      explanation?: string;
      servings?: number;
      prep_time_min?: number;
      cook_time_min?: number;
      difficulty?: string;
    };

    if (!Array.isArray(improved?.ingredients) || !Array.isArray(improved?.steps)) {
      return null;
    }

    return {
      instruction,
      explanation: improved.explanation ?? null,
      servings: typeof improved.servings === "number" ? improved.servings : version.servings,
      prep_time_min: typeof improved.prep_time_min === "number" ? improved.prep_time_min : version.prep_time_min,
      cook_time_min: typeof improved.cook_time_min === "number" ? improved.cook_time_min : version.cook_time_min,
      difficulty:
        typeof improved.difficulty === "string" && improved.difficulty.trim().length > 0
          ? improved.difficulty
          : version.difficulty,
      ingredients: improved.ingredients,
      steps: improved.steps,
    };
  }

  async function requestChefChatReply(userMessage: string): Promise<string> {
    const recipeContext = {
      title: recipe?.title ?? "Recipe in progress",
      ingredients: ingredients.map((item) => item.name),
      steps: steps.map((item) => item.text),
    };

    const response = await fetch("/api/ai/chef-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userMessage, recipeContext }),
    });

    const data = (await response.json()) as { reply?: string; error?: boolean; message?: string };
    if (!response.ok || data.error) {
      throw new Error(data.message || "Chef chat request failed.");
    }
    if (typeof data.reply === "string" && data.reply.trim().length > 0) {
      return data.reply.trim();
    }
    throw new Error("Chef chat returned an empty response.");
  }

  async function createVersionFromSuggestion(suggestion: SuggestedChange, versionLabelText: string) {
    if (!version) return false;

    const { data: versions, error: versionsError } = await supabase
      .from("recipe_versions")
      .select("version_number")
      .eq("recipe_id", recipeId)
      .order("version_number", { ascending: false })
      .limit(1);

    if (versionsError) {
      assistant.setAiError("AI improvement failed. Please try again.");
      return false;
    }

    const nextVersion = (versions?.[0]?.version_number || 0) + 1;
    const { data: insertedVersion, error: insertError } = await supabase
      .from("recipe_versions")
      .insert({
        recipe_id: recipeId,
        version_number: nextVersion,
        version_label: versionLabelText,
        change_summary: suggestion.explanation ?? null,
        servings: suggestion.servings,
        prep_time_min: suggestion.prep_time_min,
        cook_time_min: suggestion.cook_time_min,
        difficulty: suggestion.difficulty,
        ingredients_json: suggestion.ingredients,
        steps_json: suggestion.steps,
      })
      .select(
        "id, recipe_id, version_number, version_label, change_summary, servings, prep_time_min, cook_time_min, difficulty, ingredients_json, steps_json, created_at"
      )
      .single();

    if (insertError || !insertedVersion) {
      assistant.setAiError(insertError?.message || "AI improvement failed. Please try again.");
      return false;
    }

    const nextVersionRow = insertedVersion as VersionRow;
    setVersion(nextVersionRow);
    setTimelineVersions((current) => [
      {
        id: nextVersionRow.id,
        version_number: nextVersionRow.version_number,
        version_label: nextVersionRow.version_label,
        created_at: nextVersionRow.created_at,
      },
      ...current,
    ]);
    setPhotosWithUrls([]);
    assistant.setSuggestedChange(null);
    assistant.setCustomInstruction("");
    startTransition(() => {
      router.push(`/recipes/${recipeId}/versions/${nextVersionRow.id}`);
    });
    return true;
  }

  async function handleQuickAction(instruction: string) {
    if (assistant.isAskingAi || assistant.isGeneratingVersion) return;
    if (assistant.cooldownActive) {
      assistant.setAiError("Please wait a few seconds before another AI improvement.");
      return;
    }
    assistant.setIsGeneratingVersion(true);
    assistant.setAiError(null);
    assistant.setCooldownActive(true);
    if (assistant.cooldownTimeoutRef.current) clearTimeout(assistant.cooldownTimeoutRef.current);
    assistant.cooldownTimeoutRef.current = setTimeout(() => assistant.setCooldownActive(false), 4000);

    const suggestion = await requestAiSuggestion(instruction);
    if (!suggestion) {
      assistant.setAiError("AI improvement failed. Please try again.");
      assistant.setIsGeneratingVersion(false);
      return;
    }
    await createVersionFromSuggestion(suggestion, buildVersionLabelFromInstruction(instruction));
    assistant.setIsGeneratingVersion(false);
  }

  async function handleAskAiSubmit() {
    const instruction = assistant.customInstruction.trim();
    if (!instruction || assistant.isAskingAi || assistant.isGeneratingVersion) return;
    assistant.setIsAskingAi(true);
    assistant.setAiError(null);
    const userMessage: ConversationMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text: instruction,
      createdAt: new Date().toISOString(),
    };
    assistant.setAiConversation((current) => [...current, userMessage]);
    try {
      const chefReply = await requestChefChatReply(instruction);
      const assistantMessage: ConversationMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: chefReply,
        createdAt: new Date().toISOString(),
      };
      assistant.setAiConversation((current) => [...current, assistantMessage]);
      const suggestion = await requestAiSuggestion(instruction);
      if (!suggestion) {
        assistant.setSuggestedChange(null);
        assistant.setAiError("Conversation updated. Could not create an apply-ready change from that message.");
      } else {
        assistant.setSuggestedChange(suggestion);
      }
      assistant.setCustomInstruction("");
    } catch (error) {
      assistant.setAiError(error instanceof Error ? error.message : "Chef AI request failed.");
    } finally {
      assistant.setIsAskingAi(false);
    }
  }

  async function handleApplySuggestedChange() {
    if (!assistant.suggestedChange || assistant.isGeneratingVersion || assistant.isAskingAi) return;
    assistant.setIsGeneratingVersion(true);
    assistant.setAiError(null);
    await createVersionFromSuggestion(
      assistant.suggestedChange,
      buildVersionLabelFromInstruction(assistant.suggestedChange.instruction)
    );
    assistant.setIsGeneratingVersion(false);
  }

  async function deleteRecipe(targetRecipeId: string, recipeTitle: string) {
    if (sidebar.deletingRecipeId) return;
    if (!window.confirm(`Delete "${recipeTitle}" permanently? This will remove all versions and photos.`)) return;
    sidebar.setDeletingRecipeId(targetRecipeId);
    closeRecipeMenu();
    sidebar.setSidebarActionError(null);
    try {
      const { error } = await supabase.from("recipes").delete().eq("id", targetRecipeId);
      if (error) {
        sidebar.setSidebarActionError("Could not delete recipe. Please try again.");
        return;
      }
      const nextSidebarData = {
        ...sidebarData,
        userRecipes: sidebarData.userRecipes.filter((item) => item.id !== targetRecipeId),
        hiddenRecipeIds: sidebarData.hiddenRecipeIds.filter((idValue) => idValue !== targetRecipeId),
        archivedRecipeIds: sidebarData.archivedRecipeIds.filter((idValue) => idValue !== targetRecipeId),
      };
      setSidebarData(nextSidebarData);
      if (targetRecipeId === recipeId) {
        const fallback = nextSidebarData.userRecipes[0];
        startTransition(() => {
          router.push(fallback ? `/recipes/${fallback.id}` : "/dashboard");
        });
      }
    } finally {
      sidebar.setDeletingRecipeId(null);
    }
  }

  async function setRecipeVisibility(targetRecipeId: string, state: "hidden" | "archived" | null) {
    if (!userId) {
      sidebar.setSidebarActionError("Please sign in again.");
      return false;
    }
    if (state === null) {
      const { error } = await supabase.from("recipe_visibility_states").delete().eq("owner_id", userId).eq("recipe_id", targetRecipeId);
      if (error) {
        sidebar.setSidebarActionError("Could not update recipe visibility.");
        return false;
      }
      return true;
    }
    const { error } = await supabase.from("recipe_visibility_states").upsert(
      { owner_id: userId, recipe_id: targetRecipeId, state },
      { onConflict: "owner_id,recipe_id" }
    );
    if (error) {
      sidebar.setSidebarActionError("Could not update recipe visibility.");
      return false;
    }
    return true;
  }

  async function hideRecipe(targetRecipeId: string) {
    closeRecipeMenu();
    sidebar.setSidebarActionError(null);
    if (!(await setRecipeVisibility(targetRecipeId, "hidden"))) return;
    setSidebarData((current) => ({
      ...current,
      hiddenRecipeIds: current.hiddenRecipeIds.includes(targetRecipeId)
        ? current.hiddenRecipeIds
        : [...current.hiddenRecipeIds, targetRecipeId],
      archivedRecipeIds: current.archivedRecipeIds.filter((idValue) => idValue !== targetRecipeId),
    }));
  }

  async function archiveRecipe(targetRecipeId: string) {
    closeRecipeMenu();
    sidebar.setSidebarActionError(null);
    if (!(await setRecipeVisibility(targetRecipeId, "archived"))) return;
    setSidebarData((current) => ({
      ...current,
      archivedRecipeIds: current.archivedRecipeIds.includes(targetRecipeId)
        ? current.archivedRecipeIds
        : [...current.archivedRecipeIds, targetRecipeId],
      hiddenRecipeIds: current.hiddenRecipeIds.filter((idValue) => idValue !== targetRecipeId),
    }));
  }

  async function unhideRecipe(targetRecipeId: string) {
    closeRecipeMenu();
    sidebar.setSidebarActionError(null);
    if (!(await setRecipeVisibility(targetRecipeId, null))) return;
    setSidebarData((current) => ({
      ...current,
      hiddenRecipeIds: current.hiddenRecipeIds.filter((idValue) => idValue !== targetRecipeId),
    }));
  }

  async function unarchiveRecipe(targetRecipeId: string) {
    closeRecipeMenu();
    sidebar.setSidebarActionError(null);
    if (!(await setRecipeVisibility(targetRecipeId, null))) return;
    setSidebarData((current) => ({
      ...current,
      archivedRecipeIds: current.archivedRecipeIds.filter((idValue) => idValue !== targetRecipeId),
    }));
  }

  async function shareVersion() {
    const currentVersionId = version?.id ?? versionId;
    const shareUrl = `${window.location.origin}/recipes/${recipeId}/versions/${currentVersionId}`;
    if (navigator.share) {
      await navigator.share({
        title: recipe?.title ?? "Recipe Version",
        text: version ? versionLabel(version) : "Recipe Version",
        url: shareUrl,
      });
      return;
    }
    await navigator.clipboard.writeText(shareUrl);
  }

  async function renameVersion(targetVersionId: string, currentLabel: string | null) {
    const current = currentLabel?.trim() || "";
    const next = window.prompt("Rename version", current)?.trim();
    if (!next || next === current) return;
    sidebar.setSidebarActionError(null);
    const { error } = await supabase.from("recipe_versions").update({ version_label: next }).eq("id", targetVersionId);
    if (error) {
      sidebar.setSidebarActionError("Could not rename version.");
      return;
    }
    setTimelineVersions((currentVersions) => currentVersions.map((item) => (item.id === targetVersionId ? { ...item, version_label: next } : item)));
    if (version?.id === targetVersionId) {
      setVersion((currentVersion) => (currentVersion ? { ...currentVersion, version_label: next } : currentVersion));
    }
    closeVersionMenu();
  }

  async function favoriteVersion(targetVersionId: string) {
    if (!recipe) return;
    sidebar.setSidebarActionError(null);
    const nextBestId = recipe.best_version_id === targetVersionId ? null : targetVersionId;
    const { error } = await supabase.from("recipes").update({ best_version_id: nextBestId }).eq("id", recipe.id);
    if (error) {
      sidebar.setSidebarActionError("Could not favorite version.");
      return;
    }
    setRecipe((currentRecipe) => (currentRecipe ? { ...currentRecipe, best_version_id: nextBestId } : currentRecipe));
    sidebar.setOpenVersionMenuId(null);
    sidebar.setVersionMenuAnchor(null);
  }

  async function deleteVersion(targetVersionId: string) {
    if (!recipe) return;
    if (!window.confirm("Delete this version? This cannot be undone.")) return;
    sidebar.setSidebarActionError(null);
    const { error } = await supabase.from("recipe_versions").delete().eq("id", targetVersionId);
    if (error) {
      sidebar.setSidebarActionError("Could not delete version.");
      return;
    }
    const nextTimeline = timelineVersions.filter((item) => item.id !== targetVersionId);
    setTimelineVersions(nextTimeline);
    const nextBestId = recipe.best_version_id === targetVersionId ? null : recipe.best_version_id ?? null;
    if (nextBestId !== recipe.best_version_id) {
      const { error: bestError } = await supabase.from("recipes").update({ best_version_id: null }).eq("id", recipe.id);
      if (!bestError) setRecipe((currentRecipe) => (currentRecipe ? { ...currentRecipe, best_version_id: null } : currentRecipe));
    }
    if (version?.id === targetVersionId) {
      const fallback = nextTimeline[0];
      startTransition(() => {
        router.push(fallback ? `/recipes/${recipeId}/versions/${fallback.id}` : `/recipes/${recipeId}`);
      });
    }
    closeVersionMenu();
  }

  const activeMenuRecipe = sidebar.openMenuRecipeId
    ? sidebarData.userRecipes.find((item) => item.id === sidebar.openMenuRecipeId) ?? null
    : null;
  const activeVersionMenu = sidebar.openVersionMenuId ? timelineVersions.find((timelineVersion) => timelineVersion.id === sidebar.openVersionMenuId) ?? null : null;

  const openMenuAtRect = (rect: DOMRect) => {
    const menuWidth = 320;
    const margin = 12;
    const left = Math.min(Math.max(margin, rect.right - menuWidth), window.innerWidth - menuWidth - margin);
    const top = Math.min(rect.bottom + 8, window.innerHeight - 280);
    return { top, left };
  };

  return (
    <div className="space-y-6">
      <RecipeActionMenu
        activeRecipe={activeMenuRecipe}
        menuAnchor={sidebar.menuAnchor}
        recipeListView={sidebar.recipeListView}
        deletingRecipeId={sidebar.deletingRecipeId}
        onClose={closeRecipeMenu}
        onDelete={(targetRecipeId, title) => void deleteRecipe(targetRecipeId, title)}
        onHide={(targetRecipeId) => void hideRecipe(targetRecipeId)}
        onArchive={(targetRecipeId) => void archiveRecipe(targetRecipeId)}
        onUnhide={(targetRecipeId) => void unhideRecipe(targetRecipeId)}
        onUnarchive={(targetRecipeId) => void unarchiveRecipe(targetRecipeId)}
      />
      <VersionActionMenu
        activeVersion={activeVersionMenu}
        versionMenuAnchor={sidebar.versionMenuAnchor}
        bestVersionId={recipe?.best_version_id}
        onClose={closeVersionMenu}
        onRename={(targetVersionId, currentLabel) => void renameVersion(targetVersionId, currentLabel)}
        onFavorite={(targetVersionId) => void favoriteVersion(targetVersionId)}
        onDelete={(targetVersionId) => void deleteVersion(targetVersionId)}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <RecipeSidebar
          loading={sidebarLoading}
          currentRecipeId={recipeId}
          currentVersion={version!}
          recipe={recipe!}
          categorizedRecipes={sidebar.categorizedRecipes}
          recipeSearch={sidebar.recipeSearch}
          recipeListView={sidebar.recipeListView}
          timelineVersions={timelineVersions}
          recentRecipeItems={recentRecipeItems}
          favoriteRecipeItems={favoriteRecipeItems}
          sidebarActionError={sidebar.sidebarActionError}
          onRecipeSearchChange={sidebar.setRecipeSearch}
          onRecipeListViewChange={sidebar.setRecipeListView}
          onRecipeNavigate={(targetRecipeId) => router.push(`/recipes/${targetRecipeId}`)}
          onVersionNavigate={(targetVersionId) => router.push(`/recipes/${recipeId}/versions/${targetVersionId}`)}
          onOpenRecipeMenu={(targetRecipeId, rect) => {
            sidebar.setMenuAnchor(openMenuAtRect(rect));
            sidebar.setOpenMenuRecipeId(targetRecipeId);
          }}
          onOpenVersionMenu={(targetVersionId, rect) => {
            sidebar.setVersionMenuAnchor(openMenuAtRect(rect));
            sidebar.setOpenVersionMenuId(targetVersionId);
          }}
        />

        <VersionMainPanels
          recipe={recipe!}
          version={version!}
          ingredients={ingredients}
          steps={steps}
          topPhotoUrl={topPhotoUrl}
          userId={userId}
          photosWithUrls={photosWithUrls}
          onShare={() => void shareVersion()}
        />

        <aside className="sticky top-28 self-start space-y-4">
          <ChefAiPanel
            aiConversation={assistant.aiConversation}
            customInstruction={assistant.customInstruction}
            suggestedChange={assistant.suggestedChange}
            isAskingAi={assistant.isAskingAi}
            isGeneratingVersion={assistant.isGeneratingVersion}
            aiError={assistant.aiError}
            onQuickAction={(instruction) => void handleQuickAction(instruction)}
            onInstructionChange={assistant.setCustomInstruction}
            onAskSubmit={() => void handleAskAiSubmit()}
            onApplySuggestedChange={() => void handleApplySuggestedChange()}
            conversationEndRef={assistant.conversationEndRef}
          />
          <MetricsPanel prepMinutes={prepMinutes} cookMinutes={cookMinutes} difficulty={difficulty} servings={servings} />
          <NutritionPanel nutrition={nutrition} totalMinutes={totalMinutes} />
        </aside>
      </div>
    </div>
  );
}
