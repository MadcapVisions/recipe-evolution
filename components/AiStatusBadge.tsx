"use client";

import { useEffect, useState } from "react";
import { AI_STATUS_EVENT, type AiStatusPayload, type AiStatusTone } from "@/lib/ui/aiStatusBus";

function toneClasses(tone: AiStatusTone) {
  if (tone === "loading") {
    return {
      wrap:
        "border-[rgba(210,76,47,0.16)] bg-[rgba(255,249,243,0.94)] text-[color:var(--text)] shadow-[0_4px_12px_rgba(101,47,29,0.05)]",
      dot: "bg-[color:var(--primary)] animate-pulse",
    };
  }
  if (tone === "success") {
    return {
      wrap:
        "border-[rgba(210,76,47,0.16)] bg-[rgba(255,245,240,0.95)] text-[color:var(--text)] shadow-[0_4px_12px_rgba(101,47,29,0.05)]",
      dot: "bg-[color:var(--primary)]",
    };
  }
  if (tone === "fallback") {
    return {
      wrap:
        "border-[rgba(224,154,72,0.24)] bg-[rgba(255,248,239,0.96)] text-[color:var(--text)] shadow-[0_4px_12px_rgba(101,47,29,0.05)]",
      dot: "bg-[color:var(--accent)]",
    };
  }
  return {
    wrap:
      "border-[rgba(210,76,47,0.18)] bg-[rgba(255,246,240,0.96)] text-[color:var(--text)] shadow-[0_4px_12px_rgba(101,47,29,0.05)]",
    dot: "bg-[color:var(--primary)]",
  };
}

export function AiStatusBadge({ defaultMessage }: { defaultMessage: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<AiStatusTone>("default");

  useEffect(() => {
    const handleStatus = (event: Event) => {
      const detail = (event as CustomEvent<AiStatusPayload>).detail;
      setMessage(detail?.message ?? null);
      setTone(detail?.tone ?? "default");
    };

    window.addEventListener(AI_STATUS_EVENT, handleStatus);
    return () => {
      window.removeEventListener(AI_STATUS_EVENT, handleStatus);
    };
  }, []);

  const activeMessage = message?.trim() || defaultMessage;
  const classes = toneClasses(message ? tone : "default");

  return (
    <div
      className={`inline-flex min-h-10 items-center gap-2.5 rounded-full border px-3 py-2 text-[14px] font-semibold tracking-[0.01em] transition-all duration-300 sm:min-h-12 sm:gap-3 sm:px-4 sm:py-2.5 sm:text-[15px] ${classes.wrap}`}
      aria-live="polite"
    >
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${classes.dot}`} />
      {activeMessage}
    </div>
  );
}
