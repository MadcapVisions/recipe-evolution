"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { trackEvent } from "@/lib/trackEvent";
import {
  shouldShowIssueTags,
  shouldShowImproveCTA,
  buildPostCookPayload,
} from "@/lib/postcook/postCookFlowLogic";
import {
  POST_COOK_OVERALL_OUTCOMES,
  POST_COOK_ISSUE_TAGS,
  type PostCookOverallOutcome,
  type PostCookIssueTag,
} from "@/lib/ai/feedback/postCookFeedbackTypes";

type Step = "outcome" | "tags_and_more" | "done";

type Props = {
  recipeId: string;
  versionId: string;
  recipeTitle: string;
  /** Called when the flow is complete (submitted or skipped). Caller handles navigation. */
  onClose: () => void;
};

const OUTCOME_LABELS: Record<PostCookOverallOutcome, { label: string; emoji: string }> = {
  great:             { label: "Great!",            emoji: "😄" },
  good_with_changes: { label: "Good, with changes", emoji: "👍" },
  disappointing:     { label: "Disappointing",      emoji: "😕" },
  failed:            { label: "Didn't work out",    emoji: "😫" },
};

const ISSUE_TAG_LABELS: Record<PostCookIssueTag, string> = {
  too_bland:      "Too bland",
  too_salty:      "Too salty",
  too_spicy:      "Too spicy",
  too_heavy:      "Too heavy",
  too_complex:    "Too complex",
  too_many_steps: "Too many steps",
  texture_off:    "Texture off",
  too_wet:        "Too wet",
  too_dry:        "Too dry",
};

export function PostCookFeedbackSheet({ recipeId, versionId, recipeTitle, onClose }: Props) {
  const router = useRouter();

  const [step, setStep] = useState<Step>("outcome");
  const [outcome, setOutcome] = useState<PostCookOverallOutcome | null>(null);
  const [selectedTags, setSelectedTags] = useState<PostCookIssueTag[]>([]);
  const [wouldMakeAgain, setWouldMakeAgain] = useState<boolean | null>(null);
  const [notes, setNotes] = useState("");
  const [markAsBest, setMarkAsBest] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void trackEvent("postcook_prompt_viewed", { recipeId, versionId });
  }, [recipeId, versionId]);

  const handleSkip = async () => {
    await trackEvent("postcook_skipped", { recipeId, versionId, step });
    onClose();
  };

  const handleOutcomeSelect = async (selected: PostCookOverallOutcome) => {
    setOutcome(selected);
    if (shouldShowIssueTags(selected)) {
      setStep("tags_and_more");
    } else {
      await submit(selected, [], null, "");
    }
  };

  const handleTagToggle = (tag: PostCookIssueTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    void trackEvent("postcook_issue_tag_selected", { recipeId, versionId, tag });
  };

  const handleSubmitTagsStep = async () => {
    if (!outcome) return;
    await submit(outcome, selectedTags, wouldMakeAgain, notes);
  };

  const submit = async (
    submittedOutcome: PostCookOverallOutcome,
    tags: PostCookIssueTag[],
    wma: boolean | null,
    noteText: string
  ) => {
    setSubmitting(true);
    setError(null);

    if (noteText.trim().length > 0) {
      await trackEvent("postcook_note_added", { recipeId, versionId });
    }

    const payload = buildPostCookPayload(submittedOutcome, tags, wma, noteText);

    try {
      const response = await fetch(
        `/api/recipes/${recipeId}/versions/${versionId}/postcook`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok && response.status !== 409) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "Something went wrong. Your feedback was not saved.");
        setSubmitting(false);
        return;
      }

      if (markAsBest) {
        await fetch(`/api/recipes/${recipeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ best_version_id: versionId }),
        });
      }

      await trackEvent("postcook_submitted", {
        recipeId,
        versionId,
        outcome: submittedOutcome,
        tagCount: tags.length,
        wouldMakeAgain: wma,
        markedBest: markAsBest,
      });

      setOutcome(submittedOutcome);
      setSelectedTags(tags);
      setStep("done");
    } catch {
      setError("Could not save feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleImproveClick = () => {
    void trackEvent("postcook_improve_clicked", { recipeId, versionId });
    router.push(`/recipes/${recipeId}/versions/${versionId}?action=improve`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 sm:items-center sm:justify-center">
      <div className="w-full space-y-4 rounded-t-2xl bg-white p-5 sm:max-w-lg sm:rounded-2xl">

        {/* ── Step: outcome ── */}
        {step === "outcome" && (
          <>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                {recipeTitle}
              </p>
              <h2 className="text-xl font-semibold">How did it go?</h2>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {POST_COOK_OVERALL_OUTCOMES.map((o) => {
                const { label, emoji } = OUTCOME_LABELS[o];
                return (
                  <button
                    key={o}
                    onClick={() => void handleOutcomeSelect(o)}
                    disabled={submitting}
                    className="flex items-center gap-2 rounded-[18px] border border-[rgba(57,75,70,0.12)] bg-white px-4 py-3 text-left text-sm font-semibold transition hover:bg-emerald-50 disabled:opacity-50"
                  >
                    <span className="text-xl">{emoji}</span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={markAsBest}
                onChange={(e) => setMarkAsBest(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="font-medium">Mark as Best Version ⭐</span>
            </label>

            <button
              onClick={() => void handleSkip()}
              className="text-sm text-[color:var(--muted)] underline-offset-2 hover:underline"
            >
              Skip
            </button>
          </>
        )}

        {/* ── Step: tags_and_more ── */}
        {step === "tags_and_more" && (
          <>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">What needed changing?</h2>
              <p className="text-sm text-[color:var(--muted)]">
                Select all that apply — or just tap Submit.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {POST_COOK_ISSUE_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    selectedTags.includes(tag)
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : "border-[rgba(57,75,70,0.12)] bg-white text-[color:var(--foreground)] hover:bg-gray-50"
                  }`}
                >
                  {ISSUE_TAG_LABELS[tag]}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium">Would you make this again?</p>
              <div className="flex gap-2">
                {(["yes", "no"] as const).map((val) => {
                  const isYes = val === "yes";
                  const active = wouldMakeAgain === isYes;
                  return (
                    <button
                      key={val}
                      onClick={() => setWouldMakeAgain(active ? null : isYes)}
                      className={`flex-1 rounded-[14px] border py-2 text-sm font-medium transition ${
                        active
                          ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                          : "border-[rgba(57,75,70,0.12)] bg-white hover:bg-gray-50"
                      }`}
                    >
                      {isYes ? "Yes ✓" : "No ✗"}
                    </button>
                  );
                })}
              </div>
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Quick note (optional)…"
              rows={2}
              maxLength={500}
              className="w-full rounded-xl border border-[rgba(57,75,70,0.12)] p-3 text-sm"
            />

            {error && <p className="text-sm text-red-700">{error}</p>}

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => void handleSkip()}
                className="min-h-11 flex-1 text-sm"
                disabled={submitting}
              >
                Skip
              </Button>
              <Button
                onClick={() => void handleSubmitTagsStep()}
                disabled={submitting}
                className="min-h-11 flex-1 text-sm"
              >
                {submitting ? "Saving…" : "Submit"}
              </Button>
            </div>
          </>
        )}

        {/* ── Step: done ── */}
        {step === "done" && (
          <>
            <div className="space-y-1 text-center">
              <p className="text-4xl">🙌</p>
              <h2 className="text-xl font-semibold">Thanks!</h2>
              <p className="text-sm text-[color:var(--muted)]">
                Your feedback has been saved.
              </p>
            </div>

            {outcome && shouldShowImproveCTA(outcome, selectedTags) && (
              <Button
                onClick={handleImproveClick}
                variant="secondary"
                className="min-h-11 w-full text-sm"
              >
                Improve this recipe →
              </Button>
            )}

            <Button onClick={onClose} className="min-h-11 w-full text-sm">
              Done
            </Button>
          </>
        )}

      </div>
    </div>
  );
}
