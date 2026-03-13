"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/Button";
import { trackEventInBackground } from "@/lib/trackEventInBackground";

type RecipeFavoriteButtonProps = {
  recipeId: string;
  isFavorite: boolean;
  recipeTitle?: string;
};

export function RecipeFavoriteButton({ recipeId, isFavorite, recipeTitle }: RecipeFavoriteButtonProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const toggleFavorite = async () => {
    setSaving(true);
    const nextFavoriteState = !isFavorite;
    await supabase
      .from("recipes")
      .update({ is_favorite: nextFavoriteState })
      .eq("id", recipeId);
    trackEventInBackground(nextFavoriteState ? "recipe_favorited" : "recipe_unfavorited", {
      recipeId,
      title: recipeTitle ?? null,
    });
    setSaving(false);
    router.refresh();
  };

  return (
    <Button
      onClick={toggleFavorite}
      disabled={saving}
      variant="secondary"
      className="min-h-11"
    >
      {isFavorite ? "Unfavorite" : "Mark Favorite"}
    </Button>
  );
}
