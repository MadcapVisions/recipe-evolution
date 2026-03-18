"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { AIMessage, RecipeContext } from "@/lib/ai/chatPromptBuilder";
import type { ChefChatEnvelope, ChefDirectionOption } from "@/lib/ai/chefOptions";
import { deriveIdeaTitleFromConversationContext, recipeMatchesRequestedDirection } from "@/lib/ai/homeRecipeAlignment";
import {
  buildDirectionSummary,
  buildFocusedChatHistory,
  buildFocusedRecipeConversation,
  buildReplyBranch,
  buildSelectedDirectionConversation,
} from "@/lib/ai/homeConversationFocus";
import { generateLocalChefReply, generateLocalRecipeDraft, generateLocalRecipeIdeas } from "@/lib/localRecipeGenerator";
import { createRecipeFromDraft, getCreatedRecipeHref } from "@/lib/client/recipeMutations";
import { repairRecipeDraftIngredientLines, type RecipeDraft } from "@/lib/recipes/recipeDraft";
import type { AiRecipeResult } from "@/lib/ai/recipeResult";
import { trackEventInBackground } from "@/lib/trackEventInBackground";
import { COOKING_SCOPE_MESSAGE, guardCookingTopic } from "@/lib/ai/topicGuard";
import {
  buildSmartFallbackIdeas,
  cookTimeLabelToMinutes,
  matchesCookTime,
  matchesCuisine,
  matchesProtein,
  normalizeIdeas,
} from "@/components/home/ideaUtils";
import type { ChatMessage, GeneratedRecipe, RecipeIdea, SelectedChefDirection, UserTasteProfile } from "@/components/home/types";

const MAX_IDEA_COUNT = 2;
const IDEA_BATCH_SIZE = 2;

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
    .filter((message) => message.kind !== "direction_selected")
    .map((message) => `${message.role === "user" ? "User" : "Chef"}: ${message.text}`)
    .join("\n");

const buildConversationHistory = (messages: ChatMessage[]): AIMessage[] =>
  messages
    .filter((message) => message.kind !== "direction_selected")
    .map((message) => ({
      role: message.role === "user" ? "user" : "assistant",
      content: message.text,
    }));

const buildLockedDirectionMessages = (messages: ChatMessage[], selectedDirection: SelectedChefDirection): ChatMessage[] => {
  const trailingMessages = messages
    .slice(selectedDirection.replyIndex + 1)
    .filter((message) => message.kind !== "direction_selected");

  return [
    {
      role: "ai",
      text: `Locked direction: ${selectedDirection.title}. ${selectedDirection.summary}`,
      kind: "message",
    },
    ...trailingMessages,
  ];
};

const buildRecipeSeedFromConversation = (
  messages: ChatMessage[],
  userTasteProfile: UserTasteProfile | null,
  selectedDirection: SelectedChefDirection | null
) => {
  const focusedMessages =
    selectedDirection != null
      ? buildLockedDirectionMessages(messages, selectedDirection)
      : buildFocusedRecipeConversation(messages);
  const conversationText = buildHeroConversationContext(focusedMessages);
  const latestAssistantReply =
    [...focusedMessages]
      .reverse()
      .find((message) => message.role === "ai")
      ?.text.trim() ?? "";
  const latestUserPrompt =
    [...focusedMessages]
      .reverse()
      .find((message) => message.role === "user")
      ?.text.trim() ?? conversationText;
  const selectedSummary = selectedDirection?.summary?.trim() ?? "";
  const buildPrompt =
    [selectedSummary, buildDirectionSummary(focusedMessages), latestAssistantReply, latestUserPrompt]
      .filter((item) => item.length > 0)
      .join("\n\n")
      .trim();
  const ideaTitle =
    selectedDirection?.title?.trim() ||
    deriveIdeaTitleFromConversationContext(buildPrompt || conversationText) ||
    generateLocalRecipeIdeas(buildPrompt || conversationText, [], userTasteProfile ?? undefined)[0]?.title ||
    "Chef Conversation Recipe";

  return {
    conversationText,
    latestAssistantReply,
    ideaTitle,
    latestUserPrompt: buildPrompt || latestUserPrompt,
    ingredients: undefined,
    conversationHistory: buildConversationHistory(focusedMessages),
  };
};

const buildSelectedDirectionForMessages = (messages: ChatMessage[], selectedDirection: SelectedChefDirection | null) => {
  if (!selectedDirection) {
    return null;
  }

  const replyIndex = messages.findLastIndex((message) => message.role === "ai");
  if (replyIndex < 0) {
    return null;
  }

  return {
    ...selectedDirection,
    replyIndex,
  };
};

const getRecipeBuildErrorMessage = (error: unknown, fallbackMessage: string) => {
  const message = error instanceof Error ? error.message.trim() : "";
  if (!message) {
    return fallbackMessage;
  }

  if (message.includes("Each ingredient needs a quantity")) {
    return "Chef drafted a recipe, but some ingredients were missing amounts. Please try again or switch to a stronger recipe model in Admin.";
  }

  if (message.startsWith("[{") || message.startsWith('["')) {
    return fallbackMessage;
  }

  return message;
};

const NEW_EXPLORATION_PATTERNS = [
  /\bgive me\b/,
  /\bshow me\b/,
  /\bi want\b/,
  /\bi need\b/,
  /\bwhat can i make\b/,
  /\bwhat should i make\b/,
  /\bideas?\b/,
  /\boptions?\b/,
  /\bvariations?\b/,
  /\balternatives?\b/,
];

const REFINEMENT_REFERENCE_PATTERNS = [
  /\bmake (?:it|this)\b/,
  /\bthis\b/,
  /\bit\b/,
  /\bthat\b/,
  /\binstead\b/,
  /\bwithout\b/,
  /\bleave out\b/,
  /\bskip\b/,
  /\bremove\b/,
  /\bi (?:don't|do not) like\b/,
  /\bi prefer\b/,
];

function shouldStartNewChefDirection(prompt: string) {
  const normalized = prompt.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const asksForFreshExploration = NEW_EXPLORATION_PATTERNS.some((pattern) => pattern.test(normalized));
  const looksLikeRefinement = REFINEMENT_REFERENCE_PATTERNS.some((pattern) => pattern.test(normalized));

  return asksForFreshExploration && !looksLikeRefinement;
}

export function useHomeHubAi(userTasteProfile: UserTasteProfile | null) {
  const router = useRouter();
  const conversationKeyRef = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `home-${Date.now()}`
  );
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
  const [selectedChefDirection, setSelectedChefDirection] = useState<SelectedChefDirection | null>(null);
  const [activeChatRecipeIndex, setActiveChatRecipeIndex] = useState<number | null>(null);
  const heroChatFrameRef = useRef<HTMLDivElement | null>(null);
  const heroChatViewportRef = useRef<HTMLDivElement | null>(null);
  const heroSubmitLockRef = useRef(false);
  const lastHeroPromptRef = useRef<{ value: string; at: number } | null>(null);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!heroChatViewportRef.current) {
      return;
    }
    heroChatViewportRef.current.scrollTop = heroChatViewportRef.current.scrollHeight;
  }, [heroChatMessages]);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, []);

  const saveGeneratedRecipe = async (recipe: RecipeDraft, source: string) => {
    const repairedDraft: RecipeDraft = {
      ...recipe,
      ingredients: repairRecipeDraftIngredientLines(recipe.ingredients),
    };
    const created = await createRecipeFromDraft({
      draft: {
        ...repairedDraft,
        change_log: repairedDraft.change_log ?? "Created from AI Home Hub",
      },
    });

    trackEventInBackground("recipe_created", {
      recipeId: created.recipeId,
      source,
      title: recipe.title,
      description: recipe.description,
      prompt: promptInput.trim() || null,
    });
    trackEventInBackground("version_created", {
      recipeId: created.recipeId,
      versionNumber: 1,
      source,
      title: repairedDraft.title,
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

  const describeAiOutage = (rawError: unknown, fallbackLabel: string) => {
    const message = rawError instanceof Error ? rawError.message : "";
    if (message.includes("(429)") || message.toLowerCase().includes("toomanyrequests")) {
      return `${fallbackLabel} while Chef AI is rate-limited.`;
    }
    return `${fallbackLabel} while AI is unavailable.`;
  };

  const setTransientStatus = (message: string | null, durationMs = 4500) => {
    setStatus(message);
    if (!message || typeof window === "undefined") {
      return;
    }

    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }

    statusTimeoutRef.current = setTimeout(() => {
      setStatus((current) => (current === message ? null : current));
      statusTimeoutRef.current = null;
    }, durationMs);
  };

  const goToCreatedRecipe = (recipeId: string, versionId: string) => {
    const href = getCreatedRecipeHref({ recipeId, versionId });

    if (typeof window !== "undefined") {
      window.location.assign(href);
      return;
    }

    router.push(href);
    router.refresh();
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
    setStatus("Developing directions...");

    try {
      const data = await invokeAi({
        mode,
        prompt,
        ingredients,
        exclude_titles: [],
        batch_index: 1,
        requested_count: IDEA_BATCH_SIZE,
      });

      const nextIdeas = dedupeIdeas(normalizeIdeas(data?.ideas));
      if (nextIdeas.length === 0) {
        throw new Error("No recipe ideas were generated.");
      }

      setIdeas(nextIdeas.slice(0, IDEA_BATCH_SIZE));
      setIdeaSource(source);
      setIdeaBatchIndex(1);
      setTransientStatus("Choose a direction to turn into a full recipe.");
    } catch (aiError) {
      const fallbackIdeas = dedupeIdeas(
        generateLocalRecipeIdeas(prompt ?? ingredients?.join(" ") ?? "", ingredients ?? [], userTasteProfile ?? undefined)
      );
      setIdeas(fallbackIdeas.slice(0, IDEA_BATCH_SIZE));
      setIdeaSource(source);
      setIdeaBatchIndex(1);
      setError(null);
      setStatus("Showing fallback directions while Chef is unavailable.");
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
    setStatus("Building full recipe...");

    try {
      const ingredients = detectPromptType(promptInput) === "ingredients" ? extractIngredientsFromPrompt(promptInput) : undefined;
      const data = await invokeAi({
        mode: "idea_recipe",
        ideaTitle: selectedIdea.title,
        prompt: promptInput.trim() || selectedIdea.description,
        ingredients,
      });

      const recipe = ((data.result as AiRecipeResult | undefined)?.recipe ?? data.recipe) as GeneratedRecipe;
      const created = await saveGeneratedRecipe(recipe, source);
      goToCreatedRecipe(created.recipeId, created.versionId);
    } catch (aiError) {
      try {
        const fallbackRecipe = generateLocalRecipeDraft(
          {
            ideaTitle: selectedIdea.title,
            prompt: promptInput.trim() || selectedIdea.description,
            ingredients: detectPromptType(promptInput) === "ingredients" ? extractIngredientsFromPrompt(promptInput) : undefined,
          },
          userTasteProfile ?? undefined
        );
        const created = await saveGeneratedRecipe(fallbackRecipe, `${source}-fallback`);
        goToCreatedRecipe(created.recipeId, created.versionId);
      } catch (saveError) {
        setError(getRecipeBuildErrorMessage(saveError, "Could not build or save the recipe."));
        setStatus(null);
      }
    } finally {
      setGeneratingRecipe(false);
      setSelectedIdeaTitle(null);
      setStatus(null);
    }
  };

  const createRecipeFromConversation = async (
    messages: ChatMessage[],
    source = "chef-chat",
    selectedDirectionOverride: SelectedChefDirection | null = selectedChefDirection
  ) => {
    const { conversationText, ideaTitle, latestUserPrompt, ingredients, conversationHistory } = buildRecipeSeedFromConversation(
      messages,
      userTasteProfile,
      selectedDirectionOverride
    );
    if (!conversationText.trim()) {
      setError("Ask Chef something first.");
      return;
    }

    setGeneratingRecipe(true);
    setError(null);
    setStatus("Building recipe...");

    try {
      const data = await invokeAi({
        mode: "idea_recipe",
        ideaTitle,
        prompt: latestUserPrompt,
        ingredients,
        conversationHistory,
      });

      const recipe = ((data.result as AiRecipeResult | undefined)?.recipe ?? data.recipe) as GeneratedRecipe;
      const created = await saveGeneratedRecipe(recipe, source);
      goToCreatedRecipe(created.recipeId, created.versionId);
    } catch {
      try {
        const fallbackRecipe = generateLocalRecipeDraft(
          {
            ideaTitle,
            prompt: latestUserPrompt,
            ingredients,
          },
          userTasteProfile ?? undefined
        );
        if (!recipeMatchesRequestedDirection(fallbackRecipe, `${ideaTitle} ${latestUserPrompt} ${conversationText}`)) {
          throw new Error("Chef draft drifted from the requested dish.");
        }
        const created = await saveGeneratedRecipe(fallbackRecipe, `${source}-fallback`);
        goToCreatedRecipe(created.recipeId, created.versionId);
      } catch (saveError) {
        setError(
          getRecipeBuildErrorMessage(saveError, "Could not build or save the recipe from this conversation.")
        );
        setStatus(null);
      }
    } finally {
      setGeneratingRecipe(false);
      setSelectedIdeaTitle(null);
      setActiveChatRecipeIndex(null);
      setStatus(null);
    }
  };

  const handleSelectIdea = async (idea: RecipeIdea) => {
    await generateRecipeFromIdea(idea, ideaSource ?? "mood");
  };

  const handleGenerateMoreIdeas = async () => {
    if (loading || !ideaSource || ideas.length >= MAX_IDEA_COUNT) {
      return;
    }

    const nextBatchIndex = ideaBatchIndex + 1;
    setLoading(true);
    setError(null);
    setStatus("Developing more directions...");

    try {
      const mode = ideaSource === "ingredients" ? "ingredients_ideas" : "mood_ideas";
      const data = await invokeAi({
        mode,
        prompt: promptInput.trim(),
        ingredients: ideaSource === "ingredients" ? extractIngredientsFromPrompt(promptInput) : undefined,
        exclude_titles: ideas.map((idea) => idea.title),
        batch_index: nextBatchIndex,
        requested_count: IDEA_BATCH_SIZE,
      });

      const mergedIdeas = dedupeIdeas([...ideas, ...normalizeIdeas(data?.ideas)]).slice(0, MAX_IDEA_COUNT);
      setIdeas(mergedIdeas);
      setIdeaBatchIndex(nextBatchIndex);
      setTransientStatus("Choose a direction to turn into a full recipe.");
    } catch (aiError) {
      const fallbackIdeas = generateLocalRecipeIdeas(promptInput.trim(), [], userTasteProfile ?? undefined).filter(
        (idea) => !ideas.some((existing) => existing.title.toLowerCase() === idea.title.toLowerCase())
      );
      setIdeas(dedupeIdeas([...ideas, ...fallbackIdeas]).slice(0, MAX_IDEA_COUNT));
      setError(null);
      setStatus(describeAiOutage(aiError, "Added fallback ideas"));
    } finally {
      setLoading(false);
    }
  };

  const handleAskChefInHero = async () => {
    if (loading || heroSubmitLockRef.current) {
      return;
    }

    const trimmedPrompt = promptInput.trim();
    if (!trimmedPrompt) {
      setError("Enter a dish direction first.");
      return;
    }

    const lastPrompt = lastHeroPromptRef.current;
    if (lastPrompt && lastPrompt.value === trimmedPrompt && Date.now() - lastPrompt.at < 2000) {
      return;
    }

    heroSubmitLockRef.current = true;
    lastHeroPromptRef.current = { value: trimmedPrompt, at: Date.now() };
    setLoading(true);
    setError(null);
    setStatus("Chef is refining...");

    try {
      const startsNewDirection = selectedChefDirection != null && shouldStartNewChefDirection(trimmedPrompt);
      const focusedMessages = buildFocusedRecipeConversation(heroChatMessages);
      const directionSummary = buildDirectionSummary(focusedMessages);
      const activeDirectionMessages =
        startsNewDirection
          ? []
          : selectedChefDirection != null
          ? buildLockedDirectionMessages(heroChatMessages, selectedChefDirection)
          : focusedMessages;
      const activeDirectionSummary =
        startsNewDirection
          ? ""
          : selectedChefDirection?.summary?.trim() || buildDirectionSummary(activeDirectionMessages) || directionSummary;
      const recipeContext: RecipeContext =
        activeDirectionMessages.length > 0
          ? {
              title: selectedChefDirection?.title || deriveIdeaTitleFromConversationContext(activeDirectionSummary || buildHeroConversationContext(activeDirectionMessages)),
              ingredients: extractIngredientsFromPrompt(activeDirectionSummary || trimmedPrompt),
              steps: activeDirectionMessages.filter((message) => message.role === "ai").map((message) => message.text),
            }
          : ideas.length > 0
            ? {
                title: ideas[0]?.title,
                ingredients: extractIngredientsFromPrompt(trimmedPrompt),
                steps: [],
              }
            : null;

      const topicGuard = guardCookingTopic({
        message: trimmedPrompt,
        recipeContext,
      });

      if (!topicGuard.allowed) {
        setError(COOKING_SCOPE_MESSAGE);
        setStatus(null);
        return;
      }

      setPromptInput("");
      trackEventInBackground("chef_chat_prompt", {
        prompt: trimmedPrompt,
        source: "home-hub",
        messageCount: heroChatMessages.length,
      });

      const data = (await invokeAi({
        mode: "chef_chat",
        userMessage: trimmedPrompt,
        recipeContext,
        conversationHistory:
          startsNewDirection
            ? []
            : selectedChefDirection != null
            ? buildConversationHistory(buildLockedDirectionMessages(heroChatMessages, selectedChefDirection).slice(-6))
            : buildFocusedChatHistory(heroChatMessages),
        conversationKey: conversationKeyRef.current,
      })) as ChefChatEnvelope & { message?: string };

      if (!data.reply) {
        throw new Error(data.message ?? "Chef chat failed.");
      }

      const options = Array.isArray(data.options) ? data.options : [];
      if (startsNewDirection) {
        setSelectedChefDirection(null);
      }
      setHeroChatMessages((current) => [
        ...current,
        { role: "user", text: trimmedPrompt, kind: "message" },
        {
          role: "ai",
          text: data.reply!,
          kind: "message",
          options,
          recommendedOptionId: data.recommended_option_id ?? null,
        },
      ]);
      if (data.mode === "options" && options.length > 0) {
        setSelectedChefDirection(null);
        setTransientStatus("Choose one direction, then refine it.");
      } else if (selectedChefDirection) {
        setTransientStatus("Direction refined. Build the recipe when it feels right.");
      } else {
        setTransientStatus("Chef responded. Build the recipe when the direction feels right.");
      }
      setHeroChatReadyToApply(true);
    } catch (chatError) {
      const fallbackReply = generateLocalChefReply(trimmedPrompt, extractIngredientsFromPrompt(trimmedPrompt), userTasteProfile ?? undefined);
      const fallbackOptions: ChefDirectionOption[] = [];
      setHeroChatMessages((current) => [
        ...current,
        { role: "user", text: trimmedPrompt, kind: "message" },
        { role: "ai", text: fallbackReply, kind: "message", options: fallbackOptions, recommendedOptionId: null },
      ]);
      setHeroChatReadyToApply(true);
      setError(null);
      setTransientStatus(describeAiOutage(chatError, "Showing fallback chef guidance"));
    } finally {
      heroSubmitLockRef.current = false;
      setLoading(false);
    }
  };

  const handleApplyHeroChatIdeas = async () => {
    if (heroChatMessages.length === 0) {
      setError("Ask Chef for a direction first.");
      return;
    }

    const latestOptions = heroChatMessages.at(-1)?.options ?? [];
    if (!selectedChefDirection && latestOptions.length > 1) {
      setError("Choose a direction before building the recipe.");
      return;
    }

    trackEventInBackground("hero_chat_applied", {
      source: "home-hub",
      messageCount: heroChatMessages.length,
      conversation: buildHeroConversationContext(
        selectedChefDirection != null
          ? buildLockedDirectionMessages(heroChatMessages, selectedChefDirection)
          : buildFocusedRecipeConversation(heroChatMessages)
      ).slice(0, 1200),
    });

    await createRecipeFromConversation(
      selectedChefDirection != null
        ? buildLockedDirectionMessages(heroChatMessages, selectedChefDirection)
        : buildFocusedRecipeConversation(heroChatMessages)
      ,
      "chef-chat",
      selectedChefDirection
    );
  };

  const handleCreateRecipeFromReply = async (replyIndex: number) => {
    const sliced = buildReplyBranch(heroChatMessages, replyIndex);
    setActiveChatRecipeIndex(replyIndex);
    trackEventInBackground("hero_reply_recipe_requested", {
      source: "home-hub",
      replyIndex,
      messageCount: sliced.length,
      conversation: buildHeroConversationContext(sliced).slice(0, 1200),
    });
    const summary = buildDirectionSummary(sliced);
    const replyDirection: SelectedChefDirection = {
      replyIndex: sliced.findLastIndex((message) => message.role === "ai"),
      optionId: `reply-${replyIndex}`,
      title: deriveIdeaTitleFromConversationContext(summary || heroChatMessages[replyIndex]?.text || "Chef direction"),
      summary: summary || heroChatMessages[replyIndex]?.text || "Chef direction",
      tags: [],
    };

    if (!selectedChefDirection || selectedChefDirection.replyIndex !== replyIndex) {
      setSelectedChefDirection({
        ...replyDirection,
        replyIndex,
      });
    }
    await createRecipeFromConversation(sliced, "chef-chat-reply", buildSelectedDirectionForMessages(sliced, replyDirection));
  };

  const handleSelectChefDirection = (replyIndex: number, option: { id: string; title: string; summary: string; tags: string[] }) => {
    setSelectedChefDirection({
      replyIndex,
      optionId: option.id,
      title: option.title,
      summary: option.summary,
      tags: option.tags,
    });
    setHeroChatReadyToApply(true);
    setError(null);
    setTransientStatus("Direction selected. Refine it or build the recipe when ready.");
  };

  const handleClearChefDirection = () => {
    setSelectedChefDirection(null);
    setError(null);
    setTransientStatus("Direction cleared. Choose another option or ask Chef for a new one.");
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
    if (smartLoading) {
      return;
    }

    setSmartLoading(true);
    setSmartError(null);
    setSmartStatus("Developing directions...");
    setSmartIdeas([]);
    trackEventInBackground("smart_filters_used", {
      proteins: smartProteins,
      cuisines: smartCuisines,
      cookTimes: smartCookTimes,
      preferences: smartPreferences,
    });

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
        requested_count: IDEA_BATCH_SIZE,
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
      setSmartStatus("Select a direction to generate the full recipe.");
    } catch (aiError) {
      const cookTimeMinutes = smartCookTimes.map(cookTimeLabelToMinutes);
      const fallbackPrompt = `${smartProteins.join(" ")} ${smartCuisines.join(" ")} ${smartPreferences.join(" ")} ${smartCookTimes.join(" ")}`.trim();
      const fallbackIdeas = dedupeIdeas(
        fallbackPrompt
          ? generateLocalRecipeIdeas(fallbackPrompt, [], userTasteProfile ?? undefined)
          : buildSmartFallbackIdeas(smartProteins, smartCuisines, cookTimeMinutes, smartPreferences)
      );
      setSmartIdeas(fallbackIdeas);
      setSmartError(null);
      setSmartStatus(describeAiOutage(aiError, "Showing fallback ideas"));
    } finally {
      setSmartLoading(false);
    }
  };

  const handleSelectSmartIdea = async (idea: RecipeIdea) => {
    trackEventInBackground("recipe_idea_selected", {
      source: "smart",
      title: idea.title,
      description: idea.description,
      cookTimeMin: idea.cook_time_min ?? null,
    });
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

  const handleTrackedSelectIdea = async (idea: RecipeIdea) => {
    trackEventInBackground("recipe_idea_selected", {
      source: ideaSource ?? "mood",
      title: idea.title,
      description: idea.description,
      cookTimeMin: idea.cook_time_min ?? null,
    });
    await handleSelectIdea(idea);
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
    selectedChefDirection,
    heroChatReadyToApply,
    activeChatRecipeIndex,
    heroChatFrameRef,
    heroChatViewportRef,
    handleHeroInputKeyDown,
    handleAskChefInHero,
    handleApplyHeroChatIdeas,
    handleCreateRecipeFromReply,
    handleSelectChefDirection,
    handleClearChefDirection,
    handleGenerateMoreIdeas,
    handleSelectIdea: handleTrackedSelectIdea,
    generateRecipeFromIdea,
    toggleSmartPreference,
    toggleSmartProtein,
    toggleSmartCuisine,
    toggleSmartCookTime,
    handleGenerateSmartMeals,
    handleSelectSmartIdea,
  };
}
