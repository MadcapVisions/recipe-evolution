import type { RecipeDraft } from "@/lib/recipes/recipeDraft";

export type RecentRecipe = {
  id: string;
  title: string;
  updated_at: string | null;
  is_favorite?: boolean;
  version_count: number;
  servings: number | null;
  cover_image_url?: string | null;
};

export type HomeHubProps = {
  recentRecipes: RecentRecipe[];
  totalVersionCount: number;
  userTasteProfile: UserTasteProfile | null;
};

export type UserTasteProfile = {
  favoriteCuisines: string[];
  favoriteProteins: string[];
  preferredFlavors: string[];
  commonDietTags: string[];
  dislikedIngredients: string[];
  pantryStaples: string[];
  spiceTolerance: string | null;
  healthGoals: string[];
  tasteNotes: string | null;
};

export type GeneratedRecipe = RecipeDraft;

export type RecipeIdea = {
  title: string;
  description: string;
  cook_time_min: number | null;
};

export type ChatMessage = {
  role: "user" | "ai";
  text: string;
};
