import type { CookingBrief, BriefFieldState } from "./cookingBrief";

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
};

export function createLockedDirectionSession(input: {
  conversationKey: string;
  selectedDirection: LockedDirectionSelected;
}): LockedDirectionSession {
  return {
    conversation_key: input.conversationKey,
    state: "direction_locked",
    selected_direction: input.selectedDirection,
    refinements: [],
    brief_snapshot: null,
  };
}
