"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PostCookFeedbackSheet } from "@/components/postcook/PostCookFeedbackSheet";

type Props = {
  recipeId: string;
  versionId: string;
  recipeTitle: string;
};

export function PostCookReminderBanner({ recipeId, versionId, recipeTitle }: Props) {
  const router = useRouter();
  const [showSheet, setShowSheet] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-[18px] border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm">
        <span className="text-emerald-900">How did this cook go?</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSheet(true)}
            className="font-semibold text-emerald-700 underline-offset-2 hover:underline"
          >
            Leave feedback
          </button>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="text-emerald-600 hover:text-emerald-900"
          >
            ✕
          </button>
        </div>
      </div>

      {showSheet ? (
        <PostCookFeedbackSheet
          recipeId={recipeId}
          versionId={versionId}
          recipeTitle={recipeTitle}
          onClose={() => {
            setShowSheet(false);
            setDismissed(true);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
