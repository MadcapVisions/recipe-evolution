export function detectTechniques(ingredients: string[]): string[] {
  const techniques: string[] = [];
  const normalized = ingredients.map((item) => item.trim().toLowerCase());

  if (normalized.includes("pasta")) {
    techniques.push("pastaWater");
  }

  if (normalized.includes("chicken") || normalized.includes("beef")) {
    techniques.push("searing");
  }

  if (normalized.includes("garlic")) {
    techniques.push("garlicBloom");
  }

  return techniques;
}
