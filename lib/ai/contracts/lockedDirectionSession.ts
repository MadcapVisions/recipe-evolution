import type { CookingBrief, BriefFieldState } from "./cookingBrief";
import type { BuildSpec } from "./buildSpec";

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
  extracted_changes: {
    required_ingredients: string[];
    preferred_ingredients: string[];
    forbidden_ingredients: string[];
    style_tags: string[];
    notes: string[];
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
