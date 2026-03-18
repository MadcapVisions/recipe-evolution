"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { trackEvent } from "@/lib/trackEvent";
import { Button } from "@/components/Button";
import { detectSubstitutions } from "@/lib/ai/substitutionEngine/substitutionDetector";
import { expandIngredients } from "@/lib/ai/flavorGraph/expandIngredients";
import { detectTechniques } from "@/lib/ai/chefEngine/techniqueDetector";
import { buildPrepPlan, type PrepChecklistItem } from "@/lib/recipes/prepPlan";
import { scaleCanonicalIngredientLine } from "@/lib/recipes/servings";
import { useTargetServings } from "@/lib/recipes/targetServings";
import { ServingsControl } from "@/components/ServingsControl";
import { ShellContextPanel } from "@/components/shell/ShellContextPanel";
import { useAppShell } from "@/components/shell/AppShellContext";

type Step = {
  text: string;
  timer_seconds?: number;
};

type CookingPhase = "prep" | "cook" | "finish";

type InsightCard = {
  title: string;
  body: string;
  tone: string;
};

function formatTimerLabel(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function PrepChecklistCard({
  item,
  checked,
  onToggle,
}: {
  item: PrepChecklistItem;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full rounded-[20px] border px-4 py-3 text-left transition ${
        checked ? "border-emerald-200 bg-emerald-100/80" : "border-[rgba(57,75,70,0.08)] bg-white/85"
      }`}
    >
      <p className={`text-sm leading-6 ${checked ? "text-emerald-700 line-through" : "text-emerald-950"}`}>{item.title}</p>
    </button>
  );
}

function InsightTile({ insight }: { insight: InsightCard }) {
  return (
    <div className={`rounded-[22px] border p-4 ${insight.tone}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em]">{insight.title}</p>
      <p className="mt-2 text-sm leading-6">{insight.body}</p>
    </div>
  );
}

function PhasePill({
  active,
  complete,
  label,
  description,
  onClick,
}: {
  active: boolean;
  complete: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[22px] border px-4 py-3 text-left transition ${
        active
          ? "border-[rgba(82,124,116,0.24)] bg-[rgba(82,124,116,0.1)]"
          : complete
            ? "border-[rgba(141,169,187,0.2)] bg-[rgba(141,169,187,0.08)]"
            : "border-[rgba(57,75,70,0.08)] bg-white"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">{label}</p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--text)]">{description}</p>
    </button>
  );
}

function IngredientCheckCard({
  item,
  checked,
  onToggle,
}: {
  item: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full rounded-[20px] border px-4 py-3 text-left transition ${
        checked ? "border-emerald-200 bg-emerald-100/80" : "border-[rgba(57,75,70,0.08)] bg-white"
      }`}
    >
      <p className={`text-sm leading-6 ${checked ? "text-emerald-800 line-through" : "text-[color:var(--text)]"}`}>{item}</p>
    </button>
  );
}

function StepTimerPanel({
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
    if (!isRunning) {
      return;
    }

    const interval = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isRunning]);

  return (
    <div className="rounded-[24px] border border-indigo-200 bg-indigo-50/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">Step timer</p>
          <p className="mt-2 text-3xl font-semibold text-indigo-950">{formatTimerLabel(remainingSeconds)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setIsRunning((current) => !current)} className="min-h-11" variant={isRunning ? "secondary" : "primary"}>
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
          <Button onClick={() => setRemainingSeconds((current) => current + 60)} variant="secondary" className="min-h-11">
            +1 min
          </Button>
        </div>
      </div>
    </div>
  );
}

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

type CookingModeClientProps = {
  recipeId: string;
  recipeTitle: string;
  versionId: string;
  ownerId: string;
  servings: number | null;
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  ingredientNames: string[];
  initialSteps: Step[];
};

export function CookingModeClient({
  recipeId,
  recipeTitle,
  versionId,
  ownerId,
  servings,
  prepTimeMin,
  cookTimeMin,
  ingredientNames,
  initialSteps,
}: CookingModeClientProps) {
  const router = useRouter();
  const { setOpenPanel } = useAppShell();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [startingLive, setStartingLive] = useState(false);
  const [submittingCompletion, setSubmittingCompletion] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [liveUnavailable, setLiveUnavailable] = useState(false);
  const [rating, setRating] = useState(5);
  const [improvements, setImprovements] = useState("");
  const [markAsBest, setMarkAsBest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedPrepIds, setCompletedPrepIds] = useState<string[]>([]);
  const [phase, setPhase] = useState<CookingPhase>("prep");
  const [rightSidebarMode, setRightSidebarMode] = useState<"overview" | "focus" | "flow">("focus");
  const [checkedIngredients, setCheckedIngredients] = useState<string[]>([]);
  const { targetServings, setTargetServings, canScale, baseServings } = useTargetServings(versionId, servings);

  const isCompactViewport = () => (typeof window !== "undefined" ? window.innerWidth < 1280 : false);

  const syncRightSidebarMode = (mode: "overview" | "focus" | "flow", reveal = false) => {
    setRightSidebarMode(mode);

    if (reveal && isCompactViewport()) {
      setOpenPanel("right");
    }
  };

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
    trackEvent("cooking_started", {
      recipeId,
      recipeTitle,
      versionId,
    });
  }, [recipeId, recipeTitle, versionId]);

  const totalSteps = initialSteps.length;
  const safeIndex = Math.min(Math.max(currentStepIndex, 0), Math.max(totalSteps - 1, 0));
  const currentStep = initialSteps[safeIndex];
  const parsedStep = parseTechniqueStep(currentStep?.text);
  const substitutionSuggestions = detectSubstitutions(ingredientNames);
  const flavorPairings = expandIngredients(ingredientNames);
  const recommendedTechniques = detectTechniques(ingredientNames.map((name) => name.toLowerCase()));
  const prepPlan = buildPrepPlan({
    ingredientNames: (canScale && baseServings ? ingredientNames.map((name) => scaleCanonicalIngredientLine(name, baseServings, targetServings)) : ingredientNames),
    stepTexts: initialSteps.map((step) => step.text),
  });
  const scaledIngredientLines = useMemo(
    () => (canScale && baseServings ? ingredientNames.map((name) => scaleCanonicalIngredientLine(name, baseServings, targetServings)) : ingredientNames),
    [baseServings, canScale, ingredientNames, targetServings]
  );
  const prepChecklistItems = useMemo(
    () =>
      prepPlan.checklist.reduce<Record<PrepChecklistItem["phase"], PrepChecklistItem[]>>(
        (groups, item) => {
          groups[item.phase].push(item);
          return groups;
        },
        {
          mise: [],
          "first-moves": [],
          "make-ahead": [],
          "cook-window": [],
        }
      ),
    [prepPlan.checklist]
  );
  const currentStepHighlight = useMemo(() => {
    const instruction = (parsedStep.instruction || currentStep?.text || "").toLowerCase();
    return prepPlan.stepHighlights.find((highlight) => instruction.includes(highlight.step.toLowerCase()) || highlight.step.toLowerCase().includes(instruction)) ?? null;
  }, [currentStep?.text, parsedStep.instruction, prepPlan.stepHighlights]);
  const secretSauceInsights = useMemo(() => {
    const insights: InsightCard[] = [];

    if (recommendedTechniques.length > 0) {
      insights.push({
        title: "Technique edge",
        body: `Lean on ${recommendedTechniques.slice(0, 2).join(" and ")} to improve texture, browning, and finish.`,
        tone: "border-indigo-200 bg-indigo-50 text-indigo-950",
      });
    }

    if (parsedStep.technique) {
      insights.push({
        title: "For this step",
        body: parsedStep.technique,
        tone: "border-sky-200 bg-sky-50 text-sky-950",
      });
    }

    if (parsedStep.tip) {
      insights.push({
        title: "Chef tip",
        body: parsedStep.tip,
        tone: "border-emerald-200 bg-emerald-50 text-emerald-950",
      });
    }

    if (currentStepHighlight?.ingredients.length) {
      insights.push({
        title: "Watch these ingredients",
        body: `Give extra attention to ${currentStepHighlight.ingredients.join(", ")} during this step so the final dish tastes more deliberate and balanced.`,
        tone: "border-amber-200 bg-amber-50 text-amber-950",
      });
    }

    if (flavorPairings.length > 0) {
      insights.push({
        title: "Finish stronger",
        body: `Flavor pairings worth leaning into here: ${flavorPairings.slice(0, 4).join(", ")}.`,
        tone: "border-[rgba(57,75,70,0.12)] bg-[rgba(255,253,249,0.9)] text-[color:var(--text)]",
      });
    }

    if (substitutionSuggestions.length > 0) {
      const primarySwap = substitutionSuggestions[0];
      insights.push({
        title: "Safety net",
        body: `If you are missing ${primarySwap.ingredient}, the cleanest fallback is ${primarySwap.options[0]}.`,
        tone: "border-[rgba(57,75,70,0.12)] bg-[rgba(255,253,249,0.9)] text-[color:var(--text)]",
      });
    }

    return insights.slice(0, 5);
  }, [
    currentStepHighlight?.ingredients,
    flavorPairings,
    parsedStep.technique,
    parsedStep.tip,
    recommendedTechniques,
    substitutionSuggestions,
  ]);
  const nextStepPreview =
    safeIndex < totalSteps - 1 ? parseTechniqueStep(initialSteps[safeIndex + 1]?.text).instruction || initialSteps[safeIndex + 1]?.text : null;
  const cookSupportNotes = useMemo(() => {
    const notes: Array<{ title: string; body: string }> = [];

    if (parsedStep.technique) {
      notes.push({ title: "Technique", body: parsedStep.technique });
    }

    if (parsedStep.tip) {
      notes.push({ title: "Chef tip", body: parsedStep.tip });
    }

    if (currentStepHighlight?.ingredients.length) {
      notes.push({
        title: "Watch closely",
        body: `${currentStepHighlight.ingredients.join(", ")} matter most in this step.`,
      });
    }

    if (substitutionSuggestions.length > 0) {
      notes.push({
        title: "Backup option",
        body: `${substitutionSuggestions[0].ingredient} can be replaced with ${substitutionSuggestions[0].options[0]}.`,
      });
    }

    return notes.slice(0, 3);
  }, [currentStepHighlight?.ingredients, parsedStep.technique, parsedStep.tip, substitutionSuggestions]);

  useEffect(() => {
    let cancelled = false;
    const loadPrepProgress = async () => {
      const response = await fetch(`/api/recipes/${recipeId}/versions/${versionId}/prep-progress`, {
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json()) as { completedChecklistIds?: string[] };
      if (!cancelled && response.ok) {
        setCompletedPrepIds(payload.completedChecklistIds ?? []);
      }
    };
    void loadPrepProgress();
    return () => {
      cancelled = true;
    };
  }, [recipeId, versionId]);

  useEffect(() => {
    setCheckedIngredients([]);
  }, [targetServings, versionId]);

  useEffect(() => {
    setRightSidebarMode("focus");
  }, [phase]);

  const toggleChecklistItem = (itemId: string) => {
    setRightSidebarMode("flow");
    const completed = !completedPrepIds.includes(itemId);
    setCompletedPrepIds((current) => (completed ? [...current, itemId] : current.filter((id) => id !== itemId)));
    void fetch(`/api/recipes/${recipeId}/versions/${versionId}/prep-progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checklist_item_id: itemId, completed }),
    });
  };

  const goBack = () => {
    setRightSidebarMode("focus");
    setCurrentStepIndex((previous) => Math.max(previous - 1, 0));
  };

  const goNext = () => {
    if (safeIndex >= totalSteps - 1) {
      setPhase("finish");
      return;
    }

    setRightSidebarMode("focus");
    setCurrentStepIndex((previous) => Math.min(previous + 1, totalSteps - 1));
  };

  const startLiveSession = async () => {
    setStartingLive(true);
    setError(null);

    const response = await fetch(`/api/recipes/${recipeId}/versions/${versionId}/live`, {
      method: "POST",
    });
    const payload = (await response.json()) as { error?: boolean; message?: string; shareSlug?: string };

    if (!response.ok || !payload.shareSlug) {
      if ((payload.message ?? "").includes("Live sessions are not configured")) {
        setLiveUnavailable(true);
      }
      setError(payload.message ?? "Unable to create live session. Please try again.");
      setStartingLive(false);
      return;
    }

    await trackEvent("live_session_started", {
      recipeId,
      recipeTitle,
      versionId,
      shareSlug: payload.shareSlug,
    });
    router.push(`/cook/live/${payload.shareSlug}`);
    router.refresh();
    setStartingLive(false);
  };

  const completeCooking = async () => {
    setSubmittingCompletion(true);
    setError(null);

    const ratingResponse = await fetch(`/api/recipes/${recipeId}/versions/${versionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating }),
    });
    const ratingPayload = (await ratingResponse.json()) as { message?: string };

    if (!ratingResponse.ok) {
      setError(ratingPayload.message ?? "Could not save rating.");
      setSubmittingCompletion(false);
      return;
    }

    if (markAsBest) {
      const bestResponse = await fetch(`/api/recipes/${recipeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ best_version_id: versionId }),
      });
      const bestPayload = (await bestResponse.json()) as { message?: string };

      if (!bestResponse.ok) {
        setError(bestPayload.message ?? "Could not favorite version.");
        setSubmittingCompletion(false);
        return;
      }
    }

    await trackEvent("rating_submitted", {
      recipeId,
      recipeTitle,
      versionId,
      rating,
      improvements,
      markedBest: markAsBest,
    });

    await trackEvent("cooking_completed", {
      recipeId,
      recipeTitle,
      versionId,
      rating,
      markedBest: markAsBest,
    });

    setSubmittingCompletion(false);
    setShowCompletionModal(false);
    router.push(`/recipes/${recipeId}`);
    router.refresh();
  };

  if (totalSteps === 0) {
    return (
      <div className="app-panel space-y-4 p-5">
        <p className="text-base text-[color:var(--muted)]">No cooking steps were saved for this version.</p>
        <Button
          onClick={() => router.push(`/recipes/${recipeId}`)}
          variant="secondary"
          className="min-h-12"
        >
          Back to Version
        </Button>
      </div>
    );
  }

  const phasePanelName = phase === "prep" ? "prep" : phase === "cook" ? "cook" : "finish";
  const contextPanelLabel =
    rightSidebarMode === "overview" ? "Session" : rightSidebarMode === "flow" ? (phase === "cook" ? "Flow" : phase === "prep" ? "Checklist" : "Finish") : phase === "prep" ? "Prep" : phase === "cook" ? "Cook" : "Finish";
  const contextPanelTitle =
    rightSidebarMode === "overview"
      ? "Cook session"
      : rightSidebarMode === "flow"
        ? phase === "cook"
          ? "Cooking flow"
          : phase === "prep"
            ? "Prep checklist"
            : "Finish checklist"
        : phase === "prep"
          ? "Prep support"
          : phase === "cook"
            ? "Active step support"
            : "Finish support";
  const contextPanelDescription =
    rightSidebarMode === "overview"
      ? "Keep the live session metrics and scaling controls nearby while the main workspace stays focused on the dish."
      : rightSidebarMode === "flow"
        ? phase === "cook"
          ? "Jump through the full cooking rail without leaving the current cook session."
          : phase === "prep"
            ? "Use the full ingredient and checklist rail while you stage the dish."
            : "Keep the final tasting and completion checklist close as you plate and serve."
        : phase === "prep"
          ? "Keep setup cues and chef notes close without shrinking the main prep flow."
          : phase === "cook"
            ? "Use this side panel for the cues and substitutions that matter for the current step."
            : "Use the finish panel for final tasting cues and service notes before you mark the cook complete.";

  return (
    <>
      <ShellContextPanel side="right" label={contextPanelLabel} title={contextPanelTitle} description={contextPanelDescription}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 rounded-[22px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,252,246,0.88)] p-1.5">
            <button
              type="button"
              onClick={() => syncRightSidebarMode("overview")}
              className={`rounded-[18px] px-3 py-2 text-sm font-semibold transition ${
                rightSidebarMode === "overview" ? "bg-white text-[color:var(--text)] shadow-[0_6px_14px_rgba(52,70,63,0.06)]" : "text-[color:var(--muted)]"
              }`}
            >
              Session
            </button>
            <button
              type="button"
              onClick={() => syncRightSidebarMode("focus")}
              className={`rounded-[18px] px-3 py-2 text-sm font-semibold transition ${
                rightSidebarMode === "focus" ? "bg-white text-[color:var(--text)] shadow-[0_6px_14px_rgba(52,70,63,0.06)]" : "text-[color:var(--muted)]"
              }`}
            >
              {phase === "prep" ? "Prep" : phase === "cook" ? "Focus" : "Finish"}
            </button>
            <button
              type="button"
              onClick={() => syncRightSidebarMode("flow")}
              className={`rounded-[18px] px-3 py-2 text-sm font-semibold transition ${
                rightSidebarMode === "flow" ? "bg-white text-[color:var(--text)] shadow-[0_6px_14px_rgba(52,70,63,0.06)]" : "text-[color:var(--muted)]"
              }`}
            >
              {phase === "cook" ? "Flow" : "Checklist"}
            </button>
          </div>

          {rightSidebarMode === "overview" ? (
            <section className="artifact-sheet p-4">
              <p className="app-kicker">{phasePanelName} session</p>
              <h2 className="mt-2 font-display text-[24px] font-semibold tracking-tight text-[color:var(--text)]">{recipeTitle}</h2>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-[18px] bg-white px-3 py-3 text-center">
                  <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Servings</p>
                  <p className="mt-2 text-lg font-semibold text-[color:var(--text)]">{canScale ? targetServings : servings ?? "-"}</p>
                </div>
                <div className="rounded-[18px] bg-white px-3 py-3 text-center">
                  <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Prep</p>
                  <p className="mt-2 text-lg font-semibold text-[color:var(--text)]">{prepTimeMin ?? "-"} min</p>
                </div>
                <div className="rounded-[18px] bg-white px-3 py-3 text-center">
                  <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Cook</p>
                  <p className="mt-2 text-lg font-semibold text-[color:var(--text)]">{cookTimeMin ?? "-"} min</p>
                </div>
              </div>
            </section>
          ) : null}

          {rightSidebarMode === "focus" && phase === "prep" ? (
            <>
              <section className="rounded-[28px] border border-emerald-200 bg-emerald-50/80 p-4">
                <p className="text-sm font-semibold text-emerald-900">Setup progress</p>
                <p className="mt-1 text-sm leading-6 text-emerald-800">
                  {completedPrepIds.length}/{prepPlan.checklist.length} checklist items done and {checkedIngredients.length}/{scaledIngredientLines.length} ingredients ready.
                </p>
              </section>
              <section className="rounded-[28px] border border-emerald-200 bg-emerald-50/80 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Chef setup notes</p>
                <div className="mt-4 space-y-3">
                  {prepPlan.firstMoves.length > 0 ? (
                    <div className="rounded-[22px] bg-white/88 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">First moves</p>
                      <p className="mt-2 text-sm leading-6 text-emerald-950">{prepPlan.firstMoves.slice(0, 2).join(" ")}</p>
                    </div>
                  ) : null}
                  {recommendedTechniques.length > 0 ? (
                    <div className="rounded-[22px] bg-white/88 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Pro prep focus</p>
                      <p className="mt-2 text-sm leading-6 text-emerald-950">Focus on {recommendedTechniques.slice(0, 2).join(" and ")} while you set up.</p>
                    </div>
                  ) : null}
                  {prepPlan.cookingWindows.length > 0 ? (
                    <div className="rounded-[22px] bg-white/88 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">While something cooks</p>
                      <ul className="mt-2 space-y-2">
                        {prepPlan.cookingWindows.slice(0, 1).map((item) => (
                          <li key={item} className="text-sm leading-6 text-emerald-950">{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </section>
            </>
          ) : null}

          {rightSidebarMode === "focus" && phase === "cook" ? (
            <>
              <section className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-4">
                <p className="text-sm font-semibold text-emerald-900">Need to know right now</p>
                <p className="mt-1 text-sm leading-6 text-emerald-800">Only the cues that help this specific step come out better.</p>
                <div className="mt-4 space-y-3">
                  {cookSupportNotes.length > 0 ? (
                    cookSupportNotes.map((note) => (
                      <div key={`${note.title}-${note.body}`} className="rounded-[22px] bg-white/88 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{note.title}</p>
                        <p className="mt-2 text-sm leading-7 text-emerald-950">{note.body}</p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-[22px] bg-white/88 p-4 text-sm leading-6 text-emerald-950">
                      No extra support notes are needed for this step. Focus on the instruction and timer.
                    </p>
                  )}
                </div>
              </section>

              {substitutionSuggestions.length > 0 && safeIndex === 0 ? (
                <section className="rounded-[28px] border border-amber-200 bg-amber-50/80 p-4">
                  <p className="text-sm font-semibold text-amber-900">Quick substitutions</p>
                  <div className="mt-3 space-y-2">
                    {substitutionSuggestions.slice(0, 2).map((entry) => (
                      <p key={entry.ingredient} className="rounded-[18px] bg-white/85 px-3 py-2 text-sm leading-6 text-amber-950">
                        <span className="font-semibold">{entry.ingredient}</span> → try {entry.options.join(", ")}
                      </p>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}

          {rightSidebarMode === "focus" && phase === "finish" ? (
            <section className="rounded-[28px] border border-emerald-200 bg-emerald-50/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Serve with intention</p>
              <div className="mt-4 space-y-3">
                {prepPlan.makeAheadTasks.slice(0, 1).map((item) => (
                  <div key={item} className="rounded-[22px] bg-white/88 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Finish cue</p>
                    <p className="mt-2 text-sm leading-7 text-emerald-950">{item}</p>
                  </div>
                ))}
                {currentStepHighlight?.ingredients.length ? (
                  <div className="rounded-[22px] bg-white/88 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Taste check</p>
                    <p className="mt-2 text-sm leading-7 text-emerald-950">
                      Taste again with special attention to {currentStepHighlight.ingredients.join(", ")} before serving.
                    </p>
                  </div>
                ) : null}
                {flavorPairings.length > 0 ? (
                  <div className="rounded-[22px] bg-white/88 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Final lift</p>
                    <p className="mt-2 text-sm leading-7 text-emerald-950">A last touch of {flavorPairings.slice(0, 3).join(", ")} can sharpen the finish.</p>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {rightSidebarMode === "flow" && phase === "prep" ? (
            <>
              {scaledIngredientLines.length > 0 ? (
                <section className="rounded-[24px] border border-[rgba(57,75,70,0.08)] bg-[rgba(141,169,187,0.04)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--text)]">Gather ingredients{canScale && servings ? ` for ${targetServings}` : ""}</p>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">Tap once each item is on the counter.</p>
                    </div>
                    <p className="text-sm text-[color:var(--muted)]">{checkedIngredients.length}/{scaledIngredientLines.length} ready</p>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {scaledIngredientLines.map((line, index) => (
                      <IngredientCheckCard
                        key={`${index}-${line}`}
                        item={line}
                        checked={checkedIngredients.includes(line)}
                        onToggle={() => {
                          setRightSidebarMode("flow");
                          setCheckedIngredients((current) => (current.includes(line) ? current.filter((item) => item !== line) : [...current, line]));
                        }}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="rounded-[28px] border border-emerald-200 bg-emerald-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">Prep checklist</p>
                    <p className="mt-1 text-sm leading-6 text-emerald-800">Finish the setup work that should happen before the live cooking flow starts.</p>
                  </div>
                  <p className="text-sm text-emerald-800">
                    {completedPrepIds.length}/{prepPlan.checklist.length} done
                  </p>
                </div>

                {prepChecklistItems.mise.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Mise en place</p>
                    {prepChecklistItems.mise.map((item) => (
                      <PrepChecklistCard key={item.id} item={item} checked={completedPrepIds.includes(item.id)} onToggle={() => toggleChecklistItem(item.id)} />
                    ))}
                  </div>
                ) : null}

                {prepChecklistItems["make-ahead"].length > 0 ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Make ahead</p>
                    {prepChecklistItems["make-ahead"].map((item) => (
                      <PrepChecklistCard key={item.id} item={item} checked={completedPrepIds.includes(item.id)} onToggle={() => toggleChecklistItem(item.id)} />
                    ))}
                  </div>
                ) : null}

                {prepChecklistItems["cook-window"].length > 0 ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Cook window</p>
                    {prepChecklistItems["cook-window"].map((item) => (
                      <PrepChecklistCard key={item.id} item={item} checked={completedPrepIds.includes(item.id)} onToggle={() => toggleChecklistItem(item.id)} />
                    ))}
                  </div>
                ) : null}
              </section>
            </>
          ) : null}

          {rightSidebarMode === "flow" && phase === "cook" ? (
            <section className="artifact-sheet p-4">
              <p className="text-sm font-semibold text-[color:var(--text)]">Full cooking flow</p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">Jump to any step without leaving cooking mode.</p>
              <div className="mt-4 space-y-2">
                {initialSteps.map((step, index) => {
                  const parsed = parseTechniqueStep(step.text);
                  const active = index === safeIndex;

                  return (
                    <button
                      key={`${index}-${step.text}`}
                      type="button"
                      onClick={() => {
                        setRightSidebarMode("flow");
                        setCurrentStepIndex(index);
                      }}
                      className={`w-full rounded-[20px] border px-4 py-3 text-left transition ${
                        active
                          ? "border-[rgba(82,124,116,0.22)] bg-[rgba(82,124,116,0.08)]"
                          : "border-[rgba(57,75,70,0.08)] bg-white hover:bg-[rgba(141,169,187,0.06)]"
                      }`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Step {index + 1}</p>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--text)]">{parsed.instruction || step.text}</p>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {rightSidebarMode === "flow" && phase === "finish" ? (
            <>
              <section className="rounded-[28px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.9)] p-4">
                <p className="text-sm font-semibold text-[color:var(--text)]">Before it hits the table</p>
                <div className="mt-4 space-y-2">
                  {[
                    "Taste for salt and acid right before serving.",
                    "Check texture and stop before the final mix gets muddy or overworked.",
                    "Only add garnish or finishing fat if it improves clarity, freshness, or richness.",
                  ].map((item) => (
                    <p key={item} className="rounded-[18px] bg-[rgba(141,169,187,0.08)] px-3 py-2 text-sm leading-6 text-[color:var(--text)]">
                      {item}
                    </p>
                  ))}
                </div>
              </section>
              <div className="grid gap-2">
                <Button onClick={() => setPhase("cook")} variant="secondary" className="min-h-12 text-base">
                  Back to Cooking
                </Button>
                <Button onClick={() => setShowCompletionModal(true)} className="min-h-12 bg-green-700 text-base hover:bg-green-800">
                  Complete Cooking
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </ShellContextPanel>

      <div className="rounded-[32px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.92)] p-4 shadow-[0_16px_36px_rgba(52,70,63,0.08)] sm:p-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">Cooking mode</p>
                <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-[color:var(--text)] sm:text-[34px]">{recipeTitle}</h1>
              </div>
              <Button href={`/recipes/${recipeId}`} variant="secondary" className="min-h-10">
                Back to Recipe
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-[28px] border border-[rgba(57,75,70,0.08)] bg-[rgba(141,169,187,0.08)] p-3 sm:grid-cols-3">
              <div className="rounded-[22px] bg-white p-3 text-center">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Servings</p>
                <p className="mt-2 text-lg font-semibold text-[color:var(--text)]">{canScale ? targetServings : servings ?? "-"}</p>
              </div>
              <div className="rounded-[22px] bg-white p-3 text-center">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Prep</p>
                <p className="mt-2 text-lg font-semibold text-[color:var(--text)]">{prepTimeMin ?? "-"} min</p>
              </div>
              <div className="rounded-[22px] bg-white p-3 text-center">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Cook</p>
                <p className="mt-2 text-lg font-semibold text-[color:var(--text)]">{cookTimeMin ?? "-"} min</p>
              </div>
            </div>

            <ServingsControl label="Cook for" baseServings={baseServings} targetServings={targetServings} onChange={setTargetServings} />

            <div className="grid gap-3 md:grid-cols-3">
              <PhasePill active={phase === "prep"} complete={phase !== "prep"} label="Prep" description="Gather ingredients, set up, and work through the smart prep cues." onClick={() => { setPhase("prep"); setRightSidebarMode("focus"); }} />
              <PhasePill active={phase === "cook"} complete={phase === "finish"} label="Cook" description="Focus on one active step at a time with timer and chef guidance." onClick={() => { setPhase("cook"); setRightSidebarMode("focus"); }} />
              <PhasePill active={phase === "finish"} complete={false} label="Finish" description="Do the final texture, seasoning, and serving checks." onClick={() => { setPhase("finish"); setRightSidebarMode("focus"); }} />
            </div>

            {phase === "prep" ? (
              <div className="space-y-5 xl:grid xl:grid-cols-[minmax(0,1.15fr)_360px] xl:gap-6 xl:space-y-0">
                <div className="space-y-5">
                <div className="rounded-[30px] border border-[rgba(57,75,70,0.08)] bg-[linear-gradient(135deg,rgba(223,247,235,0.74)_0%,rgba(255,255,255,0.94)_100%)] p-5 sm:p-6">
                  <p className="text-sm font-medium text-[color:var(--muted)]">Prep phase</p>
                  <h2 className="mt-3 text-[34px] font-semibold leading-[1.08] tracking-tight text-[color:var(--text)] sm:text-[42px]">Set yourself up before the heat starts.</h2>
                  <p className="mt-3 max-w-2xl text-[16px] leading-7 text-[color:var(--muted)]">
                    Great cooking starts with setup. Gather ingredients, do the prep that matters, and use the cues here to avoid avoidable mistakes.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => { setPhase("cook"); setRightSidebarMode("focus"); }} className="min-h-14 text-base">Begin Live Cooking</Button>
                  <Button onClick={() => { setPhase("cook"); setRightSidebarMode("focus"); }} variant="secondary" className="min-h-14 text-base">Skip Setup</Button>
                </div>

                {scaledIngredientLines.length > 0 ? (
                  <section className="rounded-[24px] border border-[rgba(57,75,70,0.08)] bg-[rgba(141,169,187,0.04)] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--text)]">Gather ingredients{canScale && servings ? ` for ${targetServings}` : ""}</p>
                        <p className="mt-1 text-sm text-[color:var(--muted)]">Tap once each item is on the counter.</p>
                      </div>
                      <p className="text-sm text-[color:var(--muted)]">{checkedIngredients.length}/{scaledIngredientLines.length} ready</p>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {scaledIngredientLines.map((line, index) => (
                        <IngredientCheckCard
                          key={`${index}-${line}`}
                          item={line}
                          checked={checkedIngredients.includes(line)}
                          onToggle={() =>
                            setCheckedIngredients((current) =>
                              current.includes(line) ? current.filter((item) => item !== line) : [...current, line]
                            )
                          }
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="rounded-[28px] border border-emerald-200 bg-emerald-50/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-emerald-900">Prep checklist</p>
                      <p className="mt-1 text-sm leading-6 text-emerald-800">Finish the setup work that should happen before the live cooking flow starts.</p>
                    </div>
                    <p className="text-sm text-emerald-800">
                      {completedPrepIds.length}/{prepPlan.checklist.length} done
                    </p>
                  </div>

                  {prepChecklistItems.mise.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Mise en place</p>
                      {prepChecklistItems.mise.map((item) => (
                        <PrepChecklistCard key={item.id} item={item} checked={completedPrepIds.includes(item.id)} onToggle={() => toggleChecklistItem(item.id)} />
                      ))}
                    </div>
                  ) : null}

                  {prepChecklistItems["make-ahead"].length > 0 ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Make ahead</p>
                      {prepChecklistItems["make-ahead"].map((item) => (
                        <PrepChecklistCard key={item.id} item={item} checked={completedPrepIds.includes(item.id)} onToggle={() => toggleChecklistItem(item.id)} />
                      ))}
                    </div>
                  ) : null}

                  {prepChecklistItems["cook-window"].length > 0 ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Cook window</p>
                      {prepChecklistItems["cook-window"].map((item) => (
                        <PrepChecklistCard key={item.id} item={item} checked={completedPrepIds.includes(item.id)} onToggle={() => toggleChecklistItem(item.id)} />
                      ))}
                    </div>
                  ) : null}
                </section>
                </div>

                <aside className="hidden space-y-4 xl:block">
                  <section className="rounded-[28px] border border-emerald-200 bg-emerald-50/80 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Chef setup notes</p>
                    <div className="mt-4 space-y-3">
                      {prepPlan.firstMoves.length > 0 ? (
                        <div className="rounded-[22px] bg-white/88 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">First moves</p>
                          <p className="mt-2 text-sm leading-6 text-emerald-950">{prepPlan.firstMoves.slice(0, 2).join(" ")}</p>
                        </div>
                      ) : null}
                      {recommendedTechniques.length > 0 ? (
                        <div className="rounded-[22px] bg-white/88 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Pro prep focus</p>
                          <p className="mt-2 text-sm leading-6 text-emerald-950">Focus on {recommendedTechniques.slice(0, 2).join(" and ")} while you set up.</p>
                        </div>
                      ) : null}
                      {prepPlan.cookingWindows.length > 0 ? (
                        <div className="rounded-[22px] bg-white/88 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">While something cooks</p>
                          <ul className="mt-2 space-y-2">
                            {prepPlan.cookingWindows.slice(0, 1).map((item) => (
                              <li key={item} className="text-sm leading-6 text-emerald-950">{item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </section>
                </aside>
              </div>
            ) : null}

            {phase === "cook" ? (
              <div className="space-y-4 xl:grid xl:grid-cols-[minmax(0,1.2fr)_320px] xl:gap-5 xl:space-y-0">
                <div className="space-y-4">
                  <div className="rounded-[30px] border border-[rgba(57,75,70,0.08)] bg-[linear-gradient(135deg,rgba(224,232,246,0.78)_0%,rgba(255,255,255,0.92)_100%)] p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[color:var(--muted)]">Step {safeIndex + 1} of {totalSteps}</p>
                        <h2 className="mt-3 text-[34px] font-semibold leading-[1.08] tracking-tight text-slate-900 sm:text-[44px]">
                          {parsedStep.instruction || currentStep?.text}
                        </h2>
                      </div>
                      {typeof currentStep?.timer_seconds === "number" ? (
                        <p className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700">
                          Suggested timer: {Math.round(currentStep.timer_seconds / 60)} min
                        </p>
                      ) : null}
                    </div>

                    {secretSauceInsights.length > 0 ? <div className="mt-4 max-w-xl"><InsightTile insight={secretSauceInsights[0]} /></div> : null}
                  </div>

                  {typeof currentStep?.timer_seconds === "number" ? (
                    <StepTimerPanel durationSeconds={currentStep.timer_seconds} stepKey={`${safeIndex}-${currentStep.timer_seconds}`} />
                  ) : null}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Button onClick={goBack} disabled={safeIndex === 0} variant="secondary" className="min-h-14 text-base">
                      Previous Step
                    </Button>
                    <Button onClick={goNext} className="min-h-14 text-base">
                      {safeIndex >= totalSteps - 1 ? "Finish Dish" : "Next Step"}
                    </Button>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
                    {nextStepPreview ? (
                      <div className="rounded-[24px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.92)] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Up next</p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--text)]">{nextStepPreview}</p>
                      </div>
                    ) : <div />}
                    {!liveUnavailable ? (
                      <div className="max-w-sm justify-self-start lg:justify-self-end">
                        <Button onClick={startLiveSession} disabled={startingLive} variant="secondary" className="min-h-12 w-full text-base">
                          {startingLive ? "Starting..." : "Start Live Session"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <aside className="hidden space-y-4 xl:block">
                  <section className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 p-4">
                    <p className="text-sm font-semibold text-emerald-900">Need to know right now</p>
                    <p className="mt-1 text-sm leading-6 text-emerald-800">Only the cues that help this specific step come out better.</p>
                    <div className="mt-4 space-y-3">
                      {cookSupportNotes.length > 0 ? (
                        cookSupportNotes.map((note) => (
                          <div key={`${note.title}-${note.body}`} className="rounded-[22px] bg-white/88 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{note.title}</p>
                            <p className="mt-2 text-sm leading-7 text-emerald-950">{note.body}</p>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-[22px] bg-white/88 p-4 text-sm leading-6 text-emerald-950">
                          No extra support notes are needed for this step. Focus on the instruction and timer.
                        </p>
                      )}
                    </div>
                  </section>

                  {substitutionSuggestions.length > 0 && safeIndex === 0 ? (
                    <section className="rounded-[28px] border border-amber-200 bg-amber-50/80 p-4">
                      <p className="text-sm font-semibold text-amber-900">Quick substitutions</p>
                      <div className="mt-3 space-y-2">
                        {substitutionSuggestions.slice(0, 2).map((entry) => (
                          <p key={entry.ingredient} className="rounded-[18px] bg-white/85 px-3 py-2 text-sm leading-6 text-amber-950">
                            <span className="font-semibold">{entry.ingredient}</span> → try {entry.options.join(", ")}
                          </p>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </aside>
              </div>
            ) : null}

            {phase === "finish" ? (
              <div className="space-y-5 xl:grid xl:grid-cols-[minmax(0,1.1fr)_360px] xl:gap-6 xl:space-y-0">
                <div className="space-y-5">
                  <div className="rounded-[30px] border border-[rgba(170,138,87,0.16)] bg-[linear-gradient(135deg,rgba(247,239,220,0.92)_0%,rgba(255,250,241,0.98)_100%)] p-5 sm:p-6">
                    <p className="text-sm font-medium text-[color:var(--muted)]">Finish phase</p>
                    <h2 className="mt-3 text-[34px] font-semibold leading-[1.08] tracking-tight text-[color:var(--text)] sm:text-[42px]">Taste, adjust, and serve with confidence.</h2>
                    <p className="mt-3 max-w-2xl text-[16px] leading-7 text-[color:var(--muted)]">
                      This is where the dish gets polished. Check texture, seasoning, garnish, and final balance before it hits the table.
                    </p>
                  </div>

                  <section className="rounded-[28px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.9)] p-4">
                    <p className="text-sm font-semibold text-[color:var(--text)]">Before it hits the table</p>
                    <div className="mt-4 space-y-2">
                      {[
                        "Taste for salt and acid right before serving.",
                        "Check texture and stop before the final mix gets muddy or overworked.",
                        "Only add garnish or finishing fat if it improves clarity, freshness, or richness.",
                      ].map((item) => (
                        <p key={item} className="rounded-[18px] bg-[rgba(141,169,187,0.08)] px-3 py-2 text-sm leading-6 text-[color:var(--text)]">
                          {item}
                        </p>
                      ))}
                    </div>
                  </section>

                  <div className="space-y-3">
                    <p className="text-sm leading-6 text-[color:var(--muted)]">You are ready to serve. Give it one last taste, then mark the cook complete.</p>
                    <div className="flex flex-wrap gap-3">
                    <Button onClick={() => { setPhase("cook"); setRightSidebarMode("focus"); }} variant="secondary" className="min-h-14 text-base">
                      Back to Cooking
                    </Button>
                    <Button onClick={() => setShowCompletionModal(true)} className="min-h-14 bg-green-700 text-base hover:bg-green-800">
                      Complete Cooking
                    </Button>
                    </div>
                  </div>
                </div>

                <aside className="hidden space-y-4 xl:block">
                  <section className="rounded-[28px] border border-emerald-200 bg-emerald-50/80 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Serve with intention</p>
                    <div className="mt-4 space-y-3">
                      {prepPlan.makeAheadTasks.slice(0, 1).map((item) => (
                        <div key={item} className="rounded-[22px] bg-white/88 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Finish cue</p>
                          <p className="mt-2 text-sm leading-7 text-emerald-950">{item}</p>
                        </div>
                      ))}
                      {currentStepHighlight?.ingredients.length ? (
                        <div className="rounded-[22px] bg-white/88 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Taste check</p>
                          <p className="mt-2 text-sm leading-7 text-emerald-950">
                            Taste again with special attention to {currentStepHighlight.ingredients.join(", ")} before serving.
                          </p>
                        </div>
                      ) : null}
                      {flavorPairings.length > 0 ? (
                        <div className="rounded-[22px] bg-white/88 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Final lift</p>
                          <p className="mt-2 text-sm leading-7 text-emerald-950">A last touch of {flavorPairings.slice(0, 3).join(", ")} can sharpen the finish.</p>
                        </div>
                      ) : null}
                    </div>
                  </section>
                </aside>
              </div>
            ) : null}
          </div>

          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </div>
      </div>

      {showCompletionModal ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 sm:items-center sm:justify-center">
          <div className="w-full space-y-3 rounded-t-xl bg-white p-4 sm:max-w-lg sm:rounded-xl">
            <h2 className="text-xl font-semibold">Rate this version</h2>
            <label className="space-y-1">
              <span className="text-sm font-medium">Rating (1-5)</span>
              <select
                value={rating}
                onChange={(event) => setRating(Number(event.target.value))}
                className="min-h-12 w-full"
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium">What would you improve?</span>
              <textarea
                value={improvements}
                onChange={(event) => setImprovements(event.target.value)}
                className="min-h-24 w-full"
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={markAsBest}
                onChange={(event) => setMarkAsBest(event.target.checked)}
              />
              Mark as Best Version
            </label>

            <div className="flex gap-2">
              <Button
                onClick={() => setShowCompletionModal(false)}
                variant="secondary"
                className="min-h-12 flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={completeCooking}
                disabled={submittingCompletion}
                className="min-h-12 flex-1"
              >
                {submittingCompletion ? "Saving..." : "Submit"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
