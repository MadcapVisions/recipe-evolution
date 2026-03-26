export const BRIEF_FIELD_STATES = ["locked", "inferred", "unknown"] as const;
export type BriefFieldState = (typeof BRIEF_FIELD_STATES)[number];

export const COOKING_BRIEF_REQUEST_MODES = ["explore", "compare", "locked", "generate", "revise"] as const;
export type CookingBriefRequestMode = (typeof COOKING_BRIEF_REQUEST_MODES)[number];

export type CookingBrief = {
  request_mode: CookingBriefRequestMode;
  confidence: number;
  ambiguity_reason: string | null;
  dish: {
    raw_user_phrase: string | null;
    normalized_name: string | null;
    dish_family: string | null;
    cuisine: string | null;
    course: string | null;
    authenticity_target: string | null;
  };
  style: {
    tags: string[];
    texture_tags: string[];
    format_tags: string[];
  };
  ingredients: {
    required: string[];
    preferred: string[];
    forbidden: string[];
    centerpiece: string | null;
  };
  constraints: {
    servings: number | null;
    time_max_minutes: number | null;
    difficulty_target: string | null;
    dietary_tags: string[];
    equipment_limits: string[];
    macroTargets?: {
      caloriesMax?: number | null;
      caloriesMin?: number | null;
      proteinMinG?: number | null;
      proteinMaxG?: number | null;
      carbsMinG?: number | null;
      carbsMaxG?: number | null;
      fatMinG?: number | null;
      fatMaxG?: number | null;
      fiberMinG?: number | null;
      fiberMaxG?: number | null;
      sugarMaxG?: number | null;
      sodiumMaxMg?: number | null;
    } | null;
  };
  directives: {
    must_have: string[];
    nice_to_have: string[];
    must_not_have: string[];
    required_techniques: string[];
  };
  field_state: {
    dish_family: BriefFieldState;
    normalized_name: BriefFieldState;
    cuisine: BriefFieldState;
    ingredients: BriefFieldState;
    constraints: BriefFieldState;
  };
  source_turn_ids: string[];
  compiler_notes: string[];
};

export function createEmptyCookingBrief(): CookingBrief {
  return {
    request_mode: "explore",
    confidence: 0,
    ambiguity_reason: null,
    dish: {
      raw_user_phrase: null,
      normalized_name: null,
      dish_family: null,
      cuisine: null,
      course: null,
      authenticity_target: null,
    },
    style: {
      tags: [],
      texture_tags: [],
      format_tags: [],
    },
    ingredients: {
      required: [],
      preferred: [],
      forbidden: [],
      centerpiece: null,
    },
    constraints: {
      servings: null,
      time_max_minutes: null,
      difficulty_target: null,
      dietary_tags: [],
      equipment_limits: [],
    },
    directives: {
      must_have: [],
      nice_to_have: [],
      must_not_have: [],
      required_techniques: [],
    },
    field_state: {
      dish_family: "unknown",
      normalized_name: "unknown",
      cuisine: "unknown",
      ingredients: "unknown",
      constraints: "unknown",
    },
    source_turn_ids: [],
    compiler_notes: [],
  };
}

export function isCookingBriefLocked(brief: CookingBrief) {
  return brief.request_mode === "locked" || brief.request_mode === "generate" || brief.field_state.dish_family === "locked";
}
