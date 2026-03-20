"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { AIMessage, RecipeContext } from "@/lib/ai/chatPromptBuilder";
import type { ChefChatEnvelope, ChefDirectionOption } from "@/lib/ai/chefOptions";
import { deriveIdeaTitleFromConversationContext } from "@/lib/ai/homeRecipeAlignment";
import {
  buildDirectionSummary,
  buildFocusedChatHistory,
  buildFocusedRecipeConversation,
  buildReplyBranch,
} from "@/lib/ai/homeConversationFocus";
import { generateLocalChefReply, generateLocalRecipeIdeas } from "@/lib/localRecipeGenerator";
import { createRecipeFromDraft, getCreatedRecipeHref } from "@/lib/client/recipeMutations";
import { repairRecipeDraftIngredientLines, type RecipeDraft } from "@/lib/recipes/recipeDraft";
import { trackEventInBackground } from "@/lib/trackEventInBackground";
import { COOKING_SCOPE_MESSAGE, guardCookingTopic } from "@/lib/ai/topicGuard";
import type { ChatMessage, SelectedChefDirection, UserTasteProfile } from "@/components/home/types";
import type { VerificationRetryStrategy } from "@/lib/ai/contracts/verificationResult";

const extractIngredientsFromPrompt = (prompt: string) =>
  prompt
    .split(/\n|,/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

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
  // Include the user message that prompted the options reply so ingredient context
  // (e.g. "I have fresh ravioli filled with chicken") is preserved when building the recipe.
  let start = selectedDirection.replyIndex;
  for (let i = selectedDirection.replyIndex - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") {
      start = i;
      break;
    }
  }
  const contextMessages = messages
    .slice(start, selectedDirection.replyIndex)
    .filter((message) => message.kind !== "direction_selected");

  const trailingMessages = messages
    .slice(selectedDirection.replyIndex + 1)
    .filter((message) => message.kind !== "direction_selected");

  return [
    ...contextMessages,
    {
      role: "ai" as const,
      text: `Locked direction: ${selectedDirection.title}. ${selectedDirection.summary}`,
      kind: "message" as const,
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

type RecipeBuildStreamError = Error & {
  retryStrategy?: VerificationRetryStrategy;
  reasons?: string[];
  failureKind?: "verification_failed" | "invalid_payload" | "generation_failed";
};

const getRecipeBuildErrorMessage = (error: unknown, fallbackMessage: string) => {
  const typedError = error as RecipeBuildStreamError;
  const message = error instanceof Error ? error.message.trim() : "";
  const retryStrategy = typedError?.retryStrategy;
  const reasons = Array.isArray(typedError?.reasons) ? typedError.reasons.filter(Boolean) : [];
  if (!message) {
    return fallbackMessage;
  }

  if (message.includes("Each ingredient needs a quantity")) {
    return "Chef drafted the right direction, but the recipe details were incomplete. Please try again and Chef will rebuild it.";
  }

  if (message.startsWith("[{") || message.startsWith('["')) {
    return fallbackMessage;
  }

  if (retryStrategy === "ask_user") {
    return reasons[0] ?? "Chef needs one more clarification before building a reliable recipe. Tighten the dish direction and try again.";
  }

  if (retryStrategy === "regenerate_stricter") {
    return reasons[0]
      ? `${reasons[0]} Try again, or refine the direction so Chef has less room to drift.`
      : "Chef rejected the draft because it drifted from your request. Try again or refine the direction.";
  }

  if (retryStrategy === "regenerate_same_model") {
    return "Chef produced an incomplete draft this time. Try building the recipe again.";
  }

  if (retryStrategy === "upgrade_model") {
    return "Chef could not build this reliably on that attempt. Please try again or tighten the direction a bit.";
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
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

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

  const invokeRecipeBuildStream = async (
    body: Record<string, unknown>,
    handlers: {
      onStatus: (message: string) => void;
    }
  ) => {
    const response = await fetch("/api/ai/home/build", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok || !response.body) {
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(data?.message ?? "AI request failed.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalResult: Record<string, unknown> | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        const event = JSON.parse(trimmed) as
          | { type: "status"; message: string }
          | { type: "result"; result: Record<string, unknown> }
          | {
              type: "error";
              message: string;
              retry_strategy?: VerificationRetryStrategy;
              reasons?: string[];
              failure_kind?: "verification_failed" | "invalid_payload" | "generation_failed";
            };

        if (event.type === "status") {
          handlers.onStatus(event.message);
        } else if (event.type === "result") {
          finalResult = event.result;
        } else if (event.type === "error") {
          const streamError = new Error(event.message) as RecipeBuildStreamError;
          streamError.retryStrategy = event.retry_strategy;
          streamError.reasons = Array.isArray(event.reasons) ? event.reasons : [];
          streamError.failureKind = event.failure_kind;
          throw streamError;
        }
      }
    }

    if (!finalResult) {
      throw new Error("Recipe build finished without a result.");
    }

    return finalResult;
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
    setStatus("Understanding your request...");

    try {
      const data = await invokeRecipeBuildStream({
        ideaTitle,
        prompt: latestUserPrompt,
        ingredients,
        conversationHistory,
        conversationKey: conversationKeyRef.current,
      }, {
        onStatus: (message) => setStatus(message),
      });

      const recipe = data.result && typeof data.result === "object" && "recipe" in data.result
        ? (data.result as { recipe: RecipeDraft }).recipe
        : (data.recipe as RecipeDraft);
      setStatus("Saving your recipe...");
      const created = await saveGeneratedRecipe(recipe, source);
      goToCreatedRecipe(created.recipeId, created.versionId);
    } catch (saveError) {
      setError(
        getRecipeBuildErrorMessage(saveError, "Chef could not build a reliable recipe from this conversation. Please refine the direction and try again.")
      );
      setStatus(null);
    } finally {
      setGeneratingRecipe(false);
      setActiveChatRecipeIndex(null);
      setStatus(null);
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

  const handleStartOver = () => {
    setHeroChatMessages([]);
    setSelectedChefDirection(null);
    setHeroChatReadyToApply(false);
    setError(null);
    setTransientStatus(null);
  };

  const handleHeroInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    void handleAskChefInHero();
  };

  return {
    promptInput,
    setPromptInput,
    loading,
    generatingRecipe,
    error,
    status,
    heroChatMessages,
    selectedChefDirection,
    heroChatReadyToApply,
    activeChatRecipeIndex,
    heroChatFrameRef,
    heroChatViewportRef,
    handleHeroInputKeyDown,
    handleAskChefInHero,
    handleCreateRecipeFromReply,
    handleSelectChefDirection,
    handleClearChefDirection,
    handleStartOver,
  };
}
