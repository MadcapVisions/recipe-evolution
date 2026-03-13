"use client";

import { useEffect, useState } from "react";
import { AI_STATUS_EVENT, type AiStatusPayload, type AiStatusTone } from "@/lib/ui/aiStatusBus";

function toneClasses(tone: AiStatusTone) {
  if (tone === "loading") {
    return {
      wrap:
        "border-sky-300/70 bg-[linear-gradient(135deg,rgba(127,180,197,0.22)_0%,rgba(82,124,116,0.12)_100%)] text-sky-950 shadow-[0_10px_24px_rgba(97,150,173,0.16)]",
      dot: "bg-sky-500 animate-pulse",
    };
  }
  if (tone === "success") {
    return {
      wrap:
        "border-emerald-300/80 bg-[linear-gradient(135deg,rgba(209,245,227,0.85)_0%,rgba(236,252,243,0.95)_100%)] text-emerald-950 shadow-[0_10px_24px_rgba(38,136,96,0.12)]",
      dot: "bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.16)]",
    };
  }
  if (tone === "fallback") {
    return {
      wrap:
        "border-amber-300/80 bg-[linear-gradient(135deg,rgba(255,239,201,0.92)_0%,rgba(255,248,228,0.96)_100%)] text-amber-950 shadow-[0_10px_24px_rgba(180,123,32,0.12)]",
      dot: "bg-amber-500",
    };
  }
  return {
    wrap:
      "border-emerald-300/75 bg-[linear-gradient(135deg,rgba(223,247,235,0.95)_0%,rgba(245,252,248,0.98)_100%)] text-emerald-950 shadow-[0_10px_24px_rgba(46,125,94,0.1)]",
    dot: "bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.12)]",
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
