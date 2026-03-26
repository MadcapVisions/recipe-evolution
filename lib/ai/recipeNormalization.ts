import { formatIngredientLine } from "../recipes/recipeDraft";

export type HomeGeneratedRecipe = {
  title: string;
  description: string | null;
  servings: number | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  difficulty: string | null;
  ingredients: Array<{ name: string }>;
  /** methodTag is AI pipeline only — stripped before DB write in assembleRecipeDraftFromSections. */
  steps: Array<{ text: string; methodTag?: string | null }>;
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
const INGREDIENT_KEYS = [
  "ingredients",
  "ingredient_list",
  "ingredientLines",
  "ingredient_lines",
  "ingredients_text",
  "ingredient_text",
  "items",
] as const;
const STEP_KEYS = [
  "steps",
  "instructions",
  "instruction_text",
  "instructions_text",
  "directions",
  "direction_text",
  "method",
  "method_text",
  "procedure",
  "prep_steps",
] as const;
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
const JSON_STRING_WRAPPER_KEYS = ["text", "content", "output_text", "response", "result"] as const;
const JSON_TEXT_PART_KEYS = ["text", "output_text", "content"] as const;

function normalizeLookupKey(value: string) {
  return value.toLowerCase().replace(/[\s_-]/g, "");
}

function getMatchingValue(raw: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    if (key in raw) {
      return raw[key];
    }
  }

  const normalizedKeys = new Set(keys.map(normalizeLookupKey));
  for (const [candidateKey, candidateValue] of Object.entries(raw)) {
    if (normalizedKeys.has(normalizeLookupKey(candidateKey))) {
      return candidateValue;
    }
  }

  return undefined;
}

function unwrapRecipePayload(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  let current = value as Record<string, unknown>;
  for (let depth = 0; depth < 3; depth += 1) {
    const ingredientValue = getMatchingValue(current, INGREDIENT_KEYS);
    const stepValue = getMatchingValue(current, STEP_KEYS);
    if (
      Array.isArray(ingredientValue) ||
      Array.isArray(stepValue) ||
      typeof ingredientValue === "string" ||
      typeof stepValue === "string"
    ) {
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

function tryParseEmbeddedJsonString(value: string): Record<string, unknown> | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function unwrapEmbeddedJsonString(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = unwrapEmbeddedJsonString(item);
      if (parsed) {
        return parsed;
      }
    }
    return null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  for (const key of JSON_STRING_WRAPPER_KEYS) {
    const candidate = raw[key];
    if (typeof candidate === "string") {
      const parsed = tryParseEmbeddedJsonString(candidate);
      if (parsed) {
        return parsed;
      }
    }

    if (candidate && typeof candidate === "object") {
      const parsed = unwrapEmbeddedJsonString(candidate);
      if (parsed) {
        return parsed;
      }
    }
  }

  for (const key of JSON_TEXT_PART_KEYS) {
    const candidate = raw[key];
    if (!Array.isArray(candidate)) {
      continue;
    }
    const parsed = unwrapEmbeddedJsonString(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function getArrayByKeys(raw: Record<string, unknown>, keys: readonly string[]) {
  const value = getMatchingValue(raw, keys);
  if (Array.isArray(value)) {
    return value as unknown[];
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
  const value = getMatchingValue(raw, keys);
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  return null;
}

function getNumberByKeys(raw: Record<string, unknown>, keys: readonly string[]) {
  const value = getMatchingValue(raw, keys);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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

  const embeddedJson = unwrapEmbeddedJsonString(value);
  const effectiveValue = embeddedJson ?? value;
  const topLevelKeys = Object.keys(value as Record<string, unknown>);
  const isTopLevelDirect =
    Array.isArray(getMatchingValue(effectiveValue as Record<string, unknown>, INGREDIENT_KEYS)) ||
    Array.isArray(getMatchingValue(effectiveValue as Record<string, unknown>, STEP_KEYS)) ||
    typeof getMatchingValue(effectiveValue as Record<string, unknown>, INGREDIENT_KEYS) === "string" ||
    typeof getMatchingValue(effectiveValue as Record<string, unknown>, STEP_KEYS) === "string";
  const pathTaken: NormalizationLog["path_taken"] = isTopLevelDirect ? "direct" : "unwrapped";

  const raw = unwrapRecipePayload(effectiveValue);
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
  const titleValue = getStringByKeys(raw, ["title"]);
  if (!titleValue) repairedFields.push("title_from_fallback");

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
    repaired_fields: embeddedJson ? [...repairedFields, "embedded_json_unwrapped"] : repairedFields,
  };

  if (ingredients.length === 0 || steps.length === 0) {
    const missingParts = missingFields.join(" and ");
    return { recipe: null, reason: `Recipe JSON was missing recognizable ${missingParts}.`, normalization_log: log };
  }

  const title = titleValue?.trim() || fallbackTitle;
  const chefTipsValue = getMatchingValue(raw, ["chefTips", "chef_tips"]);
  const chefTips = Array.isArray(chefTipsValue)
    ? chefTipsValue
        .filter((tip): tip is string => typeof tip === "string" && tip.trim().length > 0)
        .map((tip) => tip.trim())
        .slice(0, 3)
    : [];
  const descriptionValue = getStringByKeys(raw, ["description"]);
  const difficultyValue = getStringByKeys(raw, ["difficulty"]);
  const servingsValue = getNumberByKeys(raw, ["servings"]);
  const prepTimeValue = getNumberByKeys(raw, ["prep_time_min", "prepTimeMin"]);
  const cookTimeValue = getNumberByKeys(raw, ["cook_time_min", "cookTimeMin"]);

  return {
    recipe: {
      title,
      description: descriptionValue?.trim() || null,
      servings: servingsValue != null ? Math.round(servingsValue) : 4,
      prep_time_min: prepTimeValue != null ? Math.round(prepTimeValue) : 15,
      cook_time_min: cookTimeValue != null ? Math.round(cookTimeValue) : 30,
      difficulty: difficultyValue?.trim()
        ? difficultyValue.trim().charAt(0).toUpperCase() + difficultyValue.trim().slice(1).toLowerCase()
        : "Easy",
      ingredients,
      steps,
      chefTips,
    },
    reason: null,
    normalization_log: log,
  };
}
