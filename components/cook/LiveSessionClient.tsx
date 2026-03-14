"use client";

import { useEffect, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/Button";

type Step = {
  text: string;
  timer_seconds?: number;
};

function parseTechniqueStep(text?: string) {
  const raw = text ?? "";
  const techniqueMatch = raw.match(/Chef Technique:\s*([^\n]+)/i);
  const tipMatch = raw.match(/Chef Tip:\s*([^\n]+)/i);
  const instruction = raw
    .replace(/Chef Technique:\s*[^\n]+\n?/gi, "")
    .replace(/Chef Tip:\s*[^\n]+\n?/gi, "")
    .trim();

  return {
    instruction,
    technique: techniqueMatch?.[1]?.trim() ?? null,
    tip: tipMatch?.[1]?.trim() ?? null,
  };
}

type LiveSessionClientProps = {
  sessionId: string;
  shareSlug: string;
  isOwner: boolean;
  initialStepIndex: number;
  initialIsActive: boolean;
  steps: Step[];
};

type CookSessionRealtimeRow = {
  current_step_index?: number;
  is_active?: boolean;
};

function formatTimerLabel(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function LiveTimerPanel({
  durationSeconds,
  stepKey,
}: {
  durationSeconds: number;
  stepKey: string;
}) {
  const [remainingSeconds, setRemainingSeconds] = useState(durationSeconds);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    setRemainingSeconds(durationSeconds);
    setIsRunning(false);
  }, [durationSeconds, stepKey]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  return (
    <div className="rounded-[22px] border border-indigo-200 bg-indigo-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">Shared timer</p>
      <p className="mt-2 text-3xl font-semibold text-indigo-950">{formatTimerLabel(remainingSeconds)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => setIsRunning((current) => !current)} variant={isRunning ? "secondary" : "primary"} className="min-h-11">
          {isRunning ? "Pause" : "Start"}
        </Button>
        <Button
          onClick={() => {
            setRemainingSeconds(durationSeconds);
            setIsRunning(false);
          }}
          variant="secondary"
          className="min-h-11"
        >
          Reset
        </Button>
      </div>
    </div>
  );
}

export function LiveSessionClient({
  sessionId,
  shareSlug,
  isOwner,
  initialStepIndex,
  initialIsActive,
  steps,
}: LiveSessionClientProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(initialStepIndex);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;

    const requestWakeLock = async () => {
      if (!("wakeLock" in navigator)) {
        return;
      }
      try {
        wakeLock = await navigator.wakeLock.request("screen");
      } catch {
        // Wake lock unsupported or denied.
      }
    };

    requestWakeLock();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (wakeLock) {
        wakeLock.release().catch(() => undefined);
      }
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`cook_session_${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "cook_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload: RealtimePostgresChangesPayload<CookSessionRealtimeRow>) => {
          const next = payload.new as Partial<CookSessionRealtimeRow>;
          if (typeof next.current_step_index === "number") {
            setCurrentStepIndex(next.current_step_index);
          }
          if (typeof next.is_active === "boolean") {
            setIsActive(next.is_active);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const totalSteps = steps.length;
  const safeIndex = Math.min(Math.max(currentStepIndex, 0), Math.max(totalSteps - 1, 0));
  const currentStep = steps[safeIndex];
  const parsedStep = parseTechniqueStep(currentStep?.text);

  const updateStep = async (nextIndex: number) => {
    if (!isOwner || !isActive) {
      return;
    }

    const bounded = Math.min(Math.max(nextIndex, 0), Math.max(totalSteps - 1, 0));
    setError(null);

    const { error: updateError } = await supabase
      .from("cook_sessions")
      .update({ current_step_index: bounded })
      .eq("id", sessionId);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setCurrentStepIndex(bounded);
  };

  const endSession = async () => {
    if (!isOwner || !isActive) {
      return;
    }

    setError(null);

    const { error: updateError } = await supabase
      .from("cook_sessions")
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq("id", sessionId);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setIsActive(false);
  };

  if (!isActive) {
    return (
      <div className="saas-card space-y-4 p-6">
        <h1 className="page-title">Live Session</h1>
        <p className="text-base text-slate-700">This session has ended.</p>
      </div>
    );
  }

  return (
    <div className="saas-card p-6">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Live Session</p>
            <p className="mt-2 text-sm text-slate-600">Share code: {shareSlug}</p>
            <p className="mt-3 text-sm font-medium text-slate-500">
              Step {safeIndex + 1} of {totalSteps}
            </p>
          </div>
          <div className="rounded-full bg-[rgba(141,169,187,0.12)] px-3 py-1 text-sm font-medium text-slate-700">
            {isOwner ? "Host controls" : "Read-only viewer"}
          </div>
        </div>

        <div className="rounded-[28px] bg-gradient-to-r from-indigo-50 to-slate-50 p-6">
          <p className="text-3xl font-semibold leading-snug text-slate-900">
            {parsedStep.instruction || currentStep?.text || "No steps available."}
          </p>
          {parsedStep.technique ? (
            <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Chef Technique</p>
              <p className="mt-1 text-sm font-medium text-indigo-900">{parsedStep.technique}</p>
            </div>
          ) : null}
          {parsedStep.tip ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Chef Tip</p>
              <p className="mt-1 text-sm text-emerald-900">{parsedStep.tip}</p>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="rounded-[24px] border bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Session flow</p>
            <div className="mt-3 space-y-2">
              {steps.map((step, index) => {
                const parsed = parseTechniqueStep(step.text);
                const active = index === safeIndex;
                return (
                  <button
                    key={`${index}-${step.text}`}
                    type="button"
                    onClick={() => void updateStep(index)}
                    disabled={!isOwner || !isActive}
                    className={`w-full rounded-[18px] border px-3 py-3 text-left transition ${
                      active ? "border-[rgba(82,124,116,0.22)] bg-[rgba(82,124,116,0.08)]" : "bg-white"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Step {index + 1}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-900">{parsed.instruction || step.text}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            {typeof currentStep?.timer_seconds === "number" ? (
              <LiveTimerPanel durationSeconds={currentStep.timer_seconds} stepKey={`${safeIndex}-${currentStep.timer_seconds}`} />
            ) : null}
            {steps[safeIndex + 1] ? (
              <div className="rounded-[22px] border bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Up next</p>
                <p className="mt-2 text-sm leading-6 text-slate-900">{parseTechniqueStep(steps[safeIndex + 1].text).instruction || steps[safeIndex + 1].text}</p>
              </div>
            ) : null}
          </div>
        </div>

        {isOwner ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => updateStep(safeIndex - 1)}
                disabled={safeIndex === 0}
                variant="secondary"
                className="min-h-14 text-base"
              >
                Back
              </Button>
              <Button
                onClick={() => updateStep(safeIndex + 1)}
                disabled={safeIndex >= totalSteps - 1}
                className="min-h-14 text-base"
              >
                Next
              </Button>
            </div>
            <Button
              onClick={endSession}
              variant="danger"
              className="min-h-12 w-full text-base"
            >
              End Session
            </Button>
          </>
        ) : (
          <p className="rounded-[20px] border bg-slate-50 p-3 text-sm text-slate-700">
            Read-only mode. The cook controls step changes and shared timing.
          </p>
        )}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </div>
    </div>
  );
}
