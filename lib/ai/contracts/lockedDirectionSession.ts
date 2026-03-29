import type { CookingBrief, BriefFieldState } from "./cookingBrief";
import type { BuildSpec } from "./buildSpec";
import type { ResolvedIngredientIntent } from "../ingredientResolutionTypes";
import type { IngredientConstraintProvenance } from "../requiredNamedIngredient";

export type LockedDirectionSelected = {
  id: string;
  title: string;
  summary: string;
  tags: string[];
};

export type LockedDirectionRefinement = {
  user_text: string;
  assistant_text: string | null;
  confidence: number;
  ambiguity_reason: string | null;
  ambiguous_notes?: string[];
  distilled_intents?: {
    ingredient_additions: Array<{ label: string; canonical_key: string }>;
    ingredient_preferences: Array<{ label: string; canonical_key: string }>;
    ingredient_removals: Array<{ label: string; canonical_key: string }>;
  };
  /**
   * Structured resolved ingredient intents — the authoritative source for downstream logic.
   * Populated after resolver runs on each extracted phrase.
   * Only contains phrases that passed the hard-constraint confidence threshold (>= 0.9).
   * Lower-confidence resolutions are recorded in ambiguous_notes instead.
   */
  resolved_ingredient_intents?: {
    required: ResolvedIngredientIntent[];
    preferred: ResolvedIngredientIntent[];
    forbidden: ResolvedIngredientIntent[];
  };
  extracted_changes: {
    required_ingredients: string[];
    preferred_ingredients: string[];
    forbidden_ingredients: string[];
    style_tags: string[];
    notes: string[];
    ingredient_provenance?: {
      required: IngredientConstraintProvenance[];
      preferred: IngredientConstraintProvenance[];
      forbidden: IngredientConstraintProvenance[];
    };
  };
  field_state: {
    ingredients: BriefFieldState;
    style: BriefFieldState;
    notes: BriefFieldState;
  };
};

export type LockedDirectionSession = {
  conversation_key: string;
  state: "exploring" | "direction_locked" | "ready_to_build" | "building" | "built";
  selected_direction: LockedDirectionSelected | null;
  refinements: LockedDirectionRefinement[];
  brief_snapshot: CookingBrief | null;
  /**
   * Structured build specification derived once at lock time.
   * When present, downstream stages read from this directly — they do not re-infer identity.
   * null for sessions created before this field was introduced (legacy backward-compat path).
   */
  build_spec: BuildSpec | null;
};

export function createLockedDirectionSession(input: {
  conversationKey: string;
  selectedDirection: LockedDirectionSelected;
  buildSpec?: BuildSpec | null;
}): LockedDirectionSession {
  return {
    conversation_key: input.conversationKey,
    state: "direction_locked",
    selected_direction: input.selectedDirection,
    refinements: [],
    brief_snapshot: null,
    build_spec: input.buildSpec ?? null,
  };
}
