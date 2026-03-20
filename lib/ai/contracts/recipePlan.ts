export type RecipePlan = {
  title_direction: string;
  dish_family: string;
  style_tags: string[];
  core_components: string[];
  key_ingredients: string[];
  blocked_ingredients: string[];
  technique_outline: string[];
  expected_texture: string[];
  expected_flavor: string[];
  confidence: number;
  notes: string[];
};

export function createEmptyRecipePlan(): RecipePlan {
  return {
    title_direction: "",
    dish_family: "",
    style_tags: [],
    core_components: [],
    key_ingredients: [],
    blocked_ingredients: [],
    technique_outline: [],
    expected_texture: [],
    expected_flavor: [],
    confidence: 0,
    notes: [],
  };
}
