// components/settings/ResetLearnedPreferencesButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResetLearnedPreferencesButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleReset() {
    if (status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/user/taste-scores/reset", { method: "POST" });
      if (!res.ok) throw new Error("Reset failed");
      setStatus("success");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p className="text-[14px] font-medium text-[color:var(--muted)]">
        Learned preferences cleared. Chef will start fresh from your next cook.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleReset}
        disabled={status === "loading"}
        className="rounded-full border border-[rgba(79,54,33,0.15)] bg-[rgba(255,252,246,0.9)] px-4 py-2 text-[14px] font-semibold text-[color:var(--text)] transition hover:bg-white disabled:opacity-50"
      >
        {status === "loading" ? "Clearing…" : "Reset learned preferences"}
      </button>
      {status === "error" && (
        <p className="text-[13px] text-red-600">Something went wrong. Please try again.</p>
      )}
    </div>
  );
}
