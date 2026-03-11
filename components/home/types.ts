export type RecentRecipe = {
  id: string;
  title: string;
  updated_at: string | null;
  is_favorite?: boolean;
  version_count: number;
  cover_image_url?: string | null;
};

export type HomeHubProps = {
  recentRecipes: RecentRecipe[];
  versionTimelineByRecipe: Record<
    string,
    Array<{ id: string; version_number: number; version_label: string | null; created_at: string }>
  >;
};

export type GeneratedRecipe = {
  title: string;
  description: string | null;
  servings: number | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  difficulty: string | null;
  ingredients: Array<{ name: string }>;
  steps: Array<{ text: string }>;
};

export type RecipeIdea = {
  title: string;
  description: string;
  cook_time_min: number | null;
};

export type ChatMessage = {
  role: "user" | "ai";
  text: string;
};
