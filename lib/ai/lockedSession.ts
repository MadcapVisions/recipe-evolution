import type { AIMessage } from "./chatPromptBuilder";
import type { CookingBrief } from "./contracts/cookingBrief";
import {
  createLockedDirectionSession,
  type LockedDirectionRefinement,
  type LockedDirectionSelected,
  type LockedDirectionSession,
} from "./contracts/lockedDirectionSession";
import { compileCookingBrief, isGenericCenterpieceTitle } from "./briefCompiler";
import {
  deriveIdeaTitleFromConversationContext,
  detectRequestedAnchorIngredient,
  detectRequestedDishFamily,
  detectRequestedProtein,
} from "./homeRecipeAlignment";
import { extractRefinementDelta } from "./refinementExtractor";

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}

const MAX_LOCKED_REFINEMENTS = 12;
const GENERIC_SELECTED_TITLE_PATTERNS = [
  /^chef /i,
  /^recipe\b/i,
  /^dish\b/i,
  /^meal\b/i,
  /^idea\b/i,
  /^version\b/i,
  /^(?:a|an)\s+(?:recipe|dish|meal)\b/i,
  /^(?:chicken|beef|pork|fish|vegetable)\s+(?:dish|meal|recipe)\b/i,
];

function recentRefinements(session: LockedDirectionSession) {
  return session.refinements.slice(-MAX_LOCKED_REFINEMENTS);
}

function shouldKeepSelectedTitle(title: string) {
  const trimmed = title.trim();
  if (trimmed.length < 4) {
    return false;
  }

  return !GENERIC_SELECTED_TITLE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function appendLockedSessionRefinement(
  session: LockedDirectionSession,
  input: {
    userText: string;
    assistantText: string | null;
  }
): LockedDirectionSession {
  const refinement = extractRefinementDelta(input);
  return appendLockedSessionRefinementDelta(session, refinement);
}

export function appendLockedSessionRefinementDelta(
  session: LockedDirectionSession,
  refinement: LockedDirectionRefinement
): LockedDirectionSession {
  const refinements = [...session.refinements, refinement].slice(-MAX_LOCKED_REFINEMENTS);
  return {
    ...session,
    state: "ready_to_build",
    brief_snapshot: null,
    refinements,
  };
}

export function removeLastLockedSessionRefinement(session: LockedDirectionSession): LockedDirectionSession {
  const nextRefinements = session.refinements.slice(0, -1);
  return {
    ...session,
    state: nextRefinements.length > 0 ? "ready_to_build" : "direction_locked",
    brief_snapshot: null,
    refinements: nextRefinements,
  };
}

export function markLockedSessionBuilt(session: LockedDirectionSession, brief: CookingBrief): LockedDirectionSession {
  return {
    ...session,
    state: "built",
    brief_snapshot: brief,
  };
}

export function buildLockedBrief(input: {
  session: LockedDirectionSession;
  conversationHistory?: AIMessage[];
}): CookingBrief {
  const selected = input.session.selected_direction;
  if (!selected) {
    return compileCookingBrief({
      userMessage: "",
      conversationHistory: input.conversationHistory,
    });
  }

  const refinements = recentRefinements(input.session);
  const refinementText = refinements
    .map((item) => item.user_text)
    .join("\n");
  const syntheticUserMessage = [selected.title, selected.summary, refinementText].filter(Boolean).join("\n");
  const brief = compileCookingBrief({
    userMessage: syntheticUserMessage,
    assistantReply: `Locked direction: ${selected.title}. ${selected.summary}`,
    lockedSessionState: input.session.state,
    recipeContext: {
      title: selected.title,
      ingredients: unique(
        refinements.flatMap((item) => [
          ...item.extracted_changes.required_ingredients,
          ...item.extracted_changes.preferred_ingredients,
        ])
      ),
      steps: [selected.summary],
    },
  });

  // When the direction title is specific, derive dish identity only from the title + summary.
  // When the title is generic (e.g. "Chef Conversation Recipe"), fall back to the full
  // conversation history so we can extract a real dish family and canonical name.
  const titleIsSpecific = shouldKeepSelectedTitle(selected.title);
  const directionContext = [
    selected.title,
    selected.summary,
    refinementText,
    ...(titleIsSpecific ? [] : (input.conversationHistory ?? []).map((m) => m.content)),
  ]
    .filter(Boolean)
    .join(" ");
  const canonicalDish = titleIsSpecific
    ? selected.title.trim()
    : deriveIdeaTitleFromConversationContext(directionContext);
  const canonicalFamily = detectRequestedDishFamily(directionContext);
  const userContext = [
    ...(input.conversationHistory ?? [])
      .filter((message) => message.role === "user")
      .map((message) => message.content),
    refinementText,
  ]
    .filter(Boolean)
    .join(" ");
  const conversationProtein = detectRequestedProtein(userContext);
  const conversationAnchor = detectRequestedAnchorIngredient(userContext);
  const preservedCenterpiece =
    conversationProtein ??
    conversationAnchor ??
    (shouldKeepSelectedTitle(selected.title) && !isGenericCenterpieceTitle(canonicalDish) ? canonicalDish : null);
  const forbiddenIngredients = unique([
    ...brief.ingredients.forbidden,
    ...refinements.flatMap((item) => item.extracted_changes.forbidden_ingredients),
  ]);
  const requiredIngredients = unique([
    // Only use explicit user refinements — do not include brief.ingredients.required here,
    // as compileCookingBrief incorrectly parses the AI-generated direction summary text
    // and extracts ingredient mentions from it as if they were user-mandated requirements.
    ...refinements.flatMap((item) => item.extracted_changes.required_ingredients),
    ...(conversationProtein ? [conversationProtein] : []),
    ...(conversationAnchor && conversationAnchor !== conversationProtein ? [conversationAnchor] : []),
  ]).filter((ingredient) => !forbiddenIngredients.includes(ingredient));
  const styleTags = unique([
    ...brief.style.tags,
    ...refinements.flatMap((item) => item.extracted_changes.style_tags),
  ]);

  brief.request_mode = "locked";
  brief.dish.normalized_name = shouldKeepSelectedTitle(canonicalDish) ? canonicalDish : null;
  brief.dish.dish_family = canonicalFamily ?? brief.dish.dish_family;
  brief.ingredients.required = requiredIngredients;
  brief.ingredients.forbidden = forbiddenIngredients;
  // Prefer a real user-mentioned anchor ingredient/protein over the selected title.
  // Titles like "Tomato and Pepper Braise" are dish names, not useful centerpiece ingredients.
  brief.ingredients.centerpiece = preservedCenterpiece;
  brief.style.tags = styleTags;
  brief.style.format_tags = unique(brief.style.format_tags);
  brief.directives.must_have = unique([
    ...brief.directives.must_have,
    ...requiredIngredients,
    ...styleTags,
    ...(preservedCenterpiece ? [preservedCenterpiece] : []),
  ]);
  brief.directives.must_not_have = unique([...brief.directives.must_not_have, ...forbiddenIngredients]);
  brief.directives.required_techniques = brief.dish.dish_family === "pizza" ? ["bake"] : [];
  brief.constraints.time_max_minutes = brief.constraints.time_max_minutes ?? null;
  brief.constraints.dietary_tags = unique(brief.constraints.dietary_tags);
  brief.field_state.dish_family = brief.dish.dish_family ? "locked" : brief.field_state.dish_family;
  brief.field_state.normalized_name = brief.dish.normalized_name ? "locked" : brief.field_state.normalized_name;
  brief.compiler_notes.push("Built from locked direction session.");

  return brief;
}

export function createLockedSessionFromDirection(input: {
  conversationKey: string;
  selectedDirection: LockedDirectionSelected;
}) {
  return createLockedDirectionSession(input);
}
