const PREP_TERMS = ["chopped", "diced", "minced", "sliced", "crushed", "grated", "peeled"];
const KNOWN_UNITS = new Set([
  "pinch",
  "pinches",
  "dash",
  "dashes",
  "tsp",
  "teaspoon",
  "teaspoons",
  "tbsp",
  "tablespoon",
  "tablespoons",
  "cup",
  "cups",
  "oz",
  "ounce",
  "ounces",
  "lb",
  "lbs",
  "pound",
  "pounds",
  "g",
  "kg",
  "ml",
  "l",
  "clove",
  "cloves",
  "can",
  "cans",
  "package",
  "packages",
]);

const UNICODE_FRACTIONS: Record<string, string> = {
  "¼": "1/4",
  "½": "1/2",
  "¾": "3/4",
  "⅐": "1/7",
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

export type IngredientEnrichment = {
  name: string;
  quantity: number | null;
  unit: string | null;
  prep: string | null;
};

export type StepEnrichment = {
  text: string;
  timer_seconds: number | null;
};

export type RecipeCanonicalEnrichment = {
  ingredient_details: IngredientEnrichment[];
  step_details: StepEnrichment[];
  preferred_units?: "metric" | "imperial" | null;
};

function parseFraction(value: string): number | null {
  const trimmed = normalizeQuantityText(value);
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes(" ")) {
    const parts = trimmed.split(/\s+/);
    if (parts.length === 2) {
      const whole = Number(parts[0]);
      const fraction = parseFraction(parts[1]);
      return Number.isFinite(whole) && fraction != null ? whole + fraction : null;
    }
  }

  if (trimmed.includes("/")) {
    const [numerator, denominator] = trimmed.split("/");
    const top = Number(numerator);
    const bottom = Number(denominator);
    if (Number.isFinite(top) && Number.isFinite(bottom) && bottom !== 0) {
      return top / bottom;
    }
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeQuantityText(value: string) {
  return value
    .trim()
    .replace(/[¼½¾⅐⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (match) => ` ${UNICODE_FRACTIONS[match] ?? match} `)
    .replace(/\s+/g, " ")
    .trim();
}

function parseQuantityToken(value: string): number | null {
  const normalized = normalizeQuantityText(value);
  if (!normalized) {
    return null;
  }

  const rangeMatch = normalized.match(/^(.+?)\s*(?:-|to)\s*(.+)$/i);
  if (rangeMatch) {
    const start = parseFraction(rangeMatch[1]);
    const end = parseFraction(rangeMatch[2]);
    if (start != null && end != null) {
      return Math.round((((start + end) / 2) * 100)) / 100;
    }
  }

  return parseFraction(normalized);
}

export function deriveIngredientDetails(name: string): IngredientEnrichment {
  const original = name.trim();
  const quantityMatch = original.match(
    /^((?:about|approx\.?|approximately)\s+)?(\d+(?:\.\d+)?(?:\/\d+)?(?:\s+\d+\/\d+)?|[\d¼½¾⅐⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]+(?:\s*(?:-|to)\s*[\d¼½¾⅐⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞/. ]+)?)\s+(.+)$/i
  );
  const compactQuantityMatch = quantityMatch
    ? null
    : original.match(
        /^((?:about|approx\.?|approximately)\s+)?(\d+(?:\.\d+)?(?:\/\d+)?(?:\s+\d+\/\d+)?|[\d¼½¾⅐⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]+)(pinch|pinches|dash|dashes|tsp|teaspoon|teaspoons|tbsp|tablespoon|tablespoons|cup|cups|oz|ounce|ounces|lb|lbs|pound|pounds|g|kg|ml|l|clove|cloves|can|cans|package|packages)\s+(.+)$/i
      );
  const quantity = quantityMatch
    ? parseQuantityToken(quantityMatch[2])
    : compactQuantityMatch
      ? parseQuantityToken(compactQuantityMatch[2])
      : null;
  let remainder = original;
  let unit: string | null = null;

  if (/\bto taste\b/i.test(original)) {
    return {
      name: original,
      quantity: null,
      unit: null,
      prep: null,
    };
  }

  if (quantityMatch) {
    remainder = quantityMatch[3].trim();
  } else if (compactQuantityMatch) {
    unit = compactQuantityMatch[3].toLowerCase();
    remainder = compactQuantityMatch[4].trim();
  }

  if (!unit) {
    const [firstToken, ...restTokens] = remainder.split(/\s+/);
    if (firstToken && KNOWN_UNITS.has(firstToken.toLowerCase())) {
      unit = firstToken.toLowerCase();
      remainder = restTokens.join(" ").trim();
    }
  }

  let prep: string | null = null;
  const lowered = remainder.toLowerCase();
  for (const term of PREP_TERMS) {
    if (new RegExp(`\\b${term}\\b`, "i").test(lowered)) {
      prep = term;
      break;
    }
  }

  return {
    name: original,
    quantity,
    unit,
    prep,
  };
}

export function deriveStepDetails(text: string): StepEnrichment {
  const trimmed = text.trim();
  const timerMatch = trimmed.match(/(\d+)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)/i);

  let timer_seconds: number | null = null;
  if (timerMatch) {
    const value = Number(timerMatch[1]);
    const unit = timerMatch[2].toLowerCase();
    if (Number.isFinite(value)) {
      if (unit.startsWith("hour") || unit.startsWith("hr")) {
        timer_seconds = value * 3600;
      } else if (unit.startsWith("min")) {
        timer_seconds = value * 60;
      } else {
        timer_seconds = value;
      }
    }
  }

  return {
    text: trimmed,
    timer_seconds,
  };
}

export function buildCanonicalEnrichment(input: {
  ingredientNames: string[];
  stepTexts: string[];
  preferredUnits?: "metric" | "imperial" | null;
}): RecipeCanonicalEnrichment {
  return {
    ingredient_details: input.ingredientNames.map(deriveIngredientDetails),
    step_details: input.stepTexts.map(deriveStepDetails),
    preferred_units: input.preferredUnits ?? null,
  };
}
