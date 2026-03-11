"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { RecipeContext } from "@/lib/ai/chatPromptBuilder";
import { supabase } from "@/lib/supabaseClient";
import { createRecipeWithVersion } from "@/lib/client/recipeMutations";
import { trackEventInBackground } from "@/lib/trackEventInBackground";
import {
  buildSmartFallbackIdeas,
  cookTimeLabelToMinutes,
  matchesCookTime,
  matchesCuisine,
  matchesProtein,
  normalizeIdeas,
} from "@/components/home/ideaUtils";
import type { ChatMessage, GeneratedRecipe, RecipeIdea } from "@/components/home/types";

const MAX_IDEA_COUNT = 12;
const IDEA_BATCH_SIZE = 6;

type IdeaSource = "mood" | "ingredients" | "smart" | "trending" | null;

const toggleSelection = (current: string[], value: string) =>
  current.includes(value) ? current.filter((item) => item !== value) : [...current, value];

const detectPromptType = (prompt: string): "ingredients" | "mood" => {
  const normalized = prompt.trim();
  if (!normalized) {
    return "mood";
  }

  const ingredientSeparators = normalized.split(/\n|,/g).filter((item) => item.trim().length > 0);
  const shortItems = ingredientSeparators.filter((item) => item.trim().split(/\s+/).length <= 3);

  if (ingredientSeparators.length >= 3 && shortItems.length === ingredientSeparators.length) {
    return "ingredients";
  }

  return "mood";
};

const extractIngredientsFromPrompt = (prompt: string) =>
  prompt
    .split(/\n|,/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const dedupeIdeas = (ideas: RecipeIdea[]) => {
  const unique = new Map<string, RecipeIdea>();
  for (const idea of ideas) {
    const key = idea.title.trim().toLowerCase();
    if (!key || unique.has(key)) {
      continue;
    }
    unique.set(key, idea);
  }
  return Array.from(unique.values());
};

const buildHeroConversationContext = (messages: ChatMessage[]) =>
  messages
    .map((message) => `${message.role === "user" ? "User" : "Chef"}: ${message.text}`)
    .join("\n");

export function useHomeHubAi() {
  const router = useRouter();
  const [promptInput, setPromptInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatingRecipe, setGeneratingRecipe] = useState(false);
  const [selectedIdeaTitle, setSelectedIdeaTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<RecipeIdea[]>([]);
  const [ideaSource, setIdeaSource] = useState<IdeaSource>(null);
  const [ideaBatchIndex, setIdeaBatchIndex] = useState(1);

  const [smartProteins, setSmartProteins] = useState<string[]>([]);
  const [smartCuisines, setSmartCuisines] = useState<string[]>([]);
  const [smartCookTimes, setSmartCookTimes] = useState<string[]>([]);
  const [smartPreferences, setSmartPreferences] = useState<string[]>([]);
  const [smartIdeas, setSmartIdeas] = useState<RecipeIdea[]>([]);
  const [smartLoading, setSmartLoading] = useState(false);
  const [smartGeneratingRecipe, setSmartGeneratingRecipe] = useState(false);
  const [smartSelectedIdeaTitle, setSmartSelectedIdeaTitle] = useState<string | null>(null);
  const [smartError, setSmartError] = useState<string | null>(null);
  const [smartStatus, setSmartStatus] = useState<string | null>(null);

  const [heroChatMessages, setHeroChatMessages] = useState<ChatMessage[]>([]);
  const [heroChatReadyToApply, setHeroChatReadyToApply] = useState(false);
  const heroChatFrameRef = useRef<HTMLDivElement | null>(null);
  const heroChatViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!heroChatViewportRef.current) {
      return;
    }
    heroChatViewportRef.current.scrollTop = heroChatViewportRef.current.scrollHeight;
  }, [heroChatMessages]);

  const saveGeneratedRecipe = async (recipe: GeneratedRecipe, source: string) => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Please sign in again.");
    }

    const created = await createRecipeWithVersion({
      ownerId: user.id,
      title: recipe.title,
      description: recipe.description,
      version: {
        versionNumber: 1,
        servings: recipe.servings,
        prep_time_min: recipe.prep_time_min,
        cook_time_min: recipe.cook_time_min,
        difficulty: recipe.difficulty,
        ingredients_json: recipe.ingredients,
        steps_json: recipe.steps,
        change_log: "Created from AI Home Hub",
      },
    });

    trackEventInBackground("recipe_created", {
      recipeId: created.recipeId,
      source,
    });
    trackEventInBackground("version_created", {
      recipeId: created.recipeId,
      versionNumber: 1,
      source,
    });

    return {
      recipeId: created.recipeId,
      versionId: created.versionId,
    };
  };

  const invokeAi = async (body: Record<string, unknown>) => {
    const response = await fetch("/api/ai/home", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as { error?: boolean; message?: string } & Record<string, unknown>;
    if (!response.ok || data?.error) {
      throw new Error(typeof data.message === "string" ? data.message : "AI request failed.");
    }

    return data;
  };

  const runIdeaGeneration = async ({
    mode,
    source,
    prompt,
    ingredients,
  }: {
    mode: "mood_ideas" | "ingredients_ideas";
    source: Exclude<IdeaSource, "smart" | "trending" | null>;
    prompt?: string;
    ingredients?: string[];
  }) => {
    setLoading(true);
    setError(null);
    setStatus("Generating recipe ideas...");

    try {
      const data = await invokeAi({
        mode,
        prompt,
        ingredients,
        exclude_titles: [],
        batch_index: 1,
      });

      const nextIdeas = dedupeIdeas(normalizeIdeas(data?.ideas));
      if (nextIdeas.length === 0) {
        throw new Error("No recipe ideas were generated.");
      }

      setIdeas(nextIdeas.slice(0, IDEA_BATCH_SIZE));
      setIdeaSource(source);
      setIdeaBatchIndex(1);
      setStatus("Choose an idea to generate the full recipe.");
    } catch (aiError) {
      setError(aiError instanceof Error ? aiError.message : "Failed to generate recipe ideas.");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const generateRecipeFromIdea = async (ideaOrTitle: RecipeIdea | string, sourceOverride?: string) => {
    const selectedIdea =
      typeof ideaOrTitle === "string" ? { title: ideaOrTitle, description: ideaOrTitle, cook_time_min: 30 } : ideaOrTitle;
    const source = sourceOverride ?? ideaSource ?? "mood";

    setGeneratingRecipe(true);
    setSelectedIdeaTitle(selectedIdea.title);
    setError(null);
    setStatus("Generating full recipe...");

    try {
      const ingredients = detectPromptType(promptInput) === "ingredients" ? extractIngredientsFromPrompt(promptInput) : undefined;
      const data = await invokeAi({
        mode: "idea_recipe",
        ideaTitle: selectedIdea.title,
        prompt: promptInput.trim() || selectedIdea.description,
        ingredients,
      });

      const recipe = data.recipe as GeneratedRecipe;
      const created = await saveGeneratedRecipe(recipe, source);
      router.push(`/recipes/${created.recipeId}/versions/${created.versionId}`);
    } catch (aiError) {
      setError(aiError instanceof Error ? aiError.message : "Failed to generate full recipe.");
      throw aiError;
    } finally {
      setGeneratingRecipe(false);
      setSelectedIdeaTitle(null);
      setStatus(null);
    }
  };

  const handleSelectIdea = async (idea: RecipeIdea) => {
    await generateRecipeFromIdea(idea, ideaSource ?? "mood");
  };

  const handleGenerateMoreIdeas = async () => {
    if (!ideaSource || ideas.length >= MAX_IDEA_COUNT) {
      return;
    }

    const nextBatchIndex = ideaBatchIndex + 1;
    setLoading(true);
    setError(null);
    setStatus("Generating more ideas...");

    try {
      const mode = ideaSource === "ingredients" ? "ingredients_ideas" : "mood_ideas";
      const data = await invokeAi({
        mode,
        prompt: promptInput.trim(),
        ingredients: ideaSource === "ingredients" ? extractIngredientsFromPrompt(promptInput) : undefined,
        exclude_titles: ideas.map((idea) => idea.title),
        batch_index: nextBatchIndex,
      });

      const mergedIdeas = dedupeIdeas([...ideas, ...normalizeIdeas(data?.ideas)]).slice(0, MAX_IDEA_COUNT);
      setIdeas(mergedIdeas);
      setIdeaBatchIndex(nextBatchIndex);
      setStatus("Choose an idea to generate the full recipe.");
    } catch (aiError) {
      setError(aiError instanceof Error ? aiError.message : "Failed to generate more ideas.");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAskChefInHero = async () => {
    const trimmedPrompt = promptInput.trim();
    if (!trimmedPrompt) {
      setError("Enter what you want to cook first.");
      return;
    }

    setLoading(true);
    setError(null);
    setStatus("Chef is thinking...");

    try {
      const recipeContext: RecipeContext =
        ideas.length > 0
          ? {
              title: ideas[0]?.title,
              ingredients: extractIngredientsFromPrompt(promptInput),
              steps: heroChatMessages.filter((message) => message.role === "ai").map((message) => message.text),
            }
          : null;

      const data = (await invokeAi({
        mode: "chef_chat",
        userMessage: trimmedPrompt,
        recipeContext,
      })) as { reply?: string; message?: string };

      if (!data.reply) {
        throw new Error(data.message ?? "Chef chat failed.");
      }

      setHeroChatMessages((current) => [...current, { role: "user", text: trimmedPrompt }, { role: "ai", text: data.reply! }]);
      setHeroChatReadyToApply(true);
      setStatus("Chef suggestions are ready to apply.");
      setPromptInput("");
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "Chef chat failed.");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyHeroChatIdeas = async () => {
    const conversation = buildHeroConversationContext(heroChatMessages);
    if (!conversation) {
      setError("Ask Chef something first.");
      return;
    }

    await runIdeaGeneration({
      mode: "mood_ideas",
      source: "mood",
      prompt: `Build recipe ideas from this chef conversation:\n${conversation}`,
    });
  };

  const handleHeroInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    void handleAskChefInHero();
  };

  const toggleSmartProtein = (value: string) => {
    setSmartProteins((current) => toggleSelection(current, value));
  };

  const toggleSmartCuisine = (value: string) => {
    setSmartCuisines((current) => toggleSelection(current, value));
  };

  const toggleSmartCookTime = (value: string) => {
    setSmartCookTimes((current) => toggleSelection(current, value));
  };

  const toggleSmartPreference = (value: string) => {
    setSmartPreferences((current) => toggleSelection(current, value));
  };

  const handleGenerateSmartMeals = async () => {
    setSmartLoading(true);
    setSmartError(null);
    setSmartStatus("Generating recipe ideas...");

    const filters = {
      cuisine: smartCuisines[0] ?? "Any",
      protein: smartProteins[0] ?? "Any",
      mealType: "Dinner",
      cookingTime: smartCookTimes[0] ?? "30 min",
    };

    try {
      const data = await invokeAi({
        mode: "filtered_ideas",
        filters,
      });

      const cookTimeMinutes = smartCookTimes.map(cookTimeLabelToMinutes);
      const normalized = normalizeIdeas(data?.ideas);
      const filtered = normalized.filter((idea) => {
        const haystack = `${idea.title} ${idea.description}`.toLowerCase();
        return (
          matchesProtein(haystack, smartProteins) &&
          matchesCuisine(haystack, smartCuisines) &&
          matchesCookTime(idea.cook_time_min, cookTimeMinutes)
        );
      });

      const nextIdeas = dedupeIdeas(
        filtered.length > 0
          ? filtered
          : buildSmartFallbackIdeas(smartProteins, smartCuisines, cookTimeMinutes, smartPreferences)
      );

      setSmartIdeas(nextIdeas);
      setSmartStatus("Select an idea to generate the full recipe.");
    } catch (aiError) {
      setSmartError(aiError instanceof Error ? aiError.message : "Failed to generate smart meal ideas.");
      setSmartStatus(null);
    } finally {
      setSmartLoading(false);
    }
  };

  const handleSelectSmartIdea = async (idea: RecipeIdea) => {
    setSmartGeneratingRecipe(true);
    setSmartSelectedIdeaTitle(idea.title);
    setSmartError(null);
    setSmartStatus("Generating full recipe...");

    try {
      await generateRecipeFromIdea(idea, "smart");
    } catch (aiError) {
      setSmartError(aiError instanceof Error ? aiError.message : "Failed to generate smart recipe.");
    } finally {
      setSmartGeneratingRecipe(false);
      setSmartSelectedIdeaTitle(null);
      setSmartStatus(null);
    }
  };

  return {
    MAX_IDEA_COUNT,
    promptInput,
    setPromptInput,
    loading,
    generatingRecipe,
    selectedIdeaTitle,
    error,
    status,
    ideas,
    smartProteins,
    smartCuisines,
    smartCookTimes,
    smartPreferences,
    smartIdeas,
    smartLoading,
    smartGeneratingRecipe,
    smartSelectedIdeaTitle,
    smartError,
    smartStatus,
    heroChatMessages,
    heroChatReadyToApply,
    heroChatFrameRef,
    heroChatViewportRef,
    handleHeroInputKeyDown,
    handleAskChefInHero,
    handleApplyHeroChatIdeas,
    handleGenerateMoreIdeas,
    handleSelectIdea,
    generateRecipeFromIdea,
    toggleSmartPreference,
    toggleSmartProtein,
    toggleSmartCuisine,
    toggleSmartCookTime,
    handleGenerateSmartMeals,
    handleSelectSmartIdea,
  };
}
