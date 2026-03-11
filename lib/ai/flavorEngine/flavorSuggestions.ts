import { INGREDIENT_PAIRINGS } from "./ingredientPairings";

type IngredientUpgrade = {
  ingredient: string;
  suggestions: string[];
};

export function suggestIngredientUpgrades(ingredients: string[]): IngredientUpgrade[] {
  const upgrades: IngredientUpgrade[] = [];

  ingredients.forEach((item) => {
    const key = item.trim().toLowerCase();
    const pairing = INGREDIENT_PAIRINGS[key];

    if (pairing) {
      upgrades.push({
        ingredient: item,
        suggestions: pairing,
      });
    }
  });

  return upgrades;
}
