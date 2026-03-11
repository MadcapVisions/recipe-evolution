"use client";

import { useEffect, useRef, useState } from "react";
import type { ConversationMessage, SuggestedChange } from "@/components/recipes/version-detail/types";

export function useRecipeAssistant(recipeId: string) {
  const [isAskingAi, setIsAskingAi] = useState(false);
  const [isGeneratingVersion, setIsGeneratingVersion] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [cooldownActive, setCooldownActive] = useState(false);
  const cooldownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [customInstruction, setCustomInstruction] = useState("");
  const [aiConversation, setAiConversation] = useState<ConversationMessage[]>([]);
  const [suggestedChange, setSuggestedChange] = useState<SuggestedChange | null>(null);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownTimeoutRef.current) {
        clearTimeout(cooldownTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const key = `recipe-ai-conversation-${recipeId}`;
    const raw = window.localStorage.getItem(key);
    const suggestionKey = `recipe-ai-suggestion-${recipeId}`;
    const rawSuggestion = window.localStorage.getItem(suggestionKey);

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
      return;
    }

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
  }, [recipeId]);

  useEffect(() => {
    const key = `recipe-ai-conversation-${recipeId}`;
    window.localStorage.setItem(key, JSON.stringify(aiConversation.slice(-120)));
  }, [recipeId, aiConversation]);

  useEffect(() => {
    const key = `recipe-ai-suggestion-${recipeId}`;
    if (!suggestedChange) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(suggestedChange));
  }, [recipeId, suggestedChange]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [aiConversation]);

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
    suggestedChange,
    setSuggestedChange,
    conversationEndRef,
  };
}
