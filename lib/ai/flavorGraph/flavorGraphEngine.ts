import { expandIngredients } from "./expandIngredients";

export function generateFlavorContext(ingredients: string[]): string {
  const expanded = expandIngredients(ingredients);

  return `

Flavor Pairing Suggestions:

${expanded.join(", ")}

Use these ingredients to improve flavor combinations.

`;
}
