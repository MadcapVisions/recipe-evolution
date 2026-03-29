import type { AiConversationScope } from "../briefStore";

export type CanonicalRecipeSessionState = {
  conversation_key: string;
  scope: AiConversationScope;
  recipe_id: string | null;
  version_id: string | null;
  active_dish: {
    title: string | null;
    dish_family: string | null;
    locked: boolean;
  };
  selected_direction: {
    id: string;
    title: string;
    summary: string;
    tags: string[];
  } | null;
  hard_constraints: {
    required_named_ingredients: string[];
    required_ingredients: string[];
    forbidden_ingredients: string[];
    required_techniques: string[];
    equipment_limits: string[];
  };
  soft_preferences: {
    preferred_ingredients: string[];
    style_tags: string[];
    nice_to_have: string[];
  };
  rejected_branches: Array<{
    title: string;
    reason: string | null;
  }>;
  recipe_context: {
    title: string | null;
    ingredients: string[];
    steps: string[];
  } | null;
  conversation: {
    last_user_message: string | null;
    last_assistant_message: string | null;
    turn_count: number;
  };
  source: {
    updated_by: string;
    brief_confidence: number | null;
  };
};

