import type { AIMessage } from "./chatPromptBuilder";
import type { CookingBrief } from "./contracts/cookingBrief";
import { createEmptyCookingBrief } from "./contracts/cookingBrief";
import {
  createLockedDirectionSession,
  type LockedDirectionRefinement,
  type LockedDirectionSelected,
  type LockedDirectionSession,
} from "./contracts/lockedDirectionSession";
import { normalizeBuildSpec, type BuildSpec } from "./contracts/buildSpec";
import { compileCookingBrief, isGenericCenterpieceTitle } from "./briefCompiler";
import { sanitizeCookingBriefIngredients } from "./briefSanitization";
import {
  deriveIdeaTitleFromConversationContext,
  detectRequestedAnchorIngredient,
  detectRequestedDishFamily,
  detectRequestedProtein,
} from "./homeRecipeAlignment";
import { extractRefinementDelta } from "./refinementExtractor";
import { deriveBuildSpec } from "./buildSpecDeriver";
import { deriveRequiredTechniquesFromConstraints } from "./methodRegistry";

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}

function uniqueBy<T>(values: T[], toKey: (value: T) => string) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = toKey(value);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
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

export function refinementHasRecipeChanges(refinement: LockedDirectionRefinement): boolean {
  return (
    refinement.extracted_changes.required_ingredients.length > 0 ||
    refinement.extracted_changes.preferred_ingredients.length > 0 ||
    refinement.extracted_changes.forbidden_ingredients.length > 0 ||
    refinement.extracted_changes.style_tags.length > 0
  );
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
  const refinementText = refinements.map((item) => item.user_text).join("\n");

  // --- BuildSpec fast path (new sessions) ---
  // When a valid BuildSpec is present, dish identity was resolved at lock time — read it directly.
  // No re-inference of dish_family, title, protein, or anchor.
  // Invalid or partial specs (e.g. stale client payloads, corrupted storage) are treated as absent
  // and fall through to the legacy reconstruction path below — never as hard errors.
  const spec = normalizeBuildSpec(input.session.build_spec);
  if (spec) {
    // Safety net: recover explicit user-authored ingredient constraints from the
    // conversation branch even when a stale or generic BuildSpec omitted them.
    // This prevents locked reply-derived sessions from silently dropping hard
    // requests like "use sourdough discard" before recipe generation begins.
    const conversationConstraintBrief = (input.conversationHistory ?? []).some((message) => message.role === "user")
      ? compileCookingBrief({
          userMessage: (input.conversationHistory ?? [])
            .filter((message) => message.role === "user")
            .map((message) => message.content)
            .join("\n"),
          conversationHistory: [],
          lockedSessionState: input.session.state,
        })
      : null;
    const forbiddenIngredients = unique([
      ...spec.forbidden_ingredients,
      ...(conversationConstraintBrief?.ingredients.forbidden ?? []),
      ...refinements.flatMap((item) => item.extracted_changes.forbidden_ingredients),
    ]);
    const requiredIngredients = unique([
      ...spec.required_ingredients,
      ...(conversationConstraintBrief?.ingredients.required ?? []),
      ...refinements.flatMap((item) => item.extracted_changes.required_ingredients),
      ...(spec.primary_anchor_type === "protein" && spec.primary_anchor_value ? [spec.primary_anchor_value] : []),
      ...(spec.primary_anchor_type === "ingredient" && spec.primary_anchor_value ? [spec.primary_anchor_value] : []),
    ]).filter((ingredient) => !forbiddenIngredients.includes(ingredient));
    const styleTags = unique([
      ...spec.style_tags,
      ...refinements.flatMap((item) => item.extracted_changes.style_tags),
    ]);

    // Centerpiece: prefer explicit anchor, fall back to build_title only when anchor type is "dish"
    const centerpiece =
      spec.primary_anchor_type === "protein" || spec.primary_anchor_type === "ingredient"
        ? spec.primary_anchor_value
        : spec.primary_anchor_type === "dish" && spec.primary_anchor_value && !isGenericCenterpieceTitle(spec.primary_anchor_value)
          ? spec.primary_anchor_value
          : null;

    // Run compileCookingBrief only for refinement-derived constraints (time, dietary tags).
    // Ignore its dish/ingredient inferences — we use BuildSpec for those.
    const refinementBrief = refinementText
      ? compileCookingBrief({
          userMessage: refinementText,
          lockedSessionState: input.session.state,
        })
      : null;
    const equipmentLimits = unique([
      ...(conversationConstraintBrief?.constraints.equipment_limits ?? []),
      ...(refinementBrief?.constraints.equipment_limits ?? []),
    ]);

    const brief = createEmptyCookingBrief();
    brief.request_mode = "locked";
    brief.confidence = spec.confidence;
    brief.dish.normalized_name = spec.build_title;
    brief.dish.dish_family = spec.dish_family;
    brief.dish.raw_user_phrase = selected.title;
    brief.ingredients.required = requiredIngredients;
    brief.ingredients.forbidden = forbiddenIngredients;
    brief.ingredients.centerpiece = centerpiece;
    brief.ingredients.provenance = {
      required: uniqueBy(
        [
          ...refinements.flatMap((item) => item.extracted_changes.ingredient_provenance?.required ?? []),
          ...requiredIngredients
            .filter((phrase) => !refinements.some((item) => (item.extracted_changes.ingredient_provenance?.required ?? []).some((prov) => prov.phrase === phrase)))
            .map((phrase) => ({
              phrase,
              sourceType: "build_spec" as const,
              sourceRole: null,
              sourceText: phrase,
              extractionMethod: "build_spec_required",
            })),
        ],
        (item) => `${item.phrase}::${item.sourceType}::${item.sourceText ?? ""}`
      ),
      preferred: [],
      forbidden: uniqueBy(
        [
          ...refinements.flatMap((item) => item.extracted_changes.ingredient_provenance?.forbidden ?? []),
          ...forbiddenIngredients
            .filter((phrase) => !refinements.some((item) => (item.extracted_changes.ingredient_provenance?.forbidden ?? []).some((prov) => prov.phrase === phrase)))
            .map((phrase) => ({
              phrase,
              sourceType: "build_spec" as const,
              sourceRole: null,
              sourceText: phrase,
              extractionMethod: "build_spec_forbidden",
            })),
        ],
        (item) => `${item.phrase}::${item.sourceType}::${item.sourceText ?? ""}`
      ),
    };
    brief.style.tags = styleTags;
    brief.directives.must_have = unique([
      ...(spec.dish_family ? [spec.dish_family] : []),
      ...requiredIngredients,
      ...styleTags,
      ...(centerpiece ? [centerpiece] : []),
    ]);
    brief.directives.must_not_have = forbiddenIngredients;
    brief.directives.required_techniques = deriveRequiredTechniquesFromConstraints({
      dishFamily: spec.dish_family,
      explicitMethods: unique([
        ...(conversationConstraintBrief?.directives.required_techniques ?? []),
        ...(refinementBrief?.directives.required_techniques ?? []),
      ]),
      equipmentLimits,
    });
    brief.constraints.time_max_minutes = refinementBrief?.constraints.time_max_minutes ?? null;
    brief.constraints.dietary_tags = unique(refinementBrief?.constraints.dietary_tags ?? []);
    brief.constraints.equipment_limits = equipmentLimits;
    brief.field_state.dish_family = spec.dish_family ? "locked" : "unknown";
    brief.field_state.normalized_name = spec.build_title ? "locked" : "unknown";
    brief.field_state.constraints =
      brief.constraints.time_max_minutes != null ||
      brief.constraints.dietary_tags.length > 0 ||
      brief.constraints.equipment_limits.length > 0
        ? "inferred"
        : "unknown";
    brief.compiler_notes = [`Built from BuildSpec (lock_time). Family: ${spec.dish_family ?? "none"}.`];
    return sanitizeCookingBriefIngredients(brief);
  }

  // --- Legacy path (sessions without BuildSpec) ---
  // Kept for backward-compat with sessions created before BuildSpec was introduced.
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
  brief.ingredients.centerpiece = preservedCenterpiece;
  brief.ingredients.provenance = {
    required: uniqueBy(
      [
        ...(brief.ingredients.provenance?.required ?? []),
        ...refinements.flatMap((item) => item.extracted_changes.ingredient_provenance?.required ?? []),
      ],
      (item) => `${item.phrase}::${item.sourceType}::${item.sourceText ?? ""}`
    ),
    preferred: uniqueBy(
      [
        ...(brief.ingredients.provenance?.preferred ?? []),
        ...refinements.flatMap((item) => item.extracted_changes.ingredient_provenance?.preferred ?? []),
      ],
      (item) => `${item.phrase}::${item.sourceType}::${item.sourceText ?? ""}`
    ),
    forbidden: uniqueBy(
      [
        ...(brief.ingredients.provenance?.forbidden ?? []),
        ...refinements.flatMap((item) => item.extracted_changes.ingredient_provenance?.forbidden ?? []),
      ],
      (item) => `${item.phrase}::${item.sourceType}::${item.sourceText ?? ""}`
    ),
  };
  brief.style.tags = styleTags;
  brief.style.format_tags = unique(brief.style.format_tags);
  brief.directives.must_have = unique([
    ...brief.directives.must_have,
    ...requiredIngredients,
    ...styleTags,
    ...(preservedCenterpiece ? [preservedCenterpiece] : []),
  ]);
  brief.directives.must_not_have = unique([...brief.directives.must_not_have, ...forbiddenIngredients]);
  brief.directives.required_techniques = deriveRequiredTechniquesFromConstraints({
    dishFamily: brief.dish.dish_family,
    explicitMethods: brief.directives.required_techniques,
    equipmentLimits: brief.constraints.equipment_limits,
  });
  brief.constraints.time_max_minutes = brief.constraints.time_max_minutes ?? null;
  brief.constraints.dietary_tags = unique(brief.constraints.dietary_tags);
  brief.field_state.dish_family = brief.dish.dish_family ? "locked" : brief.field_state.dish_family;
  brief.field_state.normalized_name = brief.dish.normalized_name ? "locked" : brief.field_state.normalized_name;
  brief.compiler_notes.push("Built from locked direction session (legacy — no BuildSpec).");

  return sanitizeCookingBriefIngredients(brief);
}

export function createLockedSessionFromDirection(input: {
  conversationKey: string;
  selectedDirection: LockedDirectionSelected;
  conversationHistory?: AIMessage[];
  buildSpec?: BuildSpec | null;
  /** Optional enriched fields from ChefDirectionOption (Phase 3b/3c) — model-provided, takes precedence over inference */
  modelDishFamily?: string | null;
  modelAnchor?: string | null;
  modelAnchorType?: "dish" | "protein" | "ingredient" | "format" | null;
}) {
  const build_spec =
    input.buildSpec ??
    (input.conversationHistory !== undefined
      ? deriveBuildSpec({
          selectedDirection: input.selectedDirection,
          conversationHistory: input.conversationHistory,
          modelDishFamily: input.modelDishFamily,
          modelAnchor: input.modelAnchor,
          modelAnchorType: input.modelAnchorType,
        })
      : null);
  return createLockedDirectionSession({
    conversationKey: input.conversationKey,
    selectedDirection: input.selectedDirection,
    buildSpec: build_spec,
  });
}
