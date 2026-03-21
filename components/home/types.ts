import type { RecipeDraft } from "@/lib/recipes/recipeDraft";
import type { ChefDirectionOption } from "@/lib/ai/chefOptions";
import type { LockedDirectionSession } from "@/lib/ai/contracts/lockedDirectionSession";

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
  kind?: "message" | "direction_selected";
  options?: ChefDirectionOption[];
  recommendedOptionId?: string | null;
};

export type SelectedChefDirection = {
  replyIndex: number;
  optionId: string;
  title: string;
  summary: string;
  tags: string[];
};

export type { LockedDirectionSession };
