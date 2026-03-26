// Score-based taste model. Updated from explicit recipe feedback.
// Scores range -1.0 (strong dislike) to +1.0 (strong preference).
// Confidence tracks how much evidence backs a score (0 to 1).

export type TasteScore = {
  score: number;       // -1.0 to +1.0
  confidence: number;  // 0 to 1
  evidenceCount: number;
  lastUpdatedAt: string;
};

export type TasteModel = {
  cuisines: Record<string, TasteScore>;
  proteins: Record<string, TasteScore>;
  flavors: Record<string, TasteScore>;
  dishFamilies: Record<string, TasteScore>;
  dislikedIngredients: Record<string, TasteScore>;
  spiceTolerance: TasteScore | null;
  richnessPreference: TasteScore | null;
};

export type FeedbackSignal = "thumbs_up" | "thumbs_down";
export type FeedbackReason =
  | "too_heavy"
  | "too_spicy"
  | "dont_like_ingredients"
  | "not_what_i_wanted"
  | null;

export type RecipeFeatures = {
  cuisines: string[];
  proteins: string[];
  flavors: string[];
  dishFamily: string | null;
  ingredients: string[];
};

// ── keyword lists (kept in sync with userTasteProfile.ts) ────────────────────

const CUISINE_KEYWORDS = [
  "italian", "mexican", "asian", "mediterranean", "comfort", "healthy",
  "seafood", "dessert", "indian", "thai", "greek", "french", "chinese",
  "japanese", "middle eastern", "korean",
];

const PROTEIN_KEYWORDS = [
  "chicken", "beef", "pork", "fish", "salmon", "shrimp", "tofu",
  "beans", "eggs", "turkey", "chickpeas", "lamb", "tuna", "lentils",
];

const FLAVOR_KEYWORDS = [
  "spicy", "bright", "creamy", "fresh", "herby", "smoky", "savory",
  "crispy", "lemon", "lime", "garlic", "sweet", "tangy", "rich", "light",
];

// ── feature extraction ────────────────────────────────────────────────────────

function matchKeywords(textPool: string[], keywords: string[]): string[] {
  const haystack = textPool.join(" ").toLowerCase();
  return keywords.filter((kw) => haystack.includes(kw));
}

export function extractRecipeFeatures(opts: {
  title: string;
  tags: string[];
  ingredients: string[];
  dishFamily: string | null;
}): RecipeFeatures {
  const titleAndTags = [opts.title, ...opts.tags];
  return {
    cuisines: matchKeywords(titleAndTags, CUISINE_KEYWORDS),
    proteins: matchKeywords([opts.title, ...opts.ingredients], PROTEIN_KEYWORDS),
    flavors: matchKeywords(titleAndTags, FLAVOR_KEYWORDS),
    dishFamily: opts.dishFamily ?? null,
    ingredients: opts.ingredients,
  };
}

// ── score update helpers ──────────────────────────────────────────────────────

const RETENTION = 0.9;
const CONFIDENCE_GAIN_EXPLICIT = 0.1;

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function emptyScore(): TasteScore {
  return { score: 0, confidence: 0, evidenceCount: 0, lastUpdatedAt: new Date().toISOString() };
}

function updateScore(
  current: TasteScore | null | undefined,
  weight: number,
  signalStrength: number
): TasteScore {
  const prev = current ?? emptyScore();
  return {
    score: clamp(prev.score * RETENTION + weight * signalStrength, -1, 1),
    confidence: clamp(prev.confidence + CONFIDENCE_GAIN_EXPLICIT, 0, 1),
    evidenceCount: prev.evidenceCount + 1,
    lastUpdatedAt: new Date().toISOString(),
  };
}

function updateMany(
  dict: Record<string, TasteScore>,
  features: string[],
  weight: number,
  strength: number
): Record<string, TasteScore> {
  if (features.length === 0) return dict;
  const next = { ...dict };
  for (const f of features) {
    next[f] = updateScore(dict[f], weight, strength);
  }
  return next;
}

// ── decay ─────────────────────────────────────────────────────────────────────

/** Apply monthly time decay to stale scores. Safe to call on every read. */
export function applyDecay(model: TasteModel, daysSinceUpdate: number): TasteModel {
  if (daysSinceUpdate < 30) return model;

  const periods = Math.floor(daysSinceUpdate / 30);
  // Normal preferences decay faster than dislikes (dislikes are stickier)
  const scoreR = Math.pow(0.92, periods);
  const confR = Math.pow(0.96, periods);
  const dislikeScoreR = Math.pow(0.97, periods);
  const dislikeConfR = Math.pow(0.98, periods);

  function decayOne(s: TasteScore, sR: number, cR: number): TasteScore {
    return { ...s, score: s.score * sR, confidence: s.confidence * cR };
  }

  function decayDict(
    dict: Record<string, TasteScore>,
    sR: number,
    cR: number
  ): Record<string, TasteScore> {
    const out: Record<string, TasteScore> = {};
    for (const [k, v] of Object.entries(dict)) out[k] = decayOne(v, sR, cR);
    return out;
  }

  return {
    cuisines: decayDict(model.cuisines, scoreR, confR),
    proteins: decayDict(model.proteins, scoreR, confR),
    flavors: decayDict(model.flavors, scoreR, confR),
    dishFamilies: decayDict(model.dishFamilies, scoreR, confR),
    dislikedIngredients: decayDict(model.dislikedIngredients, dislikeScoreR, dislikeConfR),
    spiceTolerance: model.spiceTolerance ? decayOne(model.spiceTolerance, scoreR, confR) : null,
    richnessPreference: model.richnessPreference
      ? decayOne(model.richnessPreference, scoreR, confR)
      : null,
  };
}

// ── confidence summary ────────────────────────────────────────────────────────

export function getOverallConfidenceLevel(model: TasteModel | null): "low" | "medium" | "high" {
  if (!model) return "low";

  const all = [
    ...Object.values(model.cuisines),
    ...Object.values(model.proteins),
    ...Object.values(model.flavors),
    ...Object.values(model.dishFamilies),
  ];

  if (all.length === 0) return "low";

  const totalEvidence = all.reduce((sum, s) => sum + s.evidenceCount, 0);
  const avgConfidence = all.reduce((sum, s) => sum + s.confidence, 0) / all.length;

  if (totalEvidence >= 5 && avgConfidence >= 0.45) return "high";
  if (totalEvidence >= 2 && avgConfidence >= 0.2) return "medium";
  return "low";
}

// ── why-fits explanation builder ──────────────────────────────────────────────

const MIN_SCORE = 0.35;
const MIN_CONF = 0.3;

function topByScore(
  dict: Record<string, TasteScore>,
  minScore: number,
  minConf: number
): string[] {
  return Object.entries(dict)
    .filter(([, s]) => s.score >= minScore && s.confidence >= minConf)
    .sort(([, a], [, b]) => b.score - a.score)
    .map(([k]) => k);
}

function topNegativeByScore(
  dict: Record<string, TasteScore>,
  maxScore: number,
  minConf: number
): string[] {
  return Object.entries(dict)
    .filter(([, s]) => s.score <= maxScore && s.confidence >= minConf)
    .sort(([, a], [, b]) => a.score - b.score)
    .map(([k]) => k);
}

/**
 * Generate up to `maxLines` (default 3) evidence-based "Why this fits you" lines.
 * Returns an empty array when there is not enough confidence to say anything meaningful.
 * One line per dimension — no repetition of the same angle.
 */
export function buildWhyFitsLines(
  model: TasteModel,
  features: RecipeFeatures,
  maxLines = 3
): string[] {
  const lines: string[] = [];
  const usedDimensions = new Set<string>();

  function add(dimension: string, line: string) {
    if (lines.length < maxLines && !usedDimensions.has(dimension)) {
      lines.push(line);
      usedDimensions.add(dimension);
    }
  }

  // ── Priority 1: hard avoidances respected ──────────────────────────────────

  // Spice tolerance — if user dislikes spice and recipe is not spicy
  const spice = model.spiceTolerance;
  if (spice && spice.score <= -MIN_SCORE && spice.confidence >= MIN_CONF) {
    if (!features.flavors.includes("spicy")) {
      add("spice", "Keeps spice low, which fits your current preferences");
    }
  }

  // Disliked ingredients avoided
  const strongDislikes = topNegativeByScore(model.dislikedIngredients, -0.5, 0.4);
  const recipeIngredientSet = new Set(features.ingredients.map((i) => i.toLowerCase()));
  const avoided = strongDislikes.filter((d) => !recipeIngredientSet.has(d)).slice(0, 2);
  if (avoided.length > 0) {
    const label = avoided.length === 1 ? avoided[0] : `${avoided[0]} and ${avoided[1]}`;
    add("dislikes", `Leaves out ${label}, which you tend to avoid`);
  }

  // ── Priority 2: strong positive matches ────────────────────────────────────

  // Cuisine
  const matchedCuisines = features.cuisines.filter(
    (c) => topByScore(model.cuisines, MIN_SCORE, MIN_CONF).includes(c)
  );
  if (matchedCuisines.length > 0) {
    const best = matchedCuisines[0];
    add("cuisine", `Matches your preference for ${best}-style meals`);
  }

  // Protein
  const matchedProteins = features.proteins.filter(
    (p) => topByScore(model.proteins, MIN_SCORE, MIN_CONF).includes(p)
  );
  if (matchedProteins.length > 0) {
    add("protein", `Uses ${matchedProteins[0]}, an ingredient you often choose`);
  }

  // Dish family
  if (
    features.dishFamily &&
    (model.dishFamilies[features.dishFamily]?.score ?? 0) >= MIN_SCORE &&
    (model.dishFamilies[features.dishFamily]?.confidence ?? 0) >= MIN_CONF
  ) {
    const family = features.dishFamily.replace(/_/g, " ");
    add("dish_family", `A ${family} dish style you consistently enjoy`);
  }

  // Flavor
  const matchedFlavors = features.flavors.filter(
    (f) => topByScore(model.flavors, MIN_SCORE, MIN_CONF).includes(f)
  );
  if (matchedFlavors.length > 0) {
    add("flavor", `Leans ${matchedFlavors[0]}, a flavor style you tend to enjoy`);
  }

  // ── Priority 3: style matches ───────────────────────────────────────────────

  const richness = model.richnessPreference;
  if (richness && richness.confidence >= MIN_CONF) {
    const hasRich = features.flavors.some((f) => ["creamy", "rich"].includes(f));
    if (richness.score <= -MIN_SCORE && !hasRich) {
      add("richness", "Stays on the lighter side, which fits your current preferences");
    } else if (richness.score >= MIN_SCORE && hasRich) {
      add("richness", "Leans toward the richer style you tend to gravitate toward");
    }
  }

  return lines;
}

// ── main feedback application ─────────────────────────────────────────────────

export function applyFeedback(
  model: TasteModel | null,
  signal: FeedbackSignal,
  reason: FeedbackReason,
  features: RecipeFeatures
): TasteModel {
  const m: TasteModel = model ?? {
    cuisines: {},
    proteins: {},
    flavors: {},
    dishFamilies: {},
    dislikedIngredients: {},
    spiceTolerance: null,
    richnessPreference: null,
  };

  if (signal === "thumbs_up") {
    return {
      ...m,
      cuisines: updateMany(m.cuisines, features.cuisines, +0.7, 0.8),
      proteins: updateMany(m.proteins, features.proteins, +0.7, 0.6),
      flavors: updateMany(m.flavors, features.flavors, +0.7, 0.5),
      dishFamilies: features.dishFamily
        ? updateMany(m.dishFamilies, [features.dishFamily], +0.7, 0.9)
        : m.dishFamilies,
    };
  }

  // thumbs_down — base signal
  let next: TasteModel = {
    ...m,
    cuisines: updateMany(m.cuisines, features.cuisines, -0.5, 0.5),
    dishFamilies: features.dishFamily
      ? updateMany(m.dishFamilies, [features.dishFamily], -0.5, 0.6)
      : m.dishFamilies,
  };

  // reason-specific overrides
  if (reason === "too_spicy") {
    next = {
      ...next,
      spiceTolerance: updateScore(next.spiceTolerance, -0.8, 1.0),
      flavors: updateMany(next.flavors, ["spicy"], -0.8, 1.0),
    };
  } else if (reason === "too_heavy") {
    next = {
      ...next,
      richnessPreference: updateScore(next.richnessPreference, -0.7, 1.0),
      flavors: updateMany(
        next.flavors,
        features.flavors.filter((f) => ["creamy", "rich"].includes(f)),
        -0.7,
        0.8
      ),
    };
  } else if (reason === "dont_like_ingredients") {
    const topIngredients = features.ingredients.slice(0, 6);
    next = {
      ...next,
      proteins: updateMany(next.proteins, features.proteins, -0.6, 0.7),
      dislikedIngredients: updateMany(next.dislikedIngredients, topIngredients, -0.5, 0.6),
    };
  } else if (reason === "not_what_i_wanted") {
    // dish family already downgraded above; don't penalise ingredients
    next = {
      ...next,
      dishFamilies: features.dishFamily
        ? updateMany(next.dishFamilies, [features.dishFamily], -0.5, 0.9)
        : next.dishFamilies,
    };
  } else {
    // no specific reason — light penalty on flavors
    next = {
      ...next,
      flavors: updateMany(next.flavors, features.flavors, -0.4, 0.4),
    };
  }

  return next;
}
