import { expandIngredients } from "../flavorGraph/expandIngredients";
import { detectTechniques } from "../chefEngine/techniqueDetector";
import { detectSubstitutions } from "../substitutionEngine/substitutionDetector";

export function buildCookingContext(ingredients: string[]): string {
  const flavorExpansion = expandIngredients(ingredients);
  const techniques = detectTechniques(ingredients);
  const substitutions = detectSubstitutions(ingredients);

  return `

Cooking Context:

Ingredients:
${ingredients.join(", ")}

Flavor Pairings:
${flavorExpansion.join(", ")}

Recommended Techniques:
${techniques.join(", ")}

Possible Substitutions:
${JSON.stringify(substitutions)}

`;
}
