"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { AIMessage, RecipeContext } from "@/lib/ai/chatPromptBuilder";
import type { ChefChatEnvelope } from "@/lib/ai/chefOptions";
import { deriveIdeaTitleFromConversationContext } from "@/lib/ai/homeRecipeAlignment";
import { createLockedSessionFromDirection, removeLastLockedSessionRefinement } from "@/lib/ai/lockedSession";
import {
  buildDirectionSummary,
  buildFocusedChatHistory,
  buildFocusedRecipeConversation,
  buildReplyBranch,
} from "@/lib/ai/homeConversationFocus";
import { generateLocalRecipeIdeas } from "@/lib/localRecipeGenerator";
import { createRecipeFromDraft, getCreatedRecipeHref } from "@/lib/client/recipeMutations";
import { repairRecipeDraftIngredientLines, type RecipeDraft } from "@/lib/recipes/recipeDraft";
import { trackEventInBackground } from "@/lib/trackEventInBackground";
import { COOKING_SCOPE_MESSAGE, guardCookingTopic } from "@/lib/ai/topicGuard";
import type { ChatMessage, LockedDirectionSession, SelectedChefDirection, UserTasteProfile } from "@/components/home/types";
import type { VerificationRetryStrategy } from "@/lib/ai/contracts/verificationResult";
import type { RecipeBuildFailureKind } from "@/lib/ai/recipeBuildError";
import type { LaunchDecision, SuggestedAction } from "@/lib/ai/launchDecisionMapper";

const extractIngredientsFromPrompt = (prompt: string) =>
  prompt
    .split(/\n|,/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const RECIPE_CONTEXT_INGREDIENT_STOP_WORDS = new Set([
  "make",
  "great",
  "sounds",
  "nice",
  "spicy",
  "bright",
  "crunchy",
  "crispy",
  "quick",
  "dinner",
  "style",
]);

const extractRecipeContextIngredients = (prompt: string) => {
  const trimmed = prompt.trim();
  if (!trimmed || (!trimmed.includes(",") && !trimmed.includes("\n"))) {
    return [];
  }

  return extractIngredientsFromPrompt(trimmed).filter((item) => {
    const normalized = item.toLowerCase();
    const wordCount = normalized.split(/\s+/).length;
    return (
      wordCount <= 4 &&
      !/[.!?]/.test(item) &&
      !Array.from(RECIPE_CONTEXT_INGREDIENT_STOP_WORDS).some((token) => normalized.includes(token))
    );
  });
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
  selectedDirection: SelectedChefDirection | null,
  lockedSession: LockedDirectionSession | null
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
  const _selectedSummary = selectedDirection?.summary?.trim() ?? "";
  const ideaTitle =
    selectedDirection?.title?.trim() ||
    deriveIdeaTitleFromConversationContext(latestAssistantReply || conversationText) ||
    generateLocalRecipeIdeas(latestAssistantReply || conversationText, [], userTasteProfile ?? undefined)[0]?.title ||
    "Chef Conversation Recipe";

  return {
    conversationText,
    latestAssistantReply,
    ideaTitle,
    latestUserPrompt,
    ingredients: lockedSession
      ? Array.from(
          new Set(
            lockedSession.refinements.flatMap((item) => [
              ...item.extracted_changes.required_ingredients,
              ...item.extracted_changes.preferred_ingredients,
            ])
          )
        )
      : undefined,
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

const buildReplyDirectionFromMessages = (messages: ChatMessage[], replyIndex: number): SelectedChefDirection | null => {
  const sliced = buildReplyBranch(messages, replyIndex);
  if (sliced.length === 0) {
    return null;
  }

  const branchConversation = buildHeroConversationContext(sliced);
  const latestReply = [...sliced].reverse().find((message) => message.role === "ai")?.text.trim() ?? "";
  const inferredTitle =
    deriveIdeaTitleFromConversationContext(branchConversation) ||
    deriveIdeaTitleFromConversationContext(latestReply) ||
    "Chef Conversation Recipe";

  return {
    replyIndex,
    optionId: `reply-${replyIndex}`,
    title: inferredTitle,
    summary: latestReply || branchConversation || "Chef direction",
    tags: [],
  };
};

type RecipeBuildStreamError = Error & {
  retryStrategy?: VerificationRetryStrategy;
  reasons?: string[];
  failureKind?: RecipeBuildFailureKind;
  launchDecision?: LaunchDecision;
};

export type BuildFailureState = {
  /** How to categorize this failure for UX purposes. */
  kind: "infeasible" | "hard_failure" | "clarification_needed";
  /** Human-readable reasons from the planner/verifier, if any. */
  reasons: string[];
};

export type { LaunchDecision, SuggestedAction };

export type BuildDebugEntry =
  | { type: "status"; message: string; ts: number }
  | { type: "result"; title: string; ts: number }
  | { type: "debug"; label: string; data: Record<string, unknown>; ts: number }
  | { type: "error"; message: string; failure_kind?: string; retry_strategy?: string; model?: string; reasons?: string[]; ts: number };

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

  if (retryStrategy === "regenerate_same_model" || retryStrategy === "try_fallback_model") {
    return "Chef had trouble completing the recipe draft. Please try building again.";
  }

  if (retryStrategy === "upgrade_model") {
    return "Chef could not build this reliably on that attempt. Please try again or tighten the direction a bit.";
  }

  if (message.toLowerCase().includes("invalid json") || message.toLowerCase().includes("unexpected token")) {
    return "Chef's response came back in an unexpected format. Please try building the recipe again.";
  }

  if (message.toLowerCase().includes("timeout") || message.toLowerCase().includes("timed out")) {
    return "Chef took too long to respond. Please try again.";
  }

  if (message.startsWith("AI returned") || message.includes("openrouter") || message.includes("openai")) {
    return "Chef hit a temporary issue. Please try building the recipe again.";
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

function createConversationKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `home-${Date.now()}`;
}

const HOME_HUB_STORAGE_SCOPE = "home-hub";
const HOME_HUB_CONVERSATION_KEY_STORAGE = `home-hub-conversation-key-${HOME_HUB_STORAGE_SCOPE}`;
const HOME_HUB_MESSAGES_STORAGE = `home-hub-messages-${HOME_HUB_STORAGE_SCOPE}`;
const HOME_HUB_SELECTED_DIRECTION_STORAGE = `home-hub-selected-direction-${HOME_HUB_STORAGE_SCOPE}`;
const HOME_HUB_LOCKED_SESSION_STORAGE = `home-hub-locked-session-${HOME_HUB_STORAGE_SCOPE}`;

function deriveSelectedDirectionFromSession(messages: ChatMessage[], session: LockedDirectionSession | null): SelectedChefDirection | null {
  if (!session?.selected_direction) {
    return null;
  }

  const selected = session.selected_direction;
  let replyIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "ai") {
      continue;
    }
    const matchedOption = message.options?.some((option) => option.id === selected.id) ?? false;
    const matchedTitle = message.text.toLowerCase().includes(selected.title.toLowerCase());
    if (matchedOption || matchedTitle) {
      replyIndex = index;
      break;
    }
  }

  return {
    replyIndex,
    optionId: selected.id,
    title: selected.title,
    summary: selected.summary,
    tags: selected.tags,
  };
}

function isGenericSelectedDirectionTitle(title: string) {
  const trimmed = title.trim();
  return (
    trimmed.length === 0 ||
    trimmed === "Chef Conversation Recipe" ||
    /^chef\s/i.test(trimmed) ||
    /\sDish$/.test(trimmed)
  );
}

export function useHomeHubAi(userTasteProfile: UserTasteProfile | null) {
  const router = useRouter();
  const conversationKeyRef = useRef(createConversationKey());
  const threadIdentityRef = useRef(0);
  const hydrationAbortRef = useRef<AbortController | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const buildAbortRef = useRef<AbortController | null>(null);
  const [promptInput, setPromptInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatingRecipe, setGeneratingRecipe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [buildFailureState, setBuildFailureState] = useState<BuildFailureState | null>(null);
  const [isBuildLong, setIsBuildLong] = useState(false);
  const buildLongTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [buildDebugLog, setBuildDebugLog] = useState<BuildDebugEntry[]>([]);
  const [launchDecision, setLaunchDecision] = useState<LaunchDecision | null>(null);

  const [heroChatMessages, setHeroChatMessages] = useState<ChatMessage[]>([]);
  const [heroChatReadyToApply, setHeroChatReadyToApply] = useState(false);
  const [selectedChefDirection, setSelectedChefDirection] = useState<SelectedChefDirection | null>(null);
  const [lockedSession, setLockedSession] = useState<LockedDirectionSession | null>(null);
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
    if (typeof window === "undefined") {
      return;
    }

    const storedConversationKey = window.localStorage.getItem(HOME_HUB_CONVERSATION_KEY_STORAGE);
    if (storedConversationKey?.trim()) {
      conversationKeyRef.current = storedConversationKey.trim();
    } else {
      window.localStorage.setItem(HOME_HUB_CONVERSATION_KEY_STORAGE, conversationKeyRef.current);
    }

    const rawMessages = window.localStorage.getItem(HOME_HUB_MESSAGES_STORAGE);
    if (rawMessages) {
      try {
        const parsed = JSON.parse(rawMessages) as ChatMessage[];
        if (Array.isArray(parsed)) {
          setHeroChatMessages(
            parsed.filter(
              (item): item is ChatMessage =>
                (item?.role === "user" || item?.role === "ai") &&
                typeof item?.text === "string" &&
                (item?.kind === undefined || item.kind === "message" || item.kind === "direction_selected")
            )
          );
        }
      } catch {
        setHeroChatMessages([]);
      }
    }

    const rawSelectedDirection = window.localStorage.getItem(HOME_HUB_SELECTED_DIRECTION_STORAGE);
    if (rawSelectedDirection) {
      try {
        const parsed = JSON.parse(rawSelectedDirection) as SelectedChefDirection;
        if (
          typeof parsed?.replyIndex === "number" &&
          typeof parsed?.optionId === "string" &&
          typeof parsed?.title === "string" &&
          typeof parsed?.summary === "string" &&
          Array.isArray(parsed?.tags)
        ) {
          setSelectedChefDirection({
            ...parsed,
            tags: parsed.tags.filter((tag): tag is string => typeof tag === "string"),
          });
        }
      } catch {
        setSelectedChefDirection(null);
      }
    }

    const rawLockedSession = window.localStorage.getItem(HOME_HUB_LOCKED_SESSION_STORAGE);
    if (rawLockedSession) {
      try {
        const parsed = JSON.parse(rawLockedSession) as LockedDirectionSession;
        if (
          typeof parsed?.conversation_key === "string" &&
          typeof parsed?.state === "string" &&
          Array.isArray(parsed?.refinements)
        ) {
          setLockedSession(parsed);
        }
      } catch {
        setLockedSession(null);
      }
    }

    const conversationKey = conversationKeyRef.current;
    const hydrationThread = threadIdentityRef.current;
    const controller = new AbortController();
    hydrationAbortRef.current = controller;
    void (async () => {
      try {
        const response = await fetch(`/api/ai/home?conversationKey=${encodeURIComponent(conversationKey)}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as {
          messages?: ChatMessage[];
          lockedSession?: LockedDirectionSession | null;
        };
        const serverMessages = Array.isArray(data.messages) ? data.messages : [];
        const serverLockedSession = data.lockedSession ?? null;

        if (
          controller.signal.aborted ||
          threadIdentityRef.current !== hydrationThread ||
          conversationKeyRef.current !== conversationKey
        ) {
          return;
        }

        if (serverMessages.length > 0) {
          setHeroChatMessages(serverMessages);
          setHeroChatReadyToApply(true);
        }
        if (serverLockedSession?.selected_direction) {
          setLockedSession(serverLockedSession);
          setSelectedChefDirection(deriveSelectedDirectionFromSession(serverMessages, serverLockedSession));
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        // Keep local state if rehydration fails.
      }
    })();

    return () => {
      controller.abort();
      if (hydrationAbortRef.current === controller) {
        hydrationAbortRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
      if (buildLongTimeoutRef.current) {
        clearTimeout(buildLongTimeoutRef.current);
      }
      hydrationAbortRef.current?.abort();
      chatAbortRef.current?.abort();
      buildAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(HOME_HUB_CONVERSATION_KEY_STORAGE, conversationKeyRef.current);
  }, [heroChatMessages.length]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(HOME_HUB_MESSAGES_STORAGE, JSON.stringify(heroChatMessages.slice(-120)));
  }, [heroChatMessages]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!selectedChefDirection) {
      window.localStorage.removeItem(HOME_HUB_SELECTED_DIRECTION_STORAGE);
      return;
    }
    window.localStorage.setItem(HOME_HUB_SELECTED_DIRECTION_STORAGE, JSON.stringify(selectedChefDirection));
  }, [selectedChefDirection]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!lockedSession) {
      window.localStorage.removeItem(HOME_HUB_LOCKED_SESSION_STORAGE);
      return;
    }
    window.localStorage.setItem(HOME_HUB_LOCKED_SESSION_STORAGE, JSON.stringify(lockedSession));
  }, [lockedSession]);

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

  const invokeAi = async (body: Record<string, unknown>, signal?: AbortSignal) => {
    const response = await fetch("/api/ai/home", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
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
      onDebugEvent?: (entry: BuildDebugEntry) => void;
    },
    signal?: AbortSignal
  ) => {
    const response = await fetch("/api/ai/home/build", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok || !response.body) {
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(data?.message ?? "AI request failed.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalResult: Record<string, unknown> | null = null;
    let finalLaunchDecision: LaunchDecision | null = null;

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
          | { type: "result"; result: Record<string, unknown>; launchDecision?: LaunchDecision }
          | { type: "debug"; label: string; data: Record<string, unknown> }
          | {
              type: "error";
              message: string;
              retry_strategy?: VerificationRetryStrategy;
              reasons?: string[];
              failure_kind?: RecipeBuildFailureKind;
              failure_stage?: string | null;
              failure_context?: Record<string, unknown> | null;
              model?: string;
              launchDecision?: LaunchDecision;
            };

        if (event.type === "status") {
          handlers.onStatus(event.message);
          handlers.onDebugEvent?.({ type: "status", message: event.message, ts: Date.now() });
        } else if (event.type === "debug") {
          handlers.onDebugEvent?.({ type: "debug", label: event.label, data: event.data, ts: Date.now() });
        } else if (event.type === "result") {
          finalResult = event.result;
          finalLaunchDecision = event.launchDecision ?? null;
          const resultRecipe = event.result?.recipe as { title?: string } | undefined;
          handlers.onDebugEvent?.({ type: "result", title: resultRecipe?.title ?? "(no title)", ts: Date.now() });
        } else if (event.type === "error") {
          handlers.onDebugEvent?.({
            type: "error",
            message: event.message,
            failure_kind: event.failure_kind,
            retry_strategy: event.retry_strategy,
            model: event.model,
            reasons: event.reasons,
            ts: Date.now(),
          });
          const streamError = new Error(event.message) as RecipeBuildStreamError;
          streamError.retryStrategy = event.retry_strategy;
          streamError.reasons = Array.isArray(event.reasons) ? event.reasons : [];
          streamError.failureKind = event.failure_kind;
          streamError.launchDecision = event.launchDecision;
          throw streamError;
        }
      }
    }

    if (!finalResult) {
      throw new Error("Recipe build finished without a result.");
    }

    return { result: finalResult, launchDecision: finalLaunchDecision };
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

    router.push(href);
    router.refresh();
  };

  const createRecipeFromConversation = async (
    messages: ChatMessage[],
    source = "chef-chat",
    selectedDirectionOverride: SelectedChefDirection | null = selectedChefDirection
  ) => {
    const requestThread = threadIdentityRef.current;
    const requestConversationKey = conversationKeyRef.current;
    const shouldRepairLockedSession =
      selectedDirectionOverride != null &&
      (isGenericSelectedDirectionTitle(selectedDirectionOverride.title) ||
        isGenericSelectedDirectionTitle(lockedSession?.selected_direction?.title ?? ""));
    const effectiveLockedSession =
      selectedDirectionOverride == null
        ? null
        : lockedSession?.selected_direction?.id === selectedDirectionOverride.optionId && !shouldRepairLockedSession
        ? lockedSession
        : createLockedSessionFromDirection({
            conversationKey: requestConversationKey,
            selectedDirection: {
              id: selectedDirectionOverride.optionId,
              title: selectedDirectionOverride.title,
              summary: selectedDirectionOverride.summary,
              tags: selectedDirectionOverride.tags,
            },
            conversationHistory: messages
              .filter((m) => m.role === "user" || m.role === "ai")
              .map((m) => ({ role: m.role === "ai" ? "assistant" as const : "user" as const, content: m.text })),
            modelDishFamily: selectedDirectionOverride.dish_family ?? null,
            modelAnchor: selectedDirectionOverride.primary_anchor ?? null,
            modelAnchorType: selectedDirectionOverride.primary_anchor_type ?? null,
          });
    const { conversationText, ideaTitle, latestUserPrompt, ingredients, conversationHistory } = buildRecipeSeedFromConversation(
      messages,
      userTasteProfile,
      selectedDirectionOverride,
      effectiveLockedSession
    );
    if (!conversationText.trim()) {
      setError("Ask Chef something first.");
      return;
    }

    setGeneratingRecipe(true);
    setError(null);
    setBuildFailureState(null);
    setLaunchDecision(null);
    setIsBuildLong(false);
    if (buildLongTimeoutRef.current) clearTimeout(buildLongTimeoutRef.current);
    buildLongTimeoutRef.current = setTimeout(() => setIsBuildLong(true), 35_000);
    setStatus("Understanding your request...");
    setBuildDebugLog([{ type: "status", message: "Understanding your request...", ts: Date.now() }]);
    buildAbortRef.current?.abort();
    const controller = new AbortController();
    buildAbortRef.current = controller;

    try {
      const { result: data, launchDecision: streamDecision } = await invokeRecipeBuildStream({
        ideaTitle,
        prompt: latestUserPrompt,
        ingredients,
        conversationHistory,
        conversationKey: requestConversationKey,
        lockedSession: effectiveLockedSession,
      }, {
        onStatus: (message) => setStatus(message),
        onDebugEvent: (entry) => setBuildDebugLog((prev) => [...prev, entry]),
      }, controller.signal);

      if (
        controller.signal.aborted ||
        threadIdentityRef.current !== requestThread ||
        conversationKeyRef.current !== requestConversationKey
      ) {
        return;
      }

      if (streamDecision) setLaunchDecision(streamDecision);

      const recipe = data.result && typeof data.result === "object" && "recipe" in data.result
        ? (data.result as { recipe: RecipeDraft }).recipe
        : (data.recipe as RecipeDraft);
      setStatus("Saving your recipe...");
      const created = await saveGeneratedRecipe(recipe, source);
      if (
        controller.signal.aborted ||
        threadIdentityRef.current !== requestThread ||
        conversationKeyRef.current !== requestConversationKey
      ) {
        return;
      }
      goToCreatedRecipe(created.recipeId, created.versionId);
    } catch (saveError) {
      if ((saveError instanceof DOMException && saveError.name === "AbortError") || controller.signal.aborted) {
        return;
      }
      const typedSaveError = saveError as RecipeBuildStreamError;
      const alreadyLoggedError =
        buildDebugLog.length > 0 && buildDebugLog[buildDebugLog.length - 1]?.type === "error";
      if (!alreadyLoggedError) {
        setBuildDebugLog((prev) => [
          ...prev,
          {
            type: "error",
            message: saveError instanceof Error ? saveError.message : "Unknown error",
            failure_kind: typedSaveError.failureKind,
            retry_strategy: typedSaveError.retryStrategy,
            reasons: typedSaveError.reasons,
            ts: Date.now(),
          },
        ]);
      }
      if (typedSaveError.launchDecision) {
        setLaunchDecision(typedSaveError.launchDecision);
      }
      const fkind = typedSaveError.failureKind;
      const fstrat = typedSaveError.retryStrategy;
      let failureStateKind: BuildFailureState["kind"] = "hard_failure";
      if (fkind === "verification_failed") {
        failureStateKind = fstrat === "ask_user" ? "clarification_needed" : "infeasible";
      }
      setBuildFailureState({
        kind: failureStateKind,
        reasons: typedSaveError.reasons ?? [],
      });
      setError(
        getRecipeBuildErrorMessage(saveError, "Chef could not build a reliable recipe from this conversation. Please refine the direction and try again.")
      );
      setStatus(null);
    } finally {
      if (buildAbortRef.current === controller) {
        buildAbortRef.current = null;
      }
      if (buildLongTimeoutRef.current) {
        clearTimeout(buildLongTimeoutRef.current);
        buildLongTimeoutRef.current = null;
      }
      setIsBuildLong(false);
      setGeneratingRecipe(false);
      setActiveChatRecipeIndex(null);
      setStatus(null);
    }
  };

  const handleAskChefInHero = async (promptOverride?: string) => {
    if (loading || heroSubmitLockRef.current) {
      return;
    }

    const trimmedPrompt = (promptOverride ?? promptInput).trim();
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
    const requestThread = threadIdentityRef.current;
    const requestConversationKey = conversationKeyRef.current;
    chatAbortRef.current?.abort();
    const controller = new AbortController();
    chatAbortRef.current = controller;

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
              ingredients: extractRecipeContextIngredients(trimmedPrompt),
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
        conversationKey: requestConversationKey,
        lockedSession: startsNewDirection ? undefined : lockedSession ?? undefined,
        reset_session: startsNewDirection ? true : undefined,
      }, controller.signal)) as ChefChatEnvelope & {
        message?: string;
        session_action?: "clear_locked_direction" | null;
        refinement_applied?: boolean;
        lockedSession?: LockedDirectionSession | null;
      };

      if (
        controller.signal.aborted ||
        threadIdentityRef.current !== requestThread ||
        conversationKeyRef.current !== requestConversationKey
      ) {
        return;
      }

      if (!data.reply) {
        throw new Error(data.message ?? "Chef chat failed.");
      }

      const options = Array.isArray(data.options) ? data.options : [];
      const shouldClearLockedDirection = data.session_action === "clear_locked_direction";
      const canonicalLockedSession = data.lockedSession ?? null;
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
      if (shouldClearLockedDirection) {
        setSelectedChefDirection(null);
        setLockedSession(null);
        setTransientStatus("Direction reset. Chef is working from the new request now.");
      } else if (data.mode === "options" && options.length > 0) {
        setSelectedChefDirection(null);
        setLockedSession(null);
        setTransientStatus("Choose one direction, then refine it.");
      } else if (selectedChefDirection) {
        if (canonicalLockedSession) {
          setLockedSession(canonicalLockedSession);
          setSelectedChefDirection((current) => deriveSelectedDirectionFromSession([
            ...heroChatMessages,
            { role: "user", text: trimmedPrompt, kind: "message" },
            {
              role: "ai",
              text: data.reply!,
              kind: "message",
              options,
              recommendedOptionId: data.recommended_option_id ?? null,
            },
          ], canonicalLockedSession) ?? current);
        }
        setTransientStatus(
          data.refinement_applied
            ? "Direction refined. Build the recipe when it feels right."
            : "Chef answered without changing the direction."
        );
      } else {
        setTransientStatus("Chef responded. Build the recipe when the direction feels right.");
      }
      setHeroChatReadyToApply(true);
    } catch (chatError) {
      if ((chatError instanceof DOMException && chatError.name === "AbortError") || controller.signal.aborted) {
        return;
      }
      setError("Chef hit a temporary problem before the direction could be updated. Please try again.");
      setTransientStatus(describeAiOutage(chatError, "Chef is temporarily unavailable"));
    } finally {
      if (chatAbortRef.current === controller) {
        chatAbortRef.current = null;
      }
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
    const replyDirection = buildReplyDirectionFromMessages(heroChatMessages, replyIndex);
    if (!replyDirection) {
      setError("Chef needs one clear direction before building.");
      setActiveChatRecipeIndex(null);
      return;
    }

    if (!selectedChefDirection) {
      setSelectedChefDirection(replyDirection);
    }
    const lockedDirection =
      selectedChefDirection != null
        ? buildSelectedDirectionForMessages(heroChatMessages, selectedChefDirection) ?? selectedChefDirection
        : buildSelectedDirectionForMessages(sliced, replyDirection);

    await createRecipeFromConversation(
      selectedChefDirection != null ? heroChatMessages : sliced,
      "chef-chat-reply",
      lockedDirection
    );
  };

  const handleSelectChefDirection = (replyIndex: number, option: { id: string; title: string; summary: string; tags: string[]; dish_family?: string | null; primary_anchor?: string | null; primary_anchor_type?: "dish" | "protein" | "ingredient" | "format" | null }) => {
    setSelectedChefDirection({
      replyIndex,
      optionId: option.id,
      title: option.title,
      summary: option.summary,
      tags: option.tags,
      dish_family: option.dish_family ?? null,
      primary_anchor: option.primary_anchor ?? null,
      primary_anchor_type: option.primary_anchor_type ?? null,
    });
    // Convert chat messages to AIMessage format for BuildSpec derivation.
    const conversationHistory = heroChatMessages
      .filter((m) => m.role === "user" || m.role === "ai")
      .map((m) => ({ role: m.role === "ai" ? "assistant" as const : "user" as const, content: m.text }));
    setLockedSession(
      createLockedSessionFromDirection({
        conversationKey: conversationKeyRef.current,
        selectedDirection: {
          id: option.id,
          title: option.title,
          summary: option.summary,
          tags: option.tags,
        },
        conversationHistory,
        modelDishFamily: option.dish_family ?? null,
        modelAnchor: option.primary_anchor ?? null,
        modelAnchorType: option.primary_anchor_type ?? null,
      })
    );
    setHeroChatReadyToApply(true);
    setError(null);
    setTransientStatus("Direction selected. Refine it or build the recipe when ready.");
  };

  const handleClearChefDirection = () => {
    setSelectedChefDirection(null);
    setLockedSession(null);
    setError(null);
    setTransientStatus("Direction cleared. Choose another option or ask Chef for a new one.");
  };

  const handleBuildSelectedDirection = async () => {
    if (!selectedChefDirection) {
      return;
    }

    await createRecipeFromConversation(heroChatMessages, "chef-selected-direction", selectedChefDirection);
  };

  const handleRemoveLastRefinement = () => {
    setLockedSession((current) => {
      if (!current || current.refinements.length === 0) {
        return current;
      }
      return removeLastLockedSessionRefinement(current);
    });
    setError(null);
    setTransientStatus("Last refinement removed.");
  };

  const handleRetryBuild = async () => {
    setBuildFailureState(null);
    setError(null);
    await createRecipeFromConversation(heroChatMessages, "chef-chat-retry");
  };

  const handleRetryWithAction = async (action: SuggestedAction) => {
    setBuildFailureState(null);
    setError(null);
    setLaunchDecision(null);
    // Build request body with retry modifiers from the action
    const requestThread = threadIdentityRef.current;
    const requestConversationKey = conversationKeyRef.current;
    const selectedDirectionOverride = selectedChefDirection;
    const effectiveLockedSession = lockedSession;
    const { conversationText, ideaTitle, latestUserPrompt, ingredients, conversationHistory } = buildRecipeSeedFromConversation(
      heroChatMessages,
      userTasteProfile,
      selectedDirectionOverride,
      effectiveLockedSession
    );
    if (!conversationText.trim()) return;

    setGeneratingRecipe(true);
    setLaunchDecision(null);
    setIsBuildLong(false);
    if (buildLongTimeoutRef.current) clearTimeout(buildLongTimeoutRef.current);
    buildLongTimeoutRef.current = setTimeout(() => setIsBuildLong(true), 35_000);
    setStatus("Retrying...");
    setBuildDebugLog([{ type: "status", message: "Retrying with modifiers...", ts: Date.now() }]);
    buildAbortRef.current?.abort();
    const controller = new AbortController();
    buildAbortRef.current = controller;

    try {
      const { result: data, launchDecision: streamDecision } = await invokeRecipeBuildStream(
        {
          ideaTitle,
          prompt: latestUserPrompt,
          ingredients,
          conversationHistory,
          conversationKey: requestConversationKey,
          lockedSession: effectiveLockedSession,
          retryMode: action.retryMode,
          ...(action.retryParams?.relaxRequiredNamedIngredients?.length
            ? { relaxRequiredNamedIngredients: action.retryParams.relaxRequiredNamedIngredients }
            : {}),
          ...(action.retryParams?.simplifyRequest ? { simplifyRequest: true } : {}),
        },
        {
          onStatus: (message) => setStatus(message),
          onDebugEvent: (entry) => setBuildDebugLog((prev) => [...prev, entry]),
        },
        controller.signal
      );

      if (
        controller.signal.aborted ||
        threadIdentityRef.current !== requestThread ||
        conversationKeyRef.current !== requestConversationKey
      ) {
        return;
      }

      if (streamDecision) setLaunchDecision(streamDecision);

      const recipe = data.result && typeof data.result === "object" && "recipe" in data.result
        ? (data.result as { recipe: RecipeDraft }).recipe
        : (data.recipe as RecipeDraft);
      setStatus("Saving your recipe...");
      const created = await saveGeneratedRecipe(recipe, "chef-chat-graceful-retry");
      if (
        controller.signal.aborted ||
        threadIdentityRef.current !== requestThread ||
        conversationKeyRef.current !== requestConversationKey
      ) {
        return;
      }
      goToCreatedRecipe(created.recipeId, created.versionId);
    } catch (saveError) {
      if ((saveError instanceof DOMException && saveError.name === "AbortError") || controller.signal.aborted) {
        return;
      }
      const typedSaveError = saveError as RecipeBuildStreamError;
      if (typedSaveError.launchDecision) setLaunchDecision(typedSaveError.launchDecision);
      const fkind = typedSaveError.failureKind;
      const fstrat = typedSaveError.retryStrategy;
      let failureStateKind: BuildFailureState["kind"] = "hard_failure";
      if (fkind === "verification_failed") {
        failureStateKind = fstrat === "ask_user" ? "clarification_needed" : "infeasible";
      }
      setBuildFailureState({ kind: failureStateKind, reasons: typedSaveError.reasons ?? [] });
      setError(getRecipeBuildErrorMessage(saveError, "Chef could not build a reliable recipe. Please try again."));
      setStatus(null);
    } finally {
      if (buildAbortRef.current === controller) buildAbortRef.current = null;
      if (buildLongTimeoutRef.current) { clearTimeout(buildLongTimeoutRef.current); buildLongTimeoutRef.current = null; }
      setIsBuildLong(false);
      setGeneratingRecipe(false);
      setStatus(null);
    }
  };

  const handleClarificationQuickSelect = (option: string) => {
    setBuildFailureState(null);
    setError(null);
    setPromptInput(option);
    void handleAskChefInHero(option);
  };

  const handleStartOver = () => {
    threadIdentityRef.current += 1;
    hydrationAbortRef.current?.abort();
    chatAbortRef.current?.abort();
    buildAbortRef.current?.abort();
    conversationKeyRef.current = createConversationKey();
    lastHeroPromptRef.current = null;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(HOME_HUB_CONVERSATION_KEY_STORAGE, conversationKeyRef.current);
      window.localStorage.removeItem(HOME_HUB_MESSAGES_STORAGE);
      window.localStorage.removeItem(HOME_HUB_SELECTED_DIRECTION_STORAGE);
      window.localStorage.removeItem(HOME_HUB_LOCKED_SESSION_STORAGE);
    }
    setHeroChatMessages([]);
    setSelectedChefDirection(null);
    setLockedSession(null);
    setHeroChatReadyToApply(false);
    setActiveChatRecipeIndex(null);
    setPromptInput("");
    setError(null);
    setBuildFailureState(null);
    setLaunchDecision(null);
    setIsBuildLong(false);
    if (buildLongTimeoutRef.current) {
      clearTimeout(buildLongTimeoutRef.current);
      buildLongTimeoutRef.current = null;
    }
    setLoading(false);
    setGeneratingRecipe(false);
    setBuildDebugLog([]);
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
    buildFailureState,
    launchDecision,
    isBuildLong,
    buildDebugLog,
    heroChatMessages,
    selectedChefDirection,
    appliedRefinements: lockedSession?.refinements ?? [],
    heroChatReadyToApply,
    activeChatRecipeIndex,
    heroChatFrameRef,
    heroChatViewportRef,
    handleHeroInputKeyDown,
    handleAskChefInHero,
    handleCreateRecipeFromReply,
    handleSelectChefDirection,
    handleClearChefDirection,
    handleRemoveLastRefinement,
    handleBuildSelectedDirection,
    handleRetryBuild,
    handleRetryWithAction,
    handleClarificationQuickSelect,
    handleStartOver,
  };
}
