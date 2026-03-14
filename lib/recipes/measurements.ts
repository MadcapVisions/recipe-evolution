const UNIT_TO_BASE: Record<string, { family: "volume" | "weight" | "count"; factor: number; label: string }> = {
  tsp: { family: "volume", factor: 1, label: "tsp" },
  tbsp: { family: "volume", factor: 3, label: "tbsp" },
  cup: { family: "volume", factor: 48, label: "cup" },
  ml: { family: "volume", factor: 0.202884, label: "ml" },
  l: { family: "volume", factor: 202.884, label: "l" },
  oz: { family: "weight", factor: 1, label: "oz" },
  lb: { family: "weight", factor: 16, label: "lb" },
  g: { family: "weight", factor: 0.035274, label: "g" },
  kg: { family: "weight", factor: 35.274, label: "kg" },
  clove: { family: "count", factor: 1, label: "clove" },
  can: { family: "count", factor: 1, label: "can" },
  package: { family: "count", factor: 1, label: "package" },
};

const NORMALIZED_UNITS: Record<string, string> = {
  teaspoon: "tsp",
  teaspoons: "tsp",
  tsp: "tsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tbsp: "tbsp",
  cup: "cup",
  cups: "cup",
  ml: "ml",
  l: "l",
  ounce: "oz",
  ounces: "oz",
  oz: "oz",
  pound: "lb",
  pounds: "lb",
  lbs: "lb",
  lb: "lb",
  gram: "g",
  grams: "g",
  g: "g",
  kilogram: "kg",
  kilograms: "kg",
  kg: "kg",
  clove: "clove",
  cloves: "clove",
  can: "can",
  cans: "can",
  package: "package",
  packages: "package",
};

export function normalizeMeasurementUnit(unit: string | null) {
  if (!unit) return null;
  return NORMALIZED_UNITS[unit.trim().toLowerCase()] ?? unit.trim().toLowerCase();
}

export function combineMeasuredQuantities(
  left: { quantity: number | null; unit: string | null },
  right: { quantity: number | null; unit: string | null }
) {
  const leftUnit = normalizeMeasurementUnit(left.unit);
  const rightUnit = normalizeMeasurementUnit(right.unit);

  if (left.quantity == null && right.quantity == null) {
    return { quantity: null, unit: leftUnit ?? rightUnit };
  }

  if (!leftUnit || !rightUnit || left.quantity == null || right.quantity == null) {
    const mergedQuantity = (left.quantity ?? 0) + (right.quantity ?? 0);
    return {
      quantity: mergedQuantity !== 0 ? mergedQuantity : (left.quantity ?? right.quantity),
      unit: leftUnit ?? rightUnit,
    };
  }

  const leftMeta = UNIT_TO_BASE[leftUnit];
  const rightMeta = UNIT_TO_BASE[rightUnit];

  if (!leftMeta || !rightMeta || leftMeta.family !== rightMeta.family) {
    return { quantity: (left.quantity ?? 0) + (right.quantity ?? 0), unit: leftUnit };
  }

  const baseQuantity = left.quantity * leftMeta.factor + right.quantity * rightMeta.factor;

  if (leftMeta.family === "volume") {
    if (baseQuantity >= 48) return { quantity: Math.round((baseQuantity / 48) * 100) / 100, unit: "cup" };
    if (baseQuantity >= 3) return { quantity: Math.round((baseQuantity / 3) * 100) / 100, unit: "tbsp" };
    return { quantity: Math.round(baseQuantity * 100) / 100, unit: "tsp" };
  }

  if (leftMeta.family === "weight") {
    if (baseQuantity >= 16) return { quantity: Math.round((baseQuantity / 16) * 100) / 100, unit: "lb" };
    return { quantity: Math.round(baseQuantity * 100) / 100, unit: "oz" };
  }

  return { quantity: Math.round(baseQuantity * 100) / 100, unit: leftUnit };
}
