import type {
  ResolvedCookingIntent,
  ResolvedConstraint,
  PremiseTrust,
  IntentSource,
  ConstraintStrength,
  ConstraintSource,
} from "./intentTypes";
import {
  classifyDishFamily,
  type DishFamilyClassificationInput,
  type DishFamilyClassificationResult,
} from "./dishFamilyClassifier";
import { scopeConstraints, detectPivotAndInvalidate } from "./constraintScoping";
import type { AIMessage } from "../chatPromptBuilder";
import type { CookingBrief } from "../contracts/cookingBrief";
import type { CanonicalRecipeSessionState } from "../contracts/sessionState";

// Allows test injection of a mock classifier
export type ClassifyFamilyFn = (
  input: DishFamilyClassificationInput,
  options?: { disableAI?: boolean }
) => Promise<DishFamilyClassificationResult>;

export type ResolveCookingIntentInput = {
  userMessage: string;
  requestId: string;
  conversationHistory?: AIMessage[];
  sessionState?: CanonicalRecipeSessionState | null;
  /** Legacy CookingBrief — treated as context only, never overrides user message */
  cookingBrief?: CookingBrief | null;
  userPreferences?: {
    dietaryTags?: string[];
    ownedEquipment?: string[];
  } | null;
  taskSettingModel?: string | null;
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CUISINE_HINTS: Array<{ patterns: string[]; cuisine: string }> = [
  { patterns: ["italian", "pasta", "risotto", "carbonara"], cuisine: "italian" },
  { patterns: ["thai", "pad thai", "green curry", "tom yum"], cuisine: "thai" },
  { patterns: ["mexican", "tacos", "enchiladas", "mole"], cuisine: "mexican" },
  { patterns: ["indian", "curry", "tikka", "biryani", "dal"], cuisine: "indian" },
  { patterns: ["japanese", "ramen", "sushi", "tempura", "miso"], cuisine: "japanese" },
  { patterns: ["chinese", "stir fry", "fried rice", "dim sum", "wonton"], cuisine: "chinese" },
  { patterns: ["french", "cassoulet", "ratatouille", "boeuf bourguignon", "coq au vin"], cuisine: "french" },
  { patterns: ["greek", "spanakopita", "moussaka", "tzatziki", "souvlaki"], cuisine: "greek" },
  { patterns: ["korean", "bibimbap", "kimchi", "bulgogi", "japchae"], cuisine: "korean" },
  { patterns: ["middle eastern", "falafel", "hummus", "shawarma", "kebab"], cuisine: "middle_eastern" },
];

const MEAL_OCCASION_HINTS: Array<{ patterns: string[]; occasion: string }> = [
  { patterns: ["breakfast", "morning", "brunch"], occasion: "breakfast" },
  { patterns: ["lunch", "midday", "midday meal"], occasion: "lunch" },
  { patterns: ["dinner", "supper", "evening meal", "tonight"], occasion: "dinner" },
  { patterns: ["snack", "snacking", "bite to eat"], occasion: "snack" },
  { patterns: ["dessert", "sweet treat", "after dinner"], occasion: "dessert" },
];

const DIETARY_SIGNALS = [
  "vegan", "vegetarian", "gluten-free", "gluten free",
  "dairy-free", "dairy free", "nut-free", "nut free",
  "keto", "paleo", "halal", "kosher",
];

function extractCuisineHint(text: string): string | null {
  const norm = normalizeText(text);
  for (const { patterns, cuisine } of CUISINE_HINTS) {
    if (patterns.some((p) => norm.includes(p))) return cuisine;
  }
  return null;
}

function extractMealOccasion(text: string): string | null {
  const norm = normalizeText(text);
  for (const { patterns, occasion } of MEAL_OCCASION_HINTS) {
    if (patterns.some((p) => norm.includes(p))) return occasion;
  }
  return null;
}

function extractDietaryConstraints(
  text: string,
  source: ConstraintSource
): Omit<ResolvedConstraint, "scope">[] {
  const norm = normalizeText(text);
  return DIETARY_SIGNALS
    .filter((signal) => norm.includes(signal))
    .map((signal) => ({
      type: "dietary",
      value: signal,
      strength: "hard" as ConstraintStrength,
      source,
    }));
}

function extractIngredientMentions(text: string): string[] {
  const norm = normalizeText(text);
  const matches: string[] = [];
  const patterns = [
    /\bwith\s+([a-z\s]{3,25})(?:\s+and\b|\s*,|\s*$)/g,
    /\busing\s+([a-z\s]{3,25})(?:\s+and\b|\s*,|\s*$)/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(norm)) !== null) {
      if (match[1]) matches.push(match[1].trim());
    }
  }
  return [...new Set(matches)].filter((m) => m.length > 2);
}

function computePremiseTrust(
  confidence: number,
  family: string | null
): PremiseTrust {
  if (family !== null && confidence >= 0.8) return "high";
  if (family !== null && confidence >= 0.6) return "medium";
  if (family !== null && confidence >= 0.4) return "low";
  return "none";
}

function determineIntentSource(
  sessionState: CanonicalRecipeSessionState | null | undefined,
  cookingBrief: CookingBrief | null | undefined
): IntentSource {
  if (sessionState?.active_dish?.locked) return "locked_session";
  if (cookingBrief && cookingBrief.request_mode !== "explore") return "persisted_brief";
  return "explicit_user_message";
}

/**
 * Single canonical semantic resolution point for migrated build flows.
 *
 * Source precedence (highest to lowest):
 * 1. Current user message
 * 2. Explicit user preferences/settings
 * 3. Active locked session (if not contradicted by user message)
 * 4. Persisted brief (as context only — never overrides user message)
 * 5. Inferred values
 */
export async function resolveCookingIntent(
  input: ResolveCookingIntentInput,
  deps?: { classifyFamily?: ClassifyFamilyFn }
): Promise<ResolvedCookingIntent> {
  const classifyFn = deps?.classifyFamily ?? classifyDishFamily;

  const normalizedMessage = normalizeText(input.userMessage);

  const previousFamily =
    input.sessionState?.active_dish?.dish_family ?? null;

  const classificationResult = await classifyFn(
    {
      dishName: null,
      userMessage: input.userMessage,
      conversationContext:
        input.conversationHistory
          ?.filter((m) => m.role === "user")
          .map((m) => m.content)
          .join(" ") ?? null,
      currentFamily: previousFamily,
      taskSettingModel: input.taskSettingModel,
    },
    { disableAI: !input.taskSettingModel }
  );

  const userDietaryConstraints = extractDietaryConstraints(
    input.userMessage,
    "explicit_user"
  );

  const preferenceConstraints: Omit<ResolvedConstraint, "scope">[] = [];
  for (const tag of input.userPreferences?.dietaryTags ?? []) {
    if (!userDietaryConstraints.some((c) => c.value === tag)) {
      preferenceConstraints.push({
        type: "dietary",
        value: tag,
        strength: "hard",
        source: "user_settings",
      });
    }
  }
  for (const equip of input.userPreferences?.ownedEquipment ?? []) {
    preferenceConstraints.push({
      type: "equipment",
      value: equip,
      strength: "soft",
      source: "user_settings",
    });
  }

  const allUnscopedConstraints = [...userDietaryConstraints, ...preferenceConstraints];
  const scopedConstraints = scopeConstraints({
    constraints: allUnscopedConstraints,
    userMessage: input.userMessage,
    sessionState: input.sessionState,
  });

  const { pivotType, keptConstraints, invalidatedConstraints } =
    detectPivotAndInvalidate({
      constraints: scopedConstraints,
      previousFamily,
      newFamily: classificationResult.family,
      userMessage: input.userMessage,
      sessionState: input.sessionState,
    });

  const premiseTrust = computePremiseTrust(
    classificationResult.confidence,
    classificationResult.family
  );

  const requiresClarification =
    premiseTrust === "none" ||
    (premiseTrust === "low" && normalizedMessage.split(" ").length < 4);

  const clarificationReason = requiresClarification
    ? "Your request is too general to build a recipe from. Try naming a specific dish or ingredient."
    : null;

  return {
    dishName: classificationResult.family
      ? (input.userMessage.trim() || null)
      : null,
    rawUserPhrase: input.userMessage.trim() || null,
    dishFamily: classificationResult.family,
    dishFamilyConfidence: classificationResult.confidence,
    cuisineHint: extractCuisineHint(input.userMessage),
    mealOccasion: extractMealOccasion(input.userMessage),
    intentSource: determineIntentSource(input.sessionState, input.cookingBrief),
    premiseTrust,
    constraints: keptConstraints,
    ingredientMentions: extractIngredientMentions(input.userMessage),
    pivotDetected: pivotType,
    invalidatedConstraints,
    requiresClarification,
    clarificationReason,
    requestId: input.requestId,
    resolvedAt: new Date().toISOString(),
  };
}
