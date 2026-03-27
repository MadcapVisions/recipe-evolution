"use client";

import { useEffect, useRef, useState } from "react";
import type { ConversationMessage, SelectedAssistantDirection, SuggestedChange } from "@/components/recipes/version-detail/types";
import { getRecipeSessionConversationKey } from "@/lib/ai/recipeSessionStore";

export function useRecipeAssistant(recipeId: string, versionId: string) {
  const [isAskingAi, setIsAskingAi] = useState(false);
  const [isGeneratingVersion, setIsGeneratingVersion] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [cooldownActive, setCooldownActive] = useState(false);
  const cooldownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [customInstruction, setCustomInstruction] = useState("");
  const [aiConversation, setAiConversation] = useState<ConversationMessage[]>([]);
  const [conversationKey, setConversationKey] = useState("");
  const [suggestedChange, setSuggestedChange] = useState<SuggestedChange | null>(null);
  const [selectedDirection, setSelectedDirection] = useState<SelectedAssistantDirection | null>(null);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ref = cooldownTimeoutRef;
    return () => {
      if (ref.current) {
        clearTimeout(ref.current);
      }
    };
  }, []);

  useEffect(() => {
    const storageScope = `${recipeId}`;
    const key = `recipe-ai-conversation-${storageScope}`;
    const conversationKeyStorage = `recipe-ai-conversation-key-${storageScope}`;
    const selectedDirectionKey = `recipe-ai-selected-direction-${storageScope}`;
    const raw = window.localStorage.getItem(key);
    const suggestionKey = `recipe-ai-suggestion-${storageScope}`;
    const rawSuggestion = window.localStorage.getItem(suggestionKey);
    const storedConversationKey = window.localStorage.getItem(conversationKeyStorage);
    const rawSelectedDirection = window.localStorage.getItem(selectedDirectionKey);

    let cancelled = false;
    void Promise.resolve().then(() => {
    if (cancelled) return;
    if (storedConversationKey?.trim()) {
      setConversationKey(storedConversationKey);
    } else {
      const nextConversationKey = getRecipeSessionConversationKey(recipeId);
      window.localStorage.setItem(conversationKeyStorage, nextConversationKey);
      setConversationKey(nextConversationKey);
    }

    if (!raw) {
      setAiConversation([]);
    } else {
      try {
        const parsed = JSON.parse(raw) as ConversationMessage[];
        if (Array.isArray(parsed)) {
          setAiConversation(
            parsed.filter(
              (item): item is ConversationMessage =>
                typeof item?.id === "string" &&
                (item?.role === "user" || item?.role === "assistant") &&
                typeof item?.text === "string" &&
                typeof item?.createdAt === "string"
            )
          );
        } else {
          setAiConversation([]);
        }
      } catch {
        setAiConversation([]);
      }
    }

    if (!rawSuggestion) {
      setSuggestedChange(null);
    } else {
      try {
        const parsedSuggestion = JSON.parse(rawSuggestion) as SuggestedChange;
        if (
          typeof parsedSuggestion?.instruction === "string" &&
          Array.isArray(parsedSuggestion?.ingredients) &&
          Array.isArray(parsedSuggestion?.steps)
        ) {
          setSuggestedChange(parsedSuggestion);
        } else {
          setSuggestedChange(null);
        }
      } catch {
        setSuggestedChange(null);
      }
    }

    if (!rawSelectedDirection) {
      setSelectedDirection(null);
    } else {
      try {
        const parsedSelectedDirection = JSON.parse(rawSelectedDirection) as SelectedAssistantDirection;
        if (
          typeof parsedSelectedDirection?.messageId === "string" &&
          typeof parsedSelectedDirection?.optionId === "string" &&
          typeof parsedSelectedDirection?.title === "string" &&
          typeof parsedSelectedDirection?.summary === "string" &&
          Array.isArray(parsedSelectedDirection?.tags)
        ) {
          setSelectedDirection({
            ...parsedSelectedDirection,
            tags: parsedSelectedDirection.tags.filter((tag): tag is string => typeof tag === "string"),
          });
        } else {
          setSelectedDirection(null);
        }
      } catch {
        setSelectedDirection(null);
      }
    }
    }); // end Promise.resolve().then
    return () => { cancelled = true; };
  }, [recipeId]);

  useEffect(() => {
    const key = `recipe-ai-conversation-${recipeId}`;
    window.localStorage.setItem(key, JSON.stringify(aiConversation.slice(-120)));
  }, [recipeId, aiConversation]);

  useEffect(() => {
    if (!conversationKey) {
      return;
    }
    const key = `recipe-ai-conversation-key-${recipeId}`;
    window.localStorage.setItem(key, conversationKey);
  }, [recipeId, conversationKey]);

  useEffect(() => {
    const key = `recipe-ai-suggestion-${recipeId}`;
    if (!suggestedChange) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(suggestedChange));
  }, [recipeId, suggestedChange]);

  useEffect(() => {
    const key = `recipe-ai-selected-direction-${recipeId}`;
    if (!selectedDirection) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(selectedDirection));
  }, [recipeId, selectedDirection]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [aiConversation]);

  useEffect(() => {
    if (!selectedDirection) {
      return;
    }

    const sourceMessage = aiConversation.find((message) => message.id === selectedDirection.messageId && message.role === "assistant");
    const optionStillExists = sourceMessage?.options?.some((option) => option.id === selectedDirection.optionId) ?? false;

    if (!optionStillExists) {
      void Promise.resolve().then(() => {
        setSelectedDirection(null);
      });
    }
  }, [aiConversation, selectedDirection]);

  return {
    isAskingAi,
    setIsAskingAi,
    isGeneratingVersion,
    setIsGeneratingVersion,
    aiError,
    setAiError,
    cooldownActive,
    setCooldownActive,
    cooldownTimeoutRef,
    customInstruction,
    setCustomInstruction,
    aiConversation,
    setAiConversation,
    conversationKey,
    suggestedChange,
    setSuggestedChange,
    selectedDirection,
    setSelectedDirection,
    conversationEndRef,
  };
}
