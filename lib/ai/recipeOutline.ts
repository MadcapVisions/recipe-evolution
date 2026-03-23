import type { CookingBrief } from "./contracts/cookingBrief";
import { createEmptyRecipeOutline, type RecipeOutline, type RecipeOutlineGroup } from "./contracts/recipeOutline";
import type { RecipePlan } from "./contracts/recipePlan";

export type RecipeOutlineNormalizationLog = {
  raw_top_level_keys: string[];
  path_taken: "direct" | "unwrapped" | "failed";
  missing_fields: string[];
  repaired_fields: string[];
};

export type RecipeOutlineNormalizationResult = {
  outline: RecipeOutline | null;
  reason: string | null;
  normalization_log: RecipeOutlineNormalizationLog;
};

export type RecipeOutlineValidationResult = {
  passes: boolean;
  reasons: string[];
  checks: {
    title_present: boolean;
    ingredient_groups_present: boolean;
    step_outline_present: boolean;
    dish_family_aligned: boolean;
    anchor_aligned: boolean;
  };
};

const WRAPPER_KEYS = ["outline", "data", "result", "output"] as const;
const GROUP_KEYS = ["ingredient_groups", "ingredientGroups", "components", "core_components", "key_ingredients"] as const;
const STEP_KEYS = ["step_outline", "stepOutline", "technique_outline", "steps", "directions", "method"] as const;
const TIP_KEYS = ["chef_tip_topics", "chefTips", "tip_topics", "notes"] as const;
const COMMON_DESCRIPTOR_WORDS = new Set([
  "braised",
  "roasted",
  "grilled",
  "baked",
  "fried",
  "crispy",
  "smoky",
  "creamy",
  "spicy",
  "herby",
  "savory",
  "inspired",
  "style",
]);

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}

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

function unwrapOutlinePayload(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  let current = value as Record<string, unknown>;
  for (let depth = 0; depth < 3; depth += 1) {
    const groups = getMatchingValue(current, GROUP_KEYS);
    const steps = getMatchingValue(current, STEP_KEYS);
    if (Array.isArray(groups) || Array.isArray(steps)) {
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

function getString(raw: Record<string, unknown>, keys: readonly string[]) {
  const value = getMatchingValue(raw, keys);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getStringArray(raw: Record<string, unknown>, keys: readonly string[]) {
  const value = getMatchingValue(raw, keys);
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function normalizeIngredientGroups(value: unknown): RecipeOutlineGroup[] {
  if (Array.isArray(value)) {
    const objectGroups = value
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return null;
        }
        const raw = item as Record<string, unknown>;
        const name = getString(raw, ["name", "group", "title"]) ?? "Main";
        const items = unique(
          (Array.isArray(raw.items) ? raw.items : Array.isArray(raw.ingredients) ? raw.ingredients : [])
            .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
            .filter((entry) => entry.length > 0)
        );
        if (items.length === 0) {
          return null;
        }
        return { name, items };
      })
      .filter((group): group is RecipeOutlineGroup => Boolean(group));

    if (objectGroups.length > 0) {
      return objectGroups;
    }

    const stringItems = unique(value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean));
    if (stringItems.length > 0) {
      return [{ name: "Main components", items: stringItems }];
    }
  }

  return [];
}

function normalizeStepOutline(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return unique(
    value
      .map((item) => {
        if (typeof item === "string") {
          return item.trim();
        }
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const raw = item as Record<string, unknown>;
          const text = [raw.text, raw.step, raw.instruction, raw.direction].find(
            (entry) => typeof entry === "string" && entry.trim().length > 0
          );
          return typeof text === "string" ? text.trim() : "";
        }
        return "";
      })
      .filter(Boolean)
  );
}

export function normalizeRecipeOutlinePayload(value: unknown, fallbackTitle: string): RecipeOutlineNormalizationResult {
  const failedLog: RecipeOutlineNormalizationLog = {
    raw_top_level_keys: [],
    path_taken: "failed",
    missing_fields: [],
    repaired_fields: [],
  };

  if (!value || typeof value !== "object") {
    return { outline: null, reason: "Recipe outline payload was not an object.", normalization_log: failedLog };
  }

  const topLevelKeys = Object.keys(value as Record<string, unknown>);
  const raw = unwrapOutlinePayload(value);
  if (!raw) {
    return {
      outline: null,
      reason: "Recipe outline payload could not be unwrapped.",
      normalization_log: { ...failedLog, raw_top_level_keys: topLevelKeys },
    };
  }

  const groups = normalizeIngredientGroups(getMatchingValue(raw, GROUP_KEYS));
  const steps = normalizeStepOutline(getMatchingValue(raw, STEP_KEYS));
  const repairedFields: string[] = [];
  const missingFields: string[] = [];

  const title = getString(raw, ["title", "name"]) ?? fallbackTitle.trim();
  if (!getString(raw, ["title", "name"]) && fallbackTitle.trim().length > 0) {
    repairedFields.push("title_from_fallback");
  }

  if (!title) {
    missingFields.push("title");
  }
  if (groups.length === 0) {
    missingFields.push("ingredient_groups");
  }
  if (steps.length === 0) {
    missingFields.push("step_outline");
  }

  if (missingFields.length > 0) {
    return {
      outline: null,
      reason: `Recipe outline was missing ${missingFields.join(" and ")}.`,
      normalization_log: {
        raw_top_level_keys: topLevelKeys,
        path_taken: raw === value ? "direct" : "unwrapped",
        missing_fields: missingFields,
        repaired_fields: repairedFields,
      },
    };
  }

  return {
    outline: {
      title,
      summary: getString(raw, ["summary", "description"]),
      dish_family: getString(raw, ["dish_family", "dishFamily", "family"]),
      primary_ingredient: getString(raw, ["primary_ingredient", "primaryIngredient", "anchor", "centerpiece"]),
      ingredient_groups: groups,
      step_outline: steps,
      chef_tip_topics: getStringArray(raw, TIP_KEYS).slice(0, 4),
    },
    reason: null,
    normalization_log: {
      raw_top_level_keys: topLevelKeys,
      path_taken: raw === value ? "direct" : "unwrapped",
      missing_fields: [],
      repaired_fields: repairedFields,
    },
  };
}

function normalizeIngredientText(value: string) {
  return value.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function validateRecipeOutline(input: {
  outline: RecipeOutline;
  brief?: CookingBrief | null;
  recipePlan?: RecipePlan | null;
}): RecipeOutlineValidationResult {
  const reasons: string[] = [];
  const { outline, brief, recipePlan } = input;
  const outlineIngredientText = outline.ingredient_groups.flatMap((group) => group.items).join(" ").toLowerCase();
  const expectedFamily = brief?.dish.dish_family?.trim().toLowerCase() || recipePlan?.dish_family?.trim().toLowerCase() || null;
  const actualFamily = outline.dish_family?.trim().toLowerCase() || null;
  const anchor = brief?.ingredients.centerpiece?.trim().toLowerCase() || null;
  const anchorAligned = !anchor || normalizeIngredientText(outlineIngredientText).includes(normalizeIngredientText(anchor));

  const checks = {
    title_present: outline.title.trim().length > 0,
    ingredient_groups_present: outline.ingredient_groups.some((group) => group.items.length > 0),
    step_outline_present: outline.step_outline.length > 0,
    dish_family_aligned: !expectedFamily || !actualFamily || actualFamily === expectedFamily,
    anchor_aligned: anchorAligned,
  };

  if (!checks.title_present) {
    reasons.push("Recipe outline title was missing.");
  }
  if (!checks.ingredient_groups_present) {
    reasons.push("Recipe outline was missing ingredient groups.");
  }
  if (!checks.step_outline_present) {
    reasons.push("Recipe outline was missing step outline items.");
  }
  if (!checks.dish_family_aligned) {
    reasons.push(`Recipe outline drifted from the requested dish family (${expectedFamily}).`);
  }
  if (!checks.anchor_aligned) {
    reasons.push("Recipe outline lost the requested anchor ingredient.");
  }

  return {
    passes: reasons.length === 0,
    reasons,
    checks,
  };
}

function buildSummaryFromPlan(brief?: CookingBrief | null, recipePlan?: RecipePlan | null) {
  const parts = unique([
    ...(recipePlan?.style_tags ?? []).slice(0, 3),
    ...(recipePlan?.expected_flavor ?? []).slice(0, 2),
    ...(brief?.style.texture_tags ?? []).slice(0, 2),
  ]);
  if (parts.length === 0) {
    return null;
  }
  return `Home-cook friendly ${parts.join(", ")} direction.`;
}

function normalizePrimaryIngredientCandidate(candidate: string, brief?: CookingBrief | null, recipePlan?: RecipePlan | null) {
  const trimmed = candidate.trim();
  if (!trimmed) {
    return "";
  }

  const descriptorWords = new Set([
    ...COMMON_DESCRIPTOR_WORDS,
    ...(brief?.style.tags ?? []).flatMap((item) => item.toLowerCase().split(/\s+/)),
    ...(brief?.style.format_tags ?? []).flatMap((item) => item.toLowerCase().split(/\s+/)),
    ...(recipePlan?.style_tags ?? []).flatMap((item) => item.toLowerCase().split(/\s+/)),
    ...(brief?.dish.dish_family ? [brief.dish.dish_family.toLowerCase()] : []),
    ...(recipePlan?.dish_family ? [recipePlan.dish_family.toLowerCase()] : []),
  ]);
  const normalized = trimmed
    .split(/\s+/)
    .filter((word, index) => !(index === 0 && descriptorWords.has(word.toLowerCase())))
    .join(" ")
    .trim();

  return normalized || trimmed;
}

export function buildFallbackRecipeOutline(input: {
  ideaTitle: string;
  brief?: CookingBrief | null;
  recipePlan?: RecipePlan | null;
}): RecipeOutline {
  const outline = createEmptyRecipeOutline();
  const keyIngredients = unique([
    ...(input.recipePlan?.key_ingredients ?? []),
    ...(input.recipePlan?.core_components ?? []),
    ...(input.brief?.ingredients.required ?? []),
    ...(input.brief?.ingredients.preferred ?? []).slice(0, 2),
    ...(input.brief?.ingredients.centerpiece ? [input.brief.ingredients.centerpiece] : []),
  ]);
  const supportingIngredients = unique(
    [
      ...(input.recipePlan?.style_tags ?? []).slice(0, 3),
      ...(input.brief?.directives.must_have ?? []).slice(0, 3),
    ].filter((item) => !/\bbright|savory|spicy|herby|traditional\b/i.test(item))
  );

  outline.title =
    input.ideaTitle.trim() ||
    input.brief?.dish.normalized_name?.trim() ||
    input.recipePlan?.title_direction?.trim() ||
    "Chef recipe";
  outline.summary = buildSummaryFromPlan(input.brief, input.recipePlan);
  outline.dish_family = input.brief?.dish.dish_family ?? input.recipePlan?.dish_family ?? null;
  outline.primary_ingredient =
    unique(
      [
        input.brief?.ingredients.centerpiece ?? "",
        ...((input.brief?.ingredients.required ?? []).slice(0, 3)),
        ...((input.recipePlan?.key_ingredients ?? []).slice(0, 3)),
      ]
        .map((item) => normalizePrimaryIngredientCandidate(item, input.brief, input.recipePlan))
        .filter(Boolean)
    )[0] ?? null;
  outline.ingredient_groups = [
    {
      name: "Main components",
      items: keyIngredients.length > 0 ? keyIngredients : [outline.title],
    },
    ...(supportingIngredients.length > 0 ? [{ name: "Flavor direction", items: supportingIngredients }] : []),
  ];
  outline.step_outline = unique(
    (input.recipePlan?.technique_outline ?? []).length > 0
      ? input.recipePlan?.technique_outline ?? []
      : [
          "Build the main flavor base first.",
          "Cook the central component to the intended texture.",
          "Finish with balancing acid, herbs, or garnish before serving.",
        ]
  );
  outline.chef_tip_topics = unique([
    ...(input.recipePlan?.expected_texture ?? []).slice(0, 2),
    ...(input.recipePlan?.expected_flavor ?? []).slice(0, 2),
    ...(input.brief?.style.tags ?? []).slice(0, 2),
  ]).slice(0, 4);

  return outline;
}
