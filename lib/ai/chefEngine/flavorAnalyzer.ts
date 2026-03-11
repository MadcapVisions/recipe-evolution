import { INGREDIENT_PAIRINGS } from "./ingredientPairings";

export function analyzeFlavor(ingredients: string[]): string[] {
  const suggestions: string[] = [];

  ingredients.forEach((ingredient) => {
    const key = ingredient.trim().toLowerCase();
    const pairings = INGREDIENT_PAIRINGS[key];

    if (pairings) {
      suggestions.push(`Try pairing ${ingredient} with ${pairings.slice(0, 3).join(", ")}`);
    }
  });

  return suggestions;
}
