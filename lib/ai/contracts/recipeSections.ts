export type RecipeHeaderSection = {
  title: string;
  description: string | null;
  servings: number | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  difficulty: string | null;
};

export type RecipeSections = {
  header: RecipeHeaderSection;
  ingredients: string[];
  steps: string[];
  tips: string[];
};

export type RecipeIngredientSectionItem = {
  name: string;
  quantity: number | null;
  unit: string | null;
  prep: string | null;
};

export type RecipeIngredientSection = {
  servings: number | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  difficulty: string | null;
  ingredients: RecipeIngredientSectionItem[];
};

export type RecipeInstructionSection = {
  description: string | null;
  steps: Array<{ text: string }>;
  chefTips: string[];
};
