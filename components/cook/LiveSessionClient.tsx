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
    <div className="saas-card flex min-h-[80vh] flex-col justify-between p-6">
      <div className="space-y-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Live Session</p>
        <p className="text-sm text-slate-600">Share code: {shareSlug}</p>
        <p className="text-sm font-medium text-slate-500">
          Step {safeIndex + 1} of {totalSteps}
        </p>
        <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-slate-50 p-6">
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
        {typeof currentStep?.timer_seconds === "number" ? (
          <p className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-base text-indigo-700">
            Timer: {currentStep.timer_seconds} seconds
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
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
              className="min-h-14 w-full text-base"
            >
              End Session
            </Button>
          </>
        ) : (
          <p className="rounded-md border bg-slate-50 p-3 text-sm text-slate-700">
            Read-only mode. The cook controls step changes.
          </p>
        )}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </div>
    </div>
  );
}
