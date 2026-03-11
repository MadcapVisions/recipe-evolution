"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/Button";

type MarkBestVersionButtonProps = {
  recipeId: string;
  versionId: string;
  isBest: boolean;
};

export function MarkBestVersionButton({ recipeId, versionId, isBest }: MarkBestVersionButtonProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markBest = async () => {
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("recipes")
      .update({ best_version_id: versionId })
      .eq("id", recipeId);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    router.refresh();
  };

  if (isBest) {
    return <p className="text-sm font-medium text-blue-700">Best Version</p>;
  }

  return (
    <div className="space-y-1">
      <Button
        onClick={markBest}
        disabled={saving}
        variant="secondary"
        className="min-h-11"
      >
        {saving ? "Saving..." : "Mark as Best Version"}
      </Button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
