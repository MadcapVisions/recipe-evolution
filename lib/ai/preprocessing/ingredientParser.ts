import { INGREDIENTS } from "../ingredientKnowledge/ingredients";

export function parseIngredients(text: string): string[] {
  const lower = text.toLowerCase();
  return INGREDIENTS.filter((ingredient) => lower.includes(ingredient));
}
