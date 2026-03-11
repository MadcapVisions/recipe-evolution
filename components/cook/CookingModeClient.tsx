"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { trackEvent } from "@/lib/trackEvent";
import { Button } from "@/components/Button";
import { detectSubstitutions } from "@/lib/ai/substitutionEngine/substitutionDetector";
import { expandIngredients } from "@/lib/ai/flavorGraph/expandIngredients";
import { detectTechniques } from "@/lib/ai/chefEngine/techniqueDetector";

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

const makeSlug = () => {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let slug = "";
  for (let i = 0; i < 9; i += 1) {
    slug += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return slug;
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
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [startingLive, setStartingLive] = useState(false);
  const [submittingCompletion, setSubmittingCompletion] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [liveUnavailable, setLiveUnavailable] = useState(false);
  const [rating, setRating] = useState(5);
  const [improvements, setImprovements] = useState("");
  const [markAsBest, setMarkAsBest] = useState(false);
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

  const goBack = () => {
    setCurrentStepIndex((previous) => Math.max(previous - 1, 0));
  };

  const goNext = () => {
    setCurrentStepIndex((previous) => Math.min(previous + 1, totalSteps - 1));
  };

  const startLiveSession = async () => {
    setStartingLive(true);
    setError(null);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const shareSlug = makeSlug();
      const { error: insertError } = await supabase.from("cook_sessions").insert({
        version_id: versionId,
        owner_id: ownerId,
        share_slug: shareSlug,
      });

      if (!insertError) {
        await trackEvent("live_session_started", {
          recipeId,
          recipeTitle,
          versionId,
          shareSlug,
        });
        router.push(`/cook/live/${shareSlug}`);
        router.refresh();
        setStartingLive(false);
        return;
      }

      if (!insertError.message.toLowerCase().includes("duplicate")) {
        if (insertError.message.includes("public.cook_sessions")) {
          setLiveUnavailable(true);
          setError("Live sessions are not configured yet. Cooking mode still works.");
        } else {
          setError(insertError.message);
        }
        setStartingLive(false);
        return;
      }
    }

    setError("Unable to create live session. Please try again.");
    setStartingLive(false);
  };

  const completeCooking = async () => {
    setSubmittingCompletion(true);
    setError(null);

    const { error: ratingError } = await supabase
      .from("recipe_versions")
      .update({ rating })
      .eq("id", versionId);

    if (ratingError) {
      setError(ratingError.message);
      setSubmittingCompletion(false);
      return;
    }

    if (markAsBest) {
      const { error: bestError } = await supabase
        .from("recipes")
        .update({ best_version_id: versionId })
        .eq("id", recipeId);

      if (bestError) {
        setError(bestError.message);
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
      <div className="space-y-4 rounded-lg border bg-white p-4">
        <p className="text-base text-slate-700">No steps in this version.</p>
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

  return (
    <>
      <div className="min-h-[calc(100vh-10rem)] rounded-xl border bg-white p-6 shadow-sm">
        <div className="mx-auto flex h-full w-full max-w-5xl flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Cooking Mode</p>
                <h1 className="text-2xl font-semibold text-slate-900">{recipeTitle}</h1>
              </div>
              <Button href={`/recipes/${recipeId}`} variant="secondary" className="min-h-10">
                Back to Recipe
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-3 rounded-xl border bg-slate-50 p-3">
              <div className="rounded-lg bg-white p-3 text-center">
                <p className="text-xs text-slate-500">Servings</p>
                <p className="text-lg font-semibold text-slate-900">{servings ?? "-"}</p>
              </div>
              <div className="rounded-lg bg-white p-3 text-center">
                <p className="text-xs text-slate-500">Prep</p>
                <p className="text-lg font-semibold text-slate-900">{prepTimeMin ?? "-"} min</p>
              </div>
              <div className="rounded-lg bg-white p-3 text-center">
                <p className="text-xs text-slate-500">Cook</p>
                <p className="text-lg font-semibold text-slate-900">{cookTimeMin ?? "-"} min</p>
              </div>
            </div>

            {substitutionSuggestions.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">Missing Ingredients?</p>
                <div className="mt-2 space-y-2">
                  {substitutionSuggestions.map((entry) => (
                    <p key={entry.ingredient} className="text-sm text-amber-900">
                      {entry.ingredient} → try {entry.options.join(", ")}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            {(flavorPairings.length > 0 || recommendedTechniques.length > 0 || substitutionSuggestions.length > 0) ? (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <p className="text-sm font-semibold text-indigo-900">Chef Insights</p>
                {flavorPairings.length > 0 ? (
                  <p className="mt-2 text-sm text-indigo-900">
                    <span className="font-medium">Flavor Pairings:</span> {flavorPairings.join(", ")}
                  </p>
                ) : null}
                {recommendedTechniques.length > 0 ? (
                  <p className="mt-1 text-sm text-indigo-900">
                    <span className="font-medium">Recommended Technique:</span> {recommendedTechniques.join(", ")}
                  </p>
                ) : null}
                {substitutionSuggestions.length > 0 ? (
                  <div className="mt-1 space-y-1 text-sm text-indigo-900">
                    <p className="font-medium">Possible Substitutions:</p>
                    {substitutionSuggestions.map((entry) => (
                      <p key={`chef-insight-sub-${entry.ingredient}`}>
                        {entry.ingredient} → {entry.options[0]}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-xl border bg-gradient-to-r from-indigo-50 to-slate-50 p-6">
              <p className="text-sm font-medium text-slate-500">
                Step {safeIndex + 1} of {totalSteps}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-500">Step {safeIndex + 1}</p>
              <p className="mt-3 text-4xl font-semibold leading-tight text-slate-900">
                {parsedStep.instruction || currentStep?.text}
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
              {typeof currentStep?.timer_seconds === "number" ? (
                <p className="mt-4 inline-flex rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700">
                  Timer: {currentStep.timer_seconds} seconds
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={goBack}
                disabled={safeIndex === 0}
                variant="secondary"
                className="min-h-14 text-base"
              >
                Previous Step
              </Button>
              <Button
                onClick={goNext}
                disabled={safeIndex >= totalSteps - 1}
                className="min-h-14 text-base"
              >
                Next Step
              </Button>
            </div>

            {safeIndex >= totalSteps - 1 ? (
              <Button
                onClick={() => setShowCompletionModal(true)}
                className="min-h-14 w-full bg-green-700 text-base hover:bg-green-800"
              >
                Complete Cooking
              </Button>
            ) : null}

            {!liveUnavailable ? (
              <Button
                onClick={startLiveSession}
                disabled={startingLive}
                className="min-h-14 w-full text-base"
              >
                {startingLive ? "Starting..." : "Start Live Session"}
              </Button>
            ) : null}

            {error ? <p className="text-sm text-red-700">{error}</p> : null}
          </div>
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
