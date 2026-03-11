import { FLAVOR_RULES } from "./flavorRules";

export function analyzeFlavorBalance(recipeText: string): string[] {
  const suggestions: string[] = [];
  const text = recipeText.toLowerCase();

  if (text.includes("cream") || text.includes("butter")) {
    suggestions.push(
      `Add acidity like lemon or vinegar to balance richness (${FLAVOR_RULES.balanceFixes.tooRich.join(", ")}).`
    );
  }

  if (text.includes("chili") || text.includes("spicy")) {
    suggestions.push(
      `Add cooling ingredients like yogurt or sour cream (${FLAVOR_RULES.balanceFixes.tooSpicy.join(", ")}).`
    );
  }

  if (text.includes("tomato")) {
    suggestions.push("Enhance flavor with garlic, basil, or parmesan.");
  }

  return suggestions;
}
