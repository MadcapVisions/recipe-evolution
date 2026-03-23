import { formatIngredientLine } from "../recipes/recipeDraft";

export type HomeGeneratedRecipe = {
  title: string;
  description: string | null;
  servings: number | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  difficulty: string | null;
  ingredients: Array<{ name: string }>;
  steps: Array<{ text: string }>;
  chefTips: string[];
};

export type NormalizationLog = {
  raw_top_level_keys: string[];
  path_taken: "direct" | "unwrapped" | "failed";
  missing_fields: string[];
  repaired_fields: string[];
};

export type RecipeNormalizationResult = {
  recipe: HomeGeneratedRecipe | null;
  reason: string | null;
  normalization_log: NormalizationLog;
};

const WRAPPER_KEYS = ["recipe", "data", "result", "output"] as const;
const INGREDIENT_KEYS = ["ingredients", "ingredient_list", "ingredientLines", "items"] as const;
const STEP_KEYS = ["steps", "instructions", "directions", "method", "procedure"] as const;
const FRACTION_MAP: Record<string, string> = {
  "¼": "1/4",
  "½": "1/2",
  "¾": "3/4",
  "⅐": "1/7",
  "⅑": "1/9",
  "⅒": "1/10",
  "⅓": "1/3",
  "⅔": "2/3",
  "⅕": "1/5",
  "⅖": "2/5",
  "⅗": "3/5",
  "⅘": "4/5",
  "⅙": "1/6",
  "⅚": "5/6",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
};
const JUNK_PREP = new Set(["none", "n/a", "-", "null", "na"]);

function unwrapRecipePayload(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  let current = value as Record<string, unknown>;
  for (let depth = 0; depth < 3; depth += 1) {
    if (INGREDIENT_KEYS.some((key) => Array.isArray(current[key])) || STEP_KEYS.some((key) => Array.isArray(current[key]))) {
      return current;
    }

    const nextKey = WRAPPER_KEYS.find((key) => current[key] && typeof current[key] === "object" && !Array.isArray(current[key]));
    if (!nextKey) {
      return current;
    }
    current = current[nextKey] as Record<string, unknown>;
  }

  return current;
}

function getArrayByKeys(raw: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    if (Array.isArray(raw[key])) {
      return raw[key] as unknown[];
    }
  }
  return [];
}

function splitTextList(value: string): string[] {
  return value
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

function getStringByKeys(raw: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    if (typeof raw[key] === "string" && raw[key]!.trim().length > 0) {
      return raw[key] as string;
    }
  }
  return null;
}

function parseFractionString(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const ascii = trimmed.replace(/[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (match) => FRACTION_MAP[match] ?? match);
  if (/^\d+(?:\.\d+)?$/.test(ascii)) {
    return Number(ascii);
  }
  const mixedMatch = ascii.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const [, whole, num, den] = mixedMatch;
    return Number(whole) + Number(num) / Number(den);
  }
  const fractionMatch = ascii.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const [, num, den] = fractionMatch;
    return Number(den) === 0 ? null : Number(num) / Number(den);
  }
  return null;
}

function coerceQuantity(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    return parseFractionString(value);
  }
  return null;
}

function normalizeIngredientItem(item: unknown): { name: string } | null {
  if (typeof item === "string") {
    return item.trim() ? { name: item.trim() } : null;
  }
  if (!item || typeof item !== "object") {
    return null;
  }

  const ingredient = item as Record<string, unknown>;
  const baseNameCandidate = [
    ingredient.name,
    ingredient.ingredient,
    ingredient.item,
    ingredient.ingredient_name,
    ingredient.line,
    ingredient.description,
  ].find((value) => typeof value === "string" && value.trim().length > 0);

  const baseName = typeof baseNameCandidate === "string" ? baseNameCandidate.trim() : "";
  if (!baseName) {
    return null;
  }

  const rawUnitCandidate = [ingredient.unit, ingredient.units, ingredient.measure].find((value) => typeof value === "string");
  const rawUnit = typeof rawUnitCandidate === "string" ? rawUnitCandidate.trim().toLowerCase() : null;
  const unit = rawUnit && rawUnit !== "count" && rawUnit !== "piece" && rawUnit !== "pieces" ? rawUnitCandidate as string : null;
  const rawPrepCandidate = [ingredient.prep, ingredient.preparation, ingredient.note].find((value) => typeof value === "string");
  const rawPrep = typeof rawPrepCandidate === "string" ? rawPrepCandidate.trim() : null;
  const prep = rawPrep && !JUNK_PREP.has(rawPrep.toLowerCase()) ? rawPrep : null;

  return {
    name:
      formatIngredientLine({
        name: baseName,
        quantity: coerceQuantity(ingredient.quantity ?? ingredient.amount ?? ingredient.qty),
        unit: unit ? unit.trim() : null,
        prep,
      }) || baseName,
  };
}

function normalizeStepItem(item: unknown): { text: string } | null {
  if (typeof item === "string") {
    return item.trim() ? { text: item.trim() } : null;
  }
  if (!item || typeof item !== "object") {
    return null;
  }

  const raw = item as Record<string, unknown>;
  const textCandidate = [raw.text, raw.step, raw.instruction, raw.direction, raw.description].find(
    (value) => typeof value === "string" && value.trim().length > 0
  );
  return typeof textCandidate === "string" ? { text: textCandidate.trim() } : null;
}

export function normalizeGeneratedRecipePayload(value: unknown, fallbackTitle: string): RecipeNormalizationResult {
  const failedLog: NormalizationLog = {
    raw_top_level_keys: [],
    path_taken: "failed",
    missing_fields: [],
    repaired_fields: [],
  };

  if (!value || typeof value !== "object") {
    return { recipe: null, reason: "Recipe payload was not an object.", normalization_log: failedLog };
  }

  const topLevelKeys = Object.keys(value as Record<string, unknown>);
  const isTopLevelDirect =
    INGREDIENT_KEYS.some((k) => Array.isArray((value as Record<string, unknown>)[k])) ||
    STEP_KEYS.some((k) => Array.isArray((value as Record<string, unknown>)[k]));
  const pathTaken: NormalizationLog["path_taken"] = isTopLevelDirect ? "direct" : "unwrapped";

  const raw = unwrapRecipePayload(value);
  if (!raw) {
    return {
      recipe: null,
      reason: "Recipe payload could not be unwrapped.",
      normalization_log: { ...failedLog, raw_top_level_keys: topLevelKeys, path_taken: "failed" },
    };
  }

  const rawIngredients = getArrayByKeys(raw, INGREDIENT_KEYS);
  const rawSteps = getArrayByKeys(raw, STEP_KEYS);
  const ingredientBlock = getStringByKeys(raw, INGREDIENT_KEYS);
  const stepBlock = getStringByKeys(raw, STEP_KEYS);

  const repairedFields: string[] = [];
  const ingredientSource = rawIngredients.length > 0 ? rawIngredients : ingredientBlock ? splitTextList(ingredientBlock) : [];
  if (rawIngredients.length === 0 && ingredientBlock) repairedFields.push("ingredients_from_text");
  const stepSource = rawSteps.length > 0 ? rawSteps : stepBlock ? splitTextList(stepBlock) : [];
  if (rawSteps.length === 0 && stepBlock) repairedFields.push("steps_from_text");
  if (typeof raw.title !== "string" || !raw.title.trim()) repairedFields.push("title_from_fallback");

  const ingredients = ingredientSource
    .map(normalizeIngredientItem)
    .filter((item): item is { name: string } => item !== null);
  const steps = stepSource
    .map(normalizeStepItem)
    .filter((item): item is { text: string } => item !== null);

  const missingFields: string[] = [];
  if (ingredients.length === 0) missingFields.push("ingredients");
  if (steps.length === 0) missingFields.push("steps");

  const log: NormalizationLog = {
    raw_top_level_keys: topLevelKeys,
    path_taken: pathTaken,
    missing_fields: missingFields,
    repaired_fields: repairedFields,
  };

  if (ingredients.length === 0 || steps.length === 0) {
    const missingParts = missingFields.join(" and ");
    return { recipe: null, reason: `Recipe JSON was missing recognizable ${missingParts}.`, normalization_log: log };
  }

  const title = typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : fallbackTitle;
  const chefTips = Array.isArray(raw.chefTips)
    ? raw.chefTips
        .filter((tip): tip is string => typeof tip === "string" && tip.trim().length > 0)
        .map((tip) => tip.trim())
        .slice(0, 3)
    : [];

  return {
    recipe: {
      title,
      description: typeof raw.description === "string" ? raw.description.trim() || null : null,
      servings: typeof raw.servings === "number" ? Math.round(raw.servings) : 4,
      prep_time_min: typeof raw.prep_time_min === "number" ? Math.round(raw.prep_time_min) : 15,
      cook_time_min: typeof raw.cook_time_min === "number" ? Math.round(raw.cook_time_min) : 30,
      difficulty: typeof raw.difficulty === "string" && raw.difficulty.trim()
        ? raw.difficulty.trim().charAt(0).toUpperCase() + raw.difficulty.trim().slice(1).toLowerCase()
        : "Easy",
      ingredients,
      steps,
      chefTips,
    },
    reason: null,
    normalization_log: log,
  };
}
