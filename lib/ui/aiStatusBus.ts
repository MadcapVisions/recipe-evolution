"use client";

export type AiStatusTone = "default" | "loading" | "success" | "fallback";

export type AiStatusPayload = {
  message: string | null;
  tone?: AiStatusTone;
};

export const AI_STATUS_EVENT = "recipe-evolution:ai-status";

export function publishAiStatus(payload: AiStatusPayload) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<AiStatusPayload>(AI_STATUS_EVENT, { detail: payload }));
}
