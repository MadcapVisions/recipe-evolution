import { FLAVOR_GRAPH } from "./flavorGraphData";

export function expandIngredients(ingredients: string[]): string[] {
  const expansions: string[] = [];

  ingredients.forEach((i) => {
    const key = i.trim().toLowerCase();
    const related = FLAVOR_GRAPH[key];

    if (related) {
      expansions.push(...related);
    }
  });

  return [...new Set(expansions)];
}
