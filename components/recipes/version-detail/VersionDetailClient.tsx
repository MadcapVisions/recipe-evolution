"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ChefAiPanel, MetricsPanel, NutritionPanel, PrepPlanPanel } from "@/components/recipes/version-detail/AiPanels";
import { VersionMainPanels } from "@/components/recipes/version-detail/MainPanels";
import { RecipeActionMenu, RecipeNavigationSection, RecipeSidebar, VersionActionMenu, VersionRailSection } from "@/components/recipes/version-detail/SidebarPanels";
import { ShellContextPanel } from "@/components/shell/ShellContextPanel";
import { useAppShell } from "@/components/shell/AppShellContext";
import { useRecipeAssistant } from "@/components/recipes/version-detail/useRecipeAssistant";
import { useRecipeSidebarState } from "@/components/recipes/version-detail/useRecipeSidebarState";
import { generateLocalChefReply, generateLocalImprovedRecipe, generateLocalRemixRecipe } from "@/lib/localRecipeGenerator";
import { createRecipeVersionViaApi, mapVersionToCanonicalVersion } from "@/lib/client/recipeMutations";
import type { AiRecipeResult } from "@/lib/ai/recipeResult";
import { trackEventInBackground } from "@/lib/trackEventInBackground";
import { publishAiStatus } from "@/lib/ui/aiStatusBus";
import { COOKING_SCOPE_MESSAGE, guardCookingTopic } from "@/lib/ai/topicGuard";
import type { AIMessage } from "@/lib/ai/chatPromptBuilder";
import {
  buildVersionLabelFromInstruction,
  normalizeIngredients,
  normalizeSteps,
  versionLabel,
  type ConversationMessage,
  type RecipeListItem,
  type RecipeRow,
  type SelectedAssistantDirection,
  type SuggestedChange,
  type TimelineVersion,
  type VersionRow,
} from "@/components/recipes/version-detail/types";
import type { RecipeSidebarData } from "@/lib/recipeSidebarData";
import type { VersionDetailData } from "@/lib/versionDetailData";
import { buildPrepPlan } from "@/lib/recipes/prepPlan";
import { scaleCanonicalIngredientLine } from "@/lib/recipes/servings";
import { useTargetServings } from "@/lib/recipes/targetServings";
import type { ChefDirectionOption } from "@/lib/ai/chefOptions";

function mapInstructionToImproveGoal(instruction: string): "high protein" | "vegetarian" | "faster" | "spicier" | null {
  const lower = instruction.toLowerCase();
  if (lower.includes("vegetarian")) return "vegetarian";
  if (lower.includes("faster")) return "faster";
  if (lower.includes("spicy")) return "spicier";
  if (lower.includes("protein")) return "high protein";
  return null;
}

function buildRecipeDetailConversationHistory(
  messages: ConversationMessage[],
  selectedDirection: SelectedAssistantDirection | null
): AIMessage[] {
  const relevantMessages = messages.filter((message) => message.kind !== "direction_selected");
  if (relevantMessages.length === 0) {
    return [];
  }

  const selectedIndex = selectedDirection
    ? relevantMessages.findIndex((message) => message.id === selectedDirection.messageId && message.role === "assistant")
    : -1;

  if (selectedIndex >= 0) {
    const lockedMessages: ConversationMessage[] = [
      {
        id: `locked-${selectedDirection?.messageId ?? "direction"}`,
        role: "assistant",
        text: `Locked direction: ${selectedDirection?.title}. ${selectedDirection?.summary}`,
        createdAt: new Date(0).toISOString(),
        kind: "message",
      },
      ...relevantMessages.slice(selectedIndex + 1),
    ];

    return lockedMessages.slice(-6).map((message) => ({
      role: message.role === "user" ? "user" : "assistant",
      content: message.text,
    }));
  }

  return relevantMessages.slice(-6).map((message) => ({
    role: message.role === "user" ? "user" : "assistant",
    content: message.text,
  }));
}

function wantsDirectionOptions(message: string) {
  return (
    /\b(?:options?|ideas?|directions?|variations?|alternatives?|choices?)\b/i.test(message) ||
    /\b(?:show|give)\s+me\b.+\b(?:options?|ideas?|directions?|variations?|alternatives?|choices?)\b/i.test(message) ||
    /\b(?:2|3)\s+(?:options?|ideas?|directions?|variations?|alternatives?|choices?)\b/i.test(message)
  );
}

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
  const { setOpenPanel } = useAppShell();
  const [recipe, setRecipe] = useState<RecipeRow | null>(initialData.recipe);
  const [sidebarData, setSidebarData] = useState<RecipeSidebarData>({
    recentRecipes: initialData.sidebarRecentRecipes,
    favoriteRecipes: [],
  });
  const [timelineVersions, setTimelineVersions] = useState<TimelineVersion[]>(initialData.timelineVersions);
  const [timelineHasMore, setTimelineHasMore] = useState(initialData.timelineHasMore);
  const [timelineLoadingMore, setTimelineLoadingMore] = useState(false);
  const [version, setVersion] = useState<VersionRow | null>(initialData.version);
  const [userId] = useState<string | null>(initialData.userId);
  const [photosWithUrls, setPhotosWithUrls] = useState<Array<{ id: string; signedUrl: string; storagePath: string }>>(initialData.initialPhotosWithUrls);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [completedPrepIds, setCompletedPrepIds] = useState<string[]>([]);
  const [leftSidebarMode, setLeftSidebarMode] = useState<"recipe-nav" | "version-history">("recipe-nav");
  const [rightSidebarMode, setRightSidebarMode] = useState<"overview" | "prep" | "chef">("overview");
  const assistant = useRecipeAssistant(recipeId);
  const sidebar = useRecipeSidebarState({
    quickRecipes: [...sidebarData.recentRecipes, ...sidebarData.favoriteRecipes].filter(
      (recipeItem, index, list) => list.findIndex((candidate) => candidate.id === recipeItem.id) === index
    ),
  });

  const ingredients = useMemo(() => normalizeIngredients(version?.canonical_ingredients), [version]);
  const steps = useMemo(() => normalizeSteps(version?.canonical_steps), [version]);
  const prepMinutes = typeof version?.prep_time_min === "number" && version.prep_time_min > 0 ? version.prep_time_min : 15;
  const cookMinutes = typeof version?.cook_time_min === "number" && version.cook_time_min > 0 ? version.cook_time_min : 25;
  const totalMinutes = prepMinutes + cookMinutes;
  const servings = typeof version?.servings === "number" ? version.servings : 4;
  const { targetServings: displayServings, setTargetServings, baseServings, canScale: canAdjustServings } = useTargetServings(
    version?.id ?? versionId,
    version?.servings ?? null
  );
  const difficulty = version?.difficulty?.trim() || "Easy";
  const nutrition = useMemo(() => {
    const ingredientCount = Math.max(ingredients.length, 1);
    return {
      calories: ingredientCount * 55,
      fat: ingredientCount * 2,
      carbs: ingredientCount * 6,
      protein: ingredientCount * 3,
    };
  }, [ingredients.length]);
  const prepPlan = useMemo(
    () =>
      buildPrepPlan({
        ingredientNames: ingredients.map((item) => item.name),
        stepTexts: steps.map((item) => item.text),
      }),
    [ingredients, steps]
  );
  const displayIngredients = useMemo(
    () =>
      canAdjustServings && baseServings
        ? ingredients.map((item) => ({ ...item, name: scaleCanonicalIngredientLine(item.name, baseServings, displayServings) }))
        : ingredients,
    [baseServings, canAdjustServings, displayServings, ingredients]
  );
  const topPhotoUrl = photosWithUrls[0]?.signedUrl ?? initialData.stockCoverUrl;
  const desktopRecipeNavRef = useRef<HTMLDivElement | null>(null);
  const desktopVersionHistoryRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPrepProgress = async () => {
      const response = await fetch(`/api/recipes/${recipeId}/versions/${versionId}/prep-progress`, {
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json()) as { completedChecklistIds?: string[] };
      if (!cancelled && response.ok) {
        setCompletedPrepIds(payload.completedChecklistIds ?? []);
      }
    };

    void loadPrepProgress();

    return () => {
      cancelled = true;
    };
  }, [recipeId, versionId]);

  useEffect(() => {
    let cancelled = false;

    const loadFavorites = async () => {
      const response = await fetch("/api/recipes/sidebar?section=favorites", {
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as RecipeSidebarData["favoriteRecipes"];
      if (cancelled) {
        return;
      }

      setSidebarData((current) => ({ ...current, favoriteRecipes: payload }));
    };

    void loadFavorites();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadGalleryPhotos = async () => {
      setGalleryLoading(true);
      try {
        const response = await fetch(`/api/recipes/${recipeId}/versions/${versionId}/photos`, {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          photos?: Array<{ id: string; signedUrl: string; storagePath: string }>;
        };

        if (!cancelled && Array.isArray(payload.photos)) {
          setPhotosWithUrls(payload.photos);
        }
      } finally {
        if (!cancelled) {
          setGalleryLoading(false);
        }
      }
    };

    void loadGalleryPhotos();

    return () => {
      cancelled = true;
    };
  }, [recipeId, versionId]);

  useEffect(() => {
    let message: string | null = null;
    let tone: "loading" | "success" | "fallback" | "default" = "default";
    const lowerError = assistant.aiError?.toLowerCase() ?? "";

    if (assistant.isGeneratingVersion) {
      message = "Generating recipe...";
      tone = "loading";
    } else if (assistant.isAskingAi) {
      message = "Chef is thinking...";
      tone = "loading";
    } else if (assistant.aiError) {
      if (
        lowerError.includes("fallback") ||
        lowerError.includes("unavailable") ||
        lowerError.includes("rate-limited") ||
        lowerError.includes("backup")
      ) {
        message = "Using backup recipe engine";
        tone = "fallback";
      } else if (
        lowerError.includes("please wait") ||
        lowerError.includes("could not") ||
        lowerError.includes("failed")
      ) {
        message = "AI temporarily unavailable";
        tone = "fallback";
      }
    } else if (assistant.suggestedChange) {
      message = "Suggestions ready";
      tone = "success";
    }

    publishAiStatus({ message, tone });

    return () => {
      publishAiStatus({ message: null });
    };
  }, [assistant.isGeneratingVersion, assistant.isAskingAi, assistant.aiError, assistant.suggestedChange]);

  const closeRecipeMenu = () => {
    sidebar.setOpenMenuRecipeId(null);
    sidebar.setMenuAnchor(null);
  };

  const closeVersionMenu = () => {
    sidebar.setOpenVersionMenuId(null);
    sidebar.setVersionMenuAnchor(null);
  };

  function normalizeSuggestedChange(
    instruction: string,
    improved: {
      recipe?: {
        ingredients?: Array<{ name: string }>;
        steps?: Array<{ text: string }>;
        servings?: number | null;
        prep_time_min?: number | null;
        cook_time_min?: number | null;
        difficulty?: string | null;
      };
      explanation?: string;
      ingredients?: Array<{ name: string }>;
      steps?: Array<{ text: string }>;
      servings?: number | null;
      prep_time_min?: number | null;
      cook_time_min?: number | null;
      difficulty?: string | null;
    }
  ): SuggestedChange | null {
    if (!version) {
      return null;
    }

    const recipePayload = improved.recipe ?? improved;

    if (!Array.isArray(recipePayload.ingredients) || !Array.isArray(recipePayload.steps)) {
      return null;
    }

    return {
      instruction,
      explanation: improved.explanation ?? null,
      servings: typeof recipePayload.servings === "number" ? recipePayload.servings : version.servings,
      prep_time_min: typeof recipePayload.prep_time_min === "number" ? recipePayload.prep_time_min : version.prep_time_min,
      cook_time_min: typeof recipePayload.cook_time_min === "number" ? recipePayload.cook_time_min : version.cook_time_min,
      difficulty:
        typeof recipePayload.difficulty === "string" && recipePayload.difficulty.trim().length > 0
          ? recipePayload.difficulty
          : version.difficulty,
      ingredients: recipePayload.ingredients,
      steps: recipePayload.steps,
    };
  }

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
      result?: AiRecipeResult;
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

    return normalizeSuggestedChange(instruction, (data.result ?? data?.recipe ?? data) as AiRecipeResult & {
      ingredients?: Array<{ name: string }>;
      steps?: Array<{ text: string }>;
      explanation?: string;
      servings?: number;
      prep_time_min?: number;
      cook_time_min?: number;
      difficulty?: string;
    });
  }

  function buildDeterministicSuggestion(instruction: string): SuggestedChange | null {
    if (!recipe || !version) {
      return null;
    }

    const improveGoal = mapInstructionToImproveGoal(instruction);
    if (!improveGoal) {
      return null;
    }

    const improved = generateLocalImprovedRecipe(
      {
        title: recipe.title,
        description: version.change_summary ?? null,
        servings: version.servings,
        prep_time_min: version.prep_time_min,
        cook_time_min: version.cook_time_min,
        difficulty: version.difficulty,
        ingredients,
        steps,
      },
      improveGoal,
      instruction
    );

    return {
      instruction,
      explanation: `Built with the deterministic fallback engine for a ${improveGoal} variation.`,
      servings: typeof improved.servings === "number" ? improved.servings : version.servings,
      prep_time_min: typeof improved.prep_time_min === "number" ? improved.prep_time_min : version.prep_time_min,
      cook_time_min: typeof improved.cook_time_min === "number" ? improved.cook_time_min : version.cook_time_min,
      difficulty: improved.difficulty ?? version.difficulty,
      ingredients: improved.ingredients,
      steps: improved.steps,
    };
  }

  function buildDeterministicRemixSuggestion(): SuggestedChange | null {
    if (!recipe || !version) {
      return null;
    }

    const remixed = generateLocalRemixRecipe({
      title: recipe.title,
      description: version.change_summary ?? null,
      servings: version.servings,
      prep_time_min: version.prep_time_min,
      cook_time_min: version.cook_time_min,
      difficulty: version.difficulty,
      ingredients,
      steps,
    });

    return {
      instruction: "Remix leftovers into a new version",
      explanation: remixed.remix_description,
      servings: typeof remixed.servings === "number" ? remixed.servings : version.servings,
      prep_time_min: typeof remixed.prep_time_min === "number" ? remixed.prep_time_min : version.prep_time_min,
      cook_time_min: typeof remixed.cook_time_min === "number" ? remixed.cook_time_min : version.cook_time_min,
      difficulty: remixed.difficulty ?? version.difficulty,
      ingredients: remixed.ingredients,
      steps: remixed.steps,
    };
  }

  async function requestChefChatResponse(userMessage: string): Promise<{
    mode: "options" | "refine";
    reply: string;
    options: ChefDirectionOption[];
    recommendedOptionId: string | null;
    suggestion: SuggestedChange | null;
  }> {
    const recipeContext = {
      title: recipe?.title ?? "Recipe in progress",
      ingredients: ingredients.map((item) => item.name),
      steps: steps.map((item) => item.text),
    };
    const conversationHistory = buildRecipeDetailConversationHistory(assistant.aiConversation, assistant.selectedDirection);
    const includeSuggestion = assistant.selectedDirection !== null || !wantsDirectionOptions(userMessage);

    const response = await fetch("/api/ai/chef-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userMessage,
        recipeContext,
        conversationHistory,
        conversationKey: assistant.conversationKey,
        includeSuggestion,
        recipeId,
        versionId,
        recipe: {
          title: recipe?.title ?? "Recipe in progress",
          servings: version?.servings ?? null,
          prep_time_min: version?.prep_time_min ?? null,
          cook_time_min: version?.cook_time_min ?? null,
          difficulty: version?.difficulty ?? null,
          ingredients,
          steps,
        },
      }),
    });

    const data = (await response.json()) as {
      mode?: "options" | "refine";
      reply?: string;
      options?: ChefDirectionOption[];
      recommended_option_id?: string | null;
      suggestion?: (AiRecipeResult & {
        ingredients?: Array<{ name: string }>;
        steps?: Array<{ text: string }>;
        explanation?: string;
        servings?: number;
        prep_time_min?: number;
        cook_time_min?: number;
        difficulty?: string;
      }) | null;
      error?: boolean;
      message?: string;
    };
    if (!response.ok || data.error) {
      throw new Error(data.message || "Chef chat request failed.");
    }
    if (typeof data.reply !== "string" || data.reply.trim().length === 0) {
      throw new Error("Chef chat returned an empty response.");
    }

    return {
      mode: data.mode === "options" ? "options" : "refine",
      reply: data.reply.trim(),
      options: Array.isArray(data.options) ? data.options : [],
      recommendedOptionId: typeof data.recommended_option_id === "string" ? data.recommended_option_id : null,
      suggestion: data.mode === "options" ? null : data.suggestion ? normalizeSuggestedChange(userMessage, data.suggestion) : null,
    };
  }

  function buildDeterministicChefReply(userMessage: string) {
    return generateLocalChefReply(
      `${recipe?.title ?? "recipe"} ${userMessage}`,
      ingredients.map((item) => item.name)
    );
  }

  async function createVersionFromSuggestion(
    suggestion: SuggestedChange,
    versionLabelText: string,
    metadata?: {
      source?: "ai" | "fallback";
      action?: "quick_action" | "apply_suggestion" | "remix";
      instruction?: string;
    }
  ) {
    if (!version) return false;

    let insertedVersion: VersionRow;
    try {
      insertedVersion = mapVersionToCanonicalVersion(await createRecipeVersionViaApi(recipeId, {
        version_label: versionLabelText,
        change_summary: suggestion.explanation ?? null,
        servings: suggestion.servings,
        prep_time_min: suggestion.prep_time_min,
        cook_time_min: suggestion.cook_time_min,
        difficulty: suggestion.difficulty,
        ingredients: suggestion.ingredients,
        steps: suggestion.steps,
      }) ) as VersionRow;
    } catch (error) {
      assistant.setAiError(error instanceof Error ? error.message : "AI improvement failed. Please try again.");
      return false;
    }

    const nextVersionRow = insertedVersion;
    setVersion(nextVersionRow);
    setTimelineVersions((current) => [
      {
        id: nextVersionRow.id,
        version_number: nextVersionRow.version_number,
        version_label: nextVersionRow.version_label,
        change_summary: nextVersionRow.change_summary,
        created_at: nextVersionRow.created_at,
      },
      ...current,
    ]);
    setPhotosWithUrls([]);
    setGalleryLoading(true);
    assistant.setSuggestedChange(null);
    assistant.setCustomInstruction("");
    trackEventInBackground("version_created", {
      recipeId,
      versionId: nextVersionRow.id,
      versionNumber: nextVersionRow.version_number,
      title: recipe?.title ?? null,
      versionLabel: versionLabelText,
      source: metadata?.source ?? "ai",
      instruction: metadata?.instruction ?? suggestion.instruction,
      action: metadata?.action ?? null,
    });
    if (metadata?.action === "remix") {
      trackEventInBackground("recipe_remixed", {
        recipeId,
        versionId: nextVersionRow.id,
        recipeTitle: recipe?.title ?? null,
        instruction: suggestion.instruction,
      });
    } else {
      trackEventInBackground("recipe_improved", {
        recipeId,
        versionId: nextVersionRow.id,
        recipeTitle: recipe?.title ?? null,
        instruction: metadata?.instruction ?? suggestion.instruction,
        source: metadata?.source ?? "ai",
      });
    }
    const href = `/recipes/${recipeId}/versions/${nextVersionRow.id}`;
    if (typeof window !== "undefined") {
      window.location.assign(href);
    } else {
      startTransition(() => {
        router.push(href);
      });
    }
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
      const fallbackSuggestion = buildDeterministicSuggestion(instruction);
      if (!fallbackSuggestion) {
        assistant.setAiError("AI improvement failed. Please try again.");
        assistant.setIsGeneratingVersion(false);
        return;
      }
      await createVersionFromSuggestion(fallbackSuggestion, buildVersionLabelFromInstruction(instruction), {
        source: "fallback",
        action: "quick_action",
        instruction,
      });
      assistant.setAiError("Built with deterministic fallback while AI was unavailable.");
      assistant.setIsGeneratingVersion(false);
      return;
    }
    await createVersionFromSuggestion(suggestion, buildVersionLabelFromInstruction(instruction), {
      source: "ai",
      action: "quick_action",
      instruction,
    });
    assistant.setIsGeneratingVersion(false);
  }

  async function handleAskAiSubmit() {
    const instruction = assistant.customInstruction.trim();
    if (!instruction || assistant.isAskingAi || assistant.isGeneratingVersion) return;

    const recipeContext = {
      title: recipe?.title ?? "Recipe in progress",
      ingredients: ingredients.map((item) => item.name),
      steps: steps.map((item) => item.text),
    };
    const topicGuard = guardCookingTopic({
      message: instruction,
      recipeContext,
    });

    if (!topicGuard.allowed) {
      assistant.setAiError(COOKING_SCOPE_MESSAGE);
      return;
    }

    assistant.setIsAskingAi(true);
    assistant.setAiError(null);
    trackEventInBackground("chef_chat_prompt", {
      prompt: instruction,
      source: "recipe-detail",
      recipeId,
      recipeTitle: recipe?.title ?? null,
      messageCount: assistant.aiConversation.length,
    });
    const userMessage: ConversationMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text: instruction,
      createdAt: new Date().toISOString(),
    };
    assistant.setAiConversation((current) => [...current, userMessage]);
    try {
      const aiResponse = await requestChefChatResponse(instruction);
      const assistantMessage: ConversationMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: aiResponse.reply,
        createdAt: new Date().toISOString(),
        kind: "message",
        options: aiResponse.options,
        recommendedOptionId: aiResponse.recommendedOptionId,
      };
      assistant.setAiConversation((current) => [...current, assistantMessage]);
      if (aiResponse.mode === "options" && aiResponse.options.length > 0) {
        assistant.setSelectedDirection(null);
        assistant.setSuggestedChange(null);
        assistant.setAiError("Choose one direction before saving a new version.");
        assistant.setCustomInstruction("");
        return;
      }
      const suggestion = aiResponse.suggestion;
      if (!suggestion) {
        const fallbackSuggestion = buildDeterministicSuggestion(instruction);
        if (!fallbackSuggestion) {
          assistant.setSuggestedChange(null);
          assistant.setAiError("Conversation updated. Could not create an apply-ready change from that message.");
        } else {
          assistant.setSuggestedChange(fallbackSuggestion);
          assistant.setAiError("Conversation updated with deterministic fallback change.");
        }
      } else {
        assistant.setSuggestedChange(suggestion);
      }
      assistant.setCustomInstruction("");
    } catch (error) {
      const fallbackReply = buildDeterministicChefReply(instruction);
      const optionsRequest = wantsDirectionOptions(instruction);
      const assistantMessage: ConversationMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: fallbackReply,
        createdAt: new Date().toISOString(),
        kind: "message",
      };
      assistant.setAiConversation((current) => [...current, assistantMessage]);
      if (optionsRequest) {
        assistant.setSelectedDirection(null);
        assistant.setSuggestedChange(null);
        assistant.setAiError("Chef AI unavailable. Fallback guidance is shown, but choose a direction before saving.");
      } else {
        const fallbackSuggestion = buildDeterministicSuggestion(instruction);
        assistant.setSuggestedChange(fallbackSuggestion);
        assistant.setAiError("Chef AI unavailable. Using deterministic fallback guidance.");
      }
      assistant.setCustomInstruction("");
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
      buildVersionLabelFromInstruction(assistant.suggestedChange.instruction),
      {
        source: assistant.aiError?.toLowerCase().includes("fallback") ? "fallback" : "ai",
        action: "apply_suggestion",
        instruction: assistant.suggestedChange.instruction,
      }
    );
    assistant.setIsGeneratingVersion(false);
  }

  function handleSelectAssistantDirection(messageId: string, option: ChefDirectionOption) {
    assistant.setSelectedDirection({
      messageId,
      optionId: option.id,
      title: option.title,
      summary: option.summary,
      tags: option.tags,
    });
    assistant.setSuggestedChange(null);
    assistant.setAiError(null);
    assistant.setAiConversation((current) => {
      const alreadyConfirmed =
        current.at(-1)?.kind === "direction_selected" &&
        current.at(-1)?.text.includes(option.title);

      if (alreadyConfirmed) {
        return current;
      }

      return [
        ...current,
        {
          id: `${Date.now()}-direction-selected`,
          role: "assistant",
          text: `Locked direction: ${option.title}. I’ll refine only this path from here.`,
          createdAt: new Date().toISOString(),
          kind: "direction_selected",
        },
      ];
    });
  }

  function handleClearAssistantDirection() {
    assistant.setSelectedDirection(null);
    assistant.setSuggestedChange(null);
    assistant.setAiError(null);
  }

  async function handleRemixLeftovers() {
    if (assistant.isGeneratingVersion || assistant.isAskingAi) return;
    assistant.setIsGeneratingVersion(true);
    assistant.setAiError(null);
    const suggestion = buildDeterministicRemixSuggestion();
    if (!suggestion) {
      assistant.setAiError("Could not build a remix version.");
      assistant.setIsGeneratingVersion(false);
      return;
    }
    await createVersionFromSuggestion(suggestion, "Remix Version", {
      source: "fallback",
      action: "remix",
      instruction: suggestion.instruction,
    });
    assistant.setAiError("Created with deterministic leftover remix logic.");
    assistant.setIsGeneratingVersion(false);
  }

  async function deleteRecipe(targetRecipeId: string, recipeTitle: string) {
    if (sidebar.deletingRecipeId) return;
    if (!window.confirm(`Delete "${recipeTitle}" permanently? This will remove all versions and photos.`)) return;
    sidebar.setDeletingRecipeId(targetRecipeId);
    closeRecipeMenu();
    sidebar.setSidebarActionError(null);
    try {
      const response = await fetch(`/api/recipes/${targetRecipeId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        sidebar.setSidebarActionError("Could not delete recipe. Please try again.");
        return;
      }
      const nextSidebarData = {
        ...sidebarData,
        recentRecipes: sidebarData.recentRecipes.filter((item) => item.id !== targetRecipeId),
        favoriteRecipes: sidebarData.favoriteRecipes.filter((item) => item.id !== targetRecipeId),
      };
      setSidebarData(nextSidebarData);
      if (targetRecipeId === recipeId) {
        const fallback = nextSidebarData.recentRecipes[0] ?? nextSidebarData.favoriteRecipes[0];
        startTransition(() => {
          router.push(fallback ? `/recipes/${fallback.id}` : "/dashboard");
        });
      }
    } finally {
      sidebar.setDeletingRecipeId(null);
    }
  }

  async function setRecipeVisibility(targetRecipeId: string, state: "hidden" | "archived" | null) {
    if (state === null) {
      const response = await fetch(`/api/recipes/${targetRecipeId}/visibility`, {
        method: "DELETE",
      });
      if (!response.ok) {
        sidebar.setSidebarActionError("Could not update recipe visibility.");
        return false;
      }
      return true;
    }
    const response = await fetch(`/api/recipes/${targetRecipeId}/visibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
    if (!response.ok) {
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
      recentRecipes: current.recentRecipes.filter((item) => item.id !== targetRecipeId),
      favoriteRecipes: current.favoriteRecipes.filter((item) => item.id !== targetRecipeId),
    }));
  }

  async function archiveRecipe(targetRecipeId: string) {
    closeRecipeMenu();
    sidebar.setSidebarActionError(null);
    if (!(await setRecipeVisibility(targetRecipeId, "archived"))) return;
    setSidebarData((current) => ({
      ...current,
      recentRecipes: current.recentRecipes.filter((item) => item.id !== targetRecipeId),
      favoriteRecipes: current.favoriteRecipes.filter((item) => item.id !== targetRecipeId),
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
    const response = await fetch(`/api/recipes/${recipeId}/versions/${targetVersionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version_label: next }),
    });
    if (!response.ok) {
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
    const response = await fetch(`/api/recipes/${recipe.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ best_version_id: nextBestId }),
    });
    if (!response.ok) {
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
    const response = await fetch(`/api/recipes/${recipeId}/versions/${targetVersionId}`, {
      method: "DELETE",
    });
    const payload = (await response.json()) as { message?: string };
    if (!response.ok) {
      sidebar.setSidebarActionError(payload.message ?? "Could not delete version.");
      return;
    }
    const nextTimeline = timelineVersions.filter((item) => item.id !== targetVersionId);
    setTimelineVersions(nextTimeline);
    setTimelineHasMore(initialData.timelineHasMore || nextTimeline.length > 0);
    const nextBestId = recipe.best_version_id === targetVersionId ? null : recipe.best_version_id ?? null;
    if (nextBestId !== recipe.best_version_id) {
      setRecipe((currentRecipe) => (currentRecipe ? { ...currentRecipe, best_version_id: null } : currentRecipe));
    }
    if (version?.id === targetVersionId) {
      const fallback = nextTimeline[0];
      startTransition(() => {
        router.push(fallback ? `/recipes/${recipeId}/versions/${fallback.id}` : `/recipes/${recipeId}`);
      });
    }
    closeVersionMenu();
  }

  async function loadMoreVersions() {
    if (timelineLoadingMore || !timelineHasMore || !version) {
      return;
    }

    setTimelineLoadingMore(true);
    sidebar.setSidebarActionError(null);

    try {
      const params = new URLSearchParams({
        currentVersionId: version.id,
        offset: String(timelineVersions.length),
        limit: "8",
      });
      const response = await fetch(`/api/recipes/${recipeId}/versions?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        versions?: TimelineVersion[];
        hasMore?: boolean;
        error?: boolean;
        message?: string;
      };

      if (!response.ok || payload.error) {
        throw new Error(payload.message ?? "Could not load more versions.");
      }

      setTimelineVersions((current) => {
        const existingIds = new Set(current.map((item) => item.id));
        return current.concat((payload.versions ?? []).filter((item) => !existingIds.has(item.id)));
      });
      setTimelineHasMore(Boolean(payload.hasMore));
    } catch (error) {
      sidebar.setSidebarActionError(error instanceof Error ? error.message : "Could not load more versions.");
    } finally {
      setTimelineLoadingMore(false);
    }
  }

  const activeMenuRecipe = sidebar.openMenuRecipeId
    ? [...sidebarData.recentRecipes, ...sidebarData.favoriteRecipes].find((item) => item.id === sidebar.openMenuRecipeId) ?? null
    : null;
  const activeVersionMenu = sidebar.openVersionMenuId ? timelineVersions.find((timelineVersion) => timelineVersion.id === sidebar.openVersionMenuId) ?? null : null;

  const openMenuAtRect = (rect: DOMRect) => {
    const menuWidth = 320;
    const margin = 12;
    const left = Math.min(Math.max(margin, rect.right - menuWidth), window.innerWidth - menuWidth - margin);
    const top = Math.min(rect.bottom + 8, window.innerHeight - 280);
    return { top, left };
  };

  const isCompactViewport = () => (typeof window !== "undefined" ? window.innerWidth < 1280 : false);

  const openLeftPanelMode = (mode: "recipe-nav" | "version-history") => {
    setLeftSidebarMode(mode);

    if (isCompactViewport()) {
      setOpenPanel("left");
      return;
    }

    const targetRef = mode === "version-history" ? desktopVersionHistoryRef : desktopRecipeNavRef;
    targetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openRightPanelMode = (mode: "overview" | "prep" | "chef") => {
    setRightSidebarMode(mode);

    if (isCompactViewport()) {
      setOpenPanel("right");
    }
  };

  const navigateToRecipe = (targetRecipeId: string) => {
    const href = `/recipes/${targetRecipeId}`;

    if (typeof window !== "undefined") {
      window.location.assign(href);
      return;
    }

    router.push(href);
  };

  const navigateToVersion = (targetVersionId: string) => {
    const href = `/recipes/${recipeId}/versions/${targetVersionId}`;

    if (typeof window !== "undefined") {
      window.location.assign(href);
      return;
    }

    router.push(href);
  };

  return (
    <div className="space-y-6">
      <ShellContextPanel
        side="left"
        label="Cookbook"
        title="Recipe navigation"
        description="Jump across recipes and versions without leaving the current detail workspace."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-[22px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,252,246,0.88)] p-1.5">
            <button
              type="button"
              onClick={() => setLeftSidebarMode("recipe-nav")}
              className={`rounded-[18px] px-3 py-2 text-sm font-semibold transition ${
                leftSidebarMode === "recipe-nav" ? "bg-white text-[color:var(--text)] shadow-[0_6px_14px_rgba(52,70,63,0.06)]" : "text-[color:var(--muted)]"
              }`}
            >
              Cookbook
            </button>
            <button
              type="button"
              onClick={() => setLeftSidebarMode("version-history")}
              className={`rounded-[18px] px-3 py-2 text-sm font-semibold transition ${
                leftSidebarMode === "version-history" ? "bg-white text-[color:var(--text)] shadow-[0_6px_14px_rgba(52,70,63,0.06)]" : "text-[color:var(--muted)]"
              }`}
            >
              Version history
            </button>
          </div>

          {leftSidebarMode === "recipe-nav" ? (
            <RecipeNavigationSection
              currentRecipeId={recipeId}
              recipe={recipe!}
              recipeSearch={sidebar.recipeSearch}
              searchResults={sidebar.searchResults}
              sidebarActionError={sidebar.sidebarActionError}
              onRecipeSearchChange={sidebar.setRecipeSearch}
              onRecipeNavigate={navigateToRecipe}
              onOpenRecipeMenu={(targetRecipeId, rect) => {
                sidebar.setMenuAnchor(openMenuAtRect(rect));
                sidebar.setOpenMenuRecipeId(targetRecipeId);
              }}
            />
          ) : (
            <VersionRailSection
              currentVersion={version!}
              recipe={recipe!}
              timelineVersions={timelineVersions}
              timelineHasMore={timelineHasMore}
              timelineLoadingMore={timelineLoadingMore}
              onVersionNavigate={navigateToVersion}
              onLoadMoreVersions={() => void loadMoreVersions()}
              onOpenVersionMenu={(targetVersionId, rect) => {
                sidebar.setVersionMenuAnchor(openMenuAtRect(rect));
                sidebar.setOpenVersionMenuId(targetVersionId);
              }}
            />
          )}
        </div>
      </ShellContextPanel>

      <ShellContextPanel
        side="right"
        label="Tools"
        title="Recipe tools"
        description="Use this panel for version navigation, metrics, prep cues, and Chef support while the main canvas stays focused on the current recipe."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 rounded-[22px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,252,246,0.88)] p-1.5">
            {[
              { key: "overview", label: "Overview" },
              { key: "prep", label: "Prep" },
              { key: "chef", label: "Chef" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setRightSidebarMode(tab.key as "overview" | "prep" | "chef")}
                className={`rounded-[18px] px-3 py-2 text-sm font-semibold transition ${
                  rightSidebarMode === tab.key ? "bg-white text-[color:var(--text)] shadow-[0_6px_14px_rgba(52,70,63,0.06)]" : "text-[color:var(--muted)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {rightSidebarMode === "overview" ? (
            <>
              <MetricsPanel prepMinutes={prepMinutes} cookMinutes={cookMinutes} difficulty={difficulty} servings={displayServings || servings} />
              <NutritionPanel nutrition={nutrition} totalMinutes={totalMinutes} />
            </>
          ) : null}

          {rightSidebarMode === "prep" ? (
            <PrepPlanPanel
              prepPlan={prepPlan}
              completedChecklistIds={completedPrepIds}
              onToggleChecklistItem={(itemId) => {
                openRightPanelMode("prep");
                const completed = !completedPrepIds.includes(itemId);
                setCompletedPrepIds((current) => (completed ? [...current, itemId] : current.filter((id) => id !== itemId)));
                void fetch(`/api/recipes/${recipeId}/versions/${versionId}/prep-progress`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ checklist_item_id: itemId, completed }),
                });
              }}
            />
          ) : null}

          {rightSidebarMode === "chef" ? (
            <ChefAiPanel
              aiConversation={assistant.aiConversation}
              selectedDirection={assistant.selectedDirection}
              customInstruction={assistant.customInstruction}
              suggestedChange={assistant.suggestedChange}
              isAskingAi={assistant.isAskingAi}
              isGeneratingVersion={assistant.isGeneratingVersion}
              aiError={assistant.aiError}
              onQuickAction={(instruction) => {
                openRightPanelMode("chef");
                void handleQuickAction(instruction);
              }}
              onRemixLeftovers={() => {
                openRightPanelMode("chef");
                void handleRemixLeftovers();
              }}
              onInstructionChange={assistant.setCustomInstruction}
              onAskSubmit={() => {
                openRightPanelMode("chef");
                void handleAskAiSubmit();
              }}
              onSelectDirection={(messageId, option) => handleSelectAssistantDirection(messageId, option)}
              onClearDirection={handleClearAssistantDirection}
              onApplySuggestedChange={() => {
                openRightPanelMode("chef");
                void handleApplySuggestedChange();
              }}
              onComposerFocus={() => openRightPanelMode("chef")}
              conversationEndRef={assistant.conversationEndRef}
            />
          ) : null}
        </div>
      </ShellContextPanel>

      <RecipeActionMenu
        activeRecipe={activeMenuRecipe}
        menuAnchor={sidebar.menuAnchor}
        deletingRecipeId={sidebar.deletingRecipeId}
        onClose={closeRecipeMenu}
        onDelete={(targetRecipeId, title) => void deleteRecipe(targetRecipeId, title)}
        onHide={(targetRecipeId) => void hideRecipe(targetRecipeId)}
        onArchive={(targetRecipeId) => void archiveRecipe(targetRecipeId)}
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

      <div className="xl:grid xl:grid-cols-[280px_minmax(0,1fr)_360px] xl:gap-6">
        <div className="hidden xl:block">
          <RecipeSidebar
            navigationRef={desktopRecipeNavRef}
            historyRef={desktopVersionHistoryRef}
            currentRecipeId={recipeId}
            currentVersion={version!}
            recipe={recipe!}
            recipeSearch={sidebar.recipeSearch}
            searchResults={sidebar.searchResults}
            timelineVersions={timelineVersions}
            timelineHasMore={timelineHasMore}
            timelineLoadingMore={timelineLoadingMore}
            sidebarActionError={sidebar.sidebarActionError}
            onRecipeSearchChange={sidebar.setRecipeSearch}
            onRecipeNavigate={navigateToRecipe}
            onVersionNavigate={navigateToVersion}
            onLoadMoreVersions={() => void loadMoreVersions()}
            onOpenRecipeMenu={(targetRecipeId, rect) => {
              sidebar.setMenuAnchor(openMenuAtRect(rect));
              sidebar.setOpenMenuRecipeId(targetRecipeId);
            }}
            onOpenVersionMenu={(targetVersionId, rect) => {
              sidebar.setVersionMenuAnchor(openMenuAtRect(rect));
              sidebar.setOpenVersionMenuId(targetVersionId);
            }}
          />
        </div>

        <VersionMainPanels
          recipe={recipe!}
          version={version!}
          ingredients={displayIngredients}
          displayServings={displayServings}
          canAdjustServings={canAdjustServings}
          onSetTargetServings={setTargetServings}
          steps={steps}
          topPhotoUrl={topPhotoUrl}
          userId={userId}
          photosWithUrls={photosWithUrls}
          onShare={() => void shareVersion()}
          onViewVersionHistory={() => openLeftPanelMode("version-history")}
          galleryLoading={galleryLoading}
        />

        <aside className="hidden space-y-4 xl:block xl:sticky xl:top-28 xl:self-start">
          <MetricsPanel prepMinutes={prepMinutes} cookMinutes={cookMinutes} difficulty={difficulty} servings={displayServings || servings} />
          <NutritionPanel nutrition={nutrition} totalMinutes={totalMinutes} />
          <PrepPlanPanel
            prepPlan={prepPlan}
            completedChecklistIds={completedPrepIds}
            onToggleChecklistItem={(itemId) => {
              const completed = !completedPrepIds.includes(itemId);
              setCompletedPrepIds((current) => (completed ? [...current, itemId] : current.filter((id) => id !== itemId)));
              void fetch(`/api/recipes/${recipeId}/versions/${versionId}/prep-progress`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ checklist_item_id: itemId, completed }),
              });
            }}
          />
          <ChefAiPanel
            aiConversation={assistant.aiConversation}
            selectedDirection={assistant.selectedDirection}
            customInstruction={assistant.customInstruction}
            suggestedChange={assistant.suggestedChange}
            isAskingAi={assistant.isAskingAi}
            isGeneratingVersion={assistant.isGeneratingVersion}
            aiError={assistant.aiError}
            onQuickAction={(instruction) => void handleQuickAction(instruction)}
            onRemixLeftovers={() => void handleRemixLeftovers()}
            onInstructionChange={assistant.setCustomInstruction}
            onAskSubmit={() => void handleAskAiSubmit()}
            onSelectDirection={(messageId, option) => handleSelectAssistantDirection(messageId, option)}
            onClearDirection={handleClearAssistantDirection}
            onApplySuggestedChange={() => void handleApplySuggestedChange()}
            conversationEndRef={assistant.conversationEndRef}
          />
        </aside>
      </div>
    </div>
  );
}
