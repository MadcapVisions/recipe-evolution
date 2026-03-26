import type { AIMessage } from "./chatPromptBuilder";
import type { BuildSpec, BuildSpecAnchorType } from "./contracts/buildSpec";
import type { LockedDirectionSelected } from "./contracts/lockedDirectionSession";
import {
  detectRequestedDishFamily,
  deriveIdeaTitleFromConversationContext,
  detectRequestedProtein,
  detectRequestedAnchorIngredient,
  DISH_FAMILIES,
} from "./homeRecipeAlignment";
import { compileCookingBrief, isGenericCenterpieceTitle } from "./briefCompiler";

// Dish families that represent an explicit format constraint —
// if one of these is identified, must_preserve_format = true.
const FORMAT_LOCKED_FAMILIES = new Set<string>([
  "pizza", "flatbread", "pasta", "tacos", "dumplings", "burger", "sandwich",
  "wraps", "soup", "curry", "bread", "pie", "tart", "cake", "cookies",
  "muffins_scones", "brownies_bars", "rice", "bowl", "salad",
]);

function isKnownDishFamily(value: string | null): value is typeof DISH_FAMILIES[number] {
  return value !== null && (DISH_FAMILIES as readonly string[]).includes(value);
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((v) => v.trim()).filter((v) => v.length > 0)));
}

/**
 * Derives a BuildSpec from a locked direction at the moment of locking.
 * This is the single authoritative place where dish identity is resolved —
 * downstream stages (planner, generator, verifier) read from BuildSpec directly.
 *
 * Optional fields from an enriched ChefDirectionOption (Phase 3c) take precedence
 * over inference when provided.
 */
export function deriveBuildSpec(input: {
  selectedDirection: LockedDirectionSelected;
  conversationHistory: AIMessage[];
  /** Optional: pre-computed dish_family from the model (Phase 3c) */
  modelDishFamily?: string | null;
  /** Optional: pre-computed anchor from the model (Phase 3c) */
  modelAnchor?: string | null;
  modelAnchorType?: BuildSpecAnchorType | null;
}): BuildSpec {
  const { selectedDirection, conversationHistory } = input;

  // --- Context strings ---
  // User turns only — excluding assistant replies avoids promoting AI-suggested ingredients
  // into hard requirements.
  const userTurnsText = conversationHistory
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");

  // titleIsGeneric must be known before directionContext so we can extend it with conversation
  // history when the title is a placeholder (mirrors the legacy path in buildLockedBrief).
  const titleIsGeneric =
    !selectedDirection.title.trim() ||
    isGenericCenterpieceTitle(selectedDirection.title) ||
    /^(?:chef |recipe\b|dish\b|meal\b|idea\b)/i.test(selectedDirection.title.trim());

  // For dish identity: title + summary, extended with user turns when title is generic so that
  // dish family can be recovered from conversation context (e.g. "I want tacos" → family: "tacos").
  const baseDirectionContext = [selectedDirection.title, selectedDirection.summary].filter(Boolean).join(" ");
  const directionContext =
    titleIsGeneric && userTurnsText
      ? [baseDirectionContext, userTurnsText].filter(Boolean).join(" ")
      : baseDirectionContext;

  // For anchor/protein: directionContext already contains user turns when generic;
  // otherwise append them here so protein/ingredient inference always sees the full user input.
  const anchorContext =
    titleIsGeneric ? directionContext : [directionContext, userTurnsText].filter(Boolean).join(" ");

  // --- Dish family resolution ---
  // Model-provided value takes precedence when valid (in DISH_FAMILIES canonical list).
  // When model provides a value that is NOT in the list (e.g. "stew"), fall through to
  // inference — do not accept the invalid value and do not silently produce null.
  const modelFamilyValid = input.modelDishFamily != null && isKnownDishFamily(input.modelDishFamily);
  const inferredFamily = detectRequestedDishFamily(directionContext);
  const dish_family: typeof DISH_FAMILIES[number] | null = modelFamilyValid
    ? (input.modelDishFamily as typeof DISH_FAMILIES[number])
    : (isKnownDishFamily(inferredFamily) ? inferredFamily : null);
  const dish_family_source: "model" | "inferred" = modelFamilyValid ? "model" : "inferred";

  // --- Build title resolution ---
  // Use the direction title when it's specific. Fall back to inference from direction context.
  const inferredTitle = deriveIdeaTitleFromConversationContext(directionContext);

  const build_title = titleIsGeneric
    ? (inferredTitle && !isGenericCenterpieceTitle(inferredTitle) ? inferredTitle : selectedDirection.title)
    : selectedDirection.title.trim();

  const display_title = selectedDirection.title.trim() || build_title;

  // --- Anchor resolution ---
  // Model-provided anchor takes precedence. Fall through to inference when not provided.
  let primary_anchor_value: string | null = input.modelAnchor ?? null;
  let primary_anchor_type: BuildSpecAnchorType | null = input.modelAnchorType ?? null;
  let anchor_source: "model" | "inferred" | "none" = primary_anchor_value ? "model" : "none";

  if (!primary_anchor_value) {
    const protein = detectRequestedProtein(anchorContext);
    const anchor = detectRequestedAnchorIngredient(anchorContext);
    if (protein) {
      primary_anchor_value = protein;
      primary_anchor_type = "protein";
      anchor_source = "inferred";
    } else if (anchor) {
      primary_anchor_value = anchor;
      primary_anchor_type = "ingredient";
      anchor_source = "inferred";
    } else if (dish_family) {
      primary_anchor_value = dish_family;
      primary_anchor_type = "dish";
      anchor_source = "inferred";
    }
  }

  // --- Style tags ---
  const style_tags = unique(selectedDirection.tags);
  const constraintBrief = userTurnsText.trim()
    ? compileCookingBrief({
        userMessage: userTurnsText,
        conversationHistory: [],
      })
    : null;

  return {
    dish_family,
    display_title,
    build_title,
    primary_anchor_type,
    primary_anchor_value,
    required_ingredients: constraintBrief?.ingredients.required ?? [],
    forbidden_ingredients: constraintBrief?.ingredients.forbidden ?? [],
    style_tags,
    must_preserve_format: dish_family !== null && FORMAT_LOCKED_FAMILIES.has(dish_family),
    confidence: dish_family !== null && !titleIsGeneric ? 0.92 : 0.72,
    derived_at: "lock_time",
    dish_family_source,
    anchor_source,
  };
}
