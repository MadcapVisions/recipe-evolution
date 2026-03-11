"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/Button";

type RecipeFavoriteButtonProps = {
  recipeId: string;
  isFavorite: boolean;
};

export function RecipeFavoriteButton({ recipeId, isFavorite }: RecipeFavoriteButtonProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const toggleFavorite = async () => {
    setSaving(true);
    await supabase
      .from("recipes")
      .update({ is_favorite: !isFavorite })
      .eq("id", recipeId);
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
