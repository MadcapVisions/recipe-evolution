export type RecipeOutlineGroup = {
  name: string;
  items: string[];
};

export type RecipeOutline = {
  title: string;
  summary: string | null;
  dish_family: string | null;
  primary_ingredient: string | null;
  ingredient_groups: RecipeOutlineGroup[];
  step_outline: string[];
  chef_tip_topics: string[];
};

export function createEmptyRecipeOutline(): RecipeOutline {
  return {
    title: "",
    summary: null,
    dish_family: null,
    primary_ingredient: null,
    ingredient_groups: [],
    step_outline: [],
    chef_tip_topics: [],
  };
}
