// lib/ai/intent/intentTypes.ts

/**
 * Canonical semantic contracts for migrated recipe-generation flows.
 *
 * Authority hierarchy (migrated flows only):
 *   ResolvedCookingIntent  — canonical upstream semantic contract
 *   BuildSpec              — downstream execution contract (temporary bridge)
 *   CookingBrief           — legacy compatibility context only
 *   SessionState / LockedDirectionSession — persistence contracts, not semantic authority
 */

export type IntentSource =
  | "explicit_user_message"  // user named a dish directly
  | "locked_session"         // drawn from an active locked direction session
  | "persisted_brief"        // drawn from stored CookingBrief
  | "inferred_context"       // inferred from conversation history
  | "quick_start";           // triggered by a guided quick-start card

export type PremiseTrust =
  | "high"    // user message unambiguously names a specific dish
  | "medium"  // dish inferrable with reasonable confidence
  | "low"     // ambiguous — multiple plausible interpretations
  | "none";   // no coherent dish premise could be resolved

export type PivotType =
  | "dish_pivot"        // dish changed entirely (pasta → sourdough)
  | "style_pivot"       // same dish, different style (creamy → broth-based)
  | "constraint_pivot"  // constraint-only change, same dish
  | "no_pivot";         // no change detected

export type ConstraintScope =
  | "user_persistent"  // dietary restrictions, equipment the user owns
  | "session_active"   // locked for the current build session
  | "dish_specific"    // technique/equipment specific to one dish type
  | "retry_local";     // valid within this generation attempt only

export type ConstraintStrength =
  | "hard"   // must satisfy — failure is real if violated
  | "soft"   // prefer to satisfy — can be relaxed
  | "hint";  // advisory only

export type ConstraintSource =
  | "explicit_user"  // user stated it directly in the message
  | "user_settings"  // from user preferences or dietary settings
  | "session_lock"   // locked into the current session
  | "inferred";      // inferred from context

export type ResolvedConstraint = {
  type: string;             // "dietary" | "equipment" | "technique" | "ingredient" | "forbidden_ingredient" | "style"
  value: string;            // e.g. "vegan", "slow cooker", "fold_in", "sourdough discard"
  scope: ConstraintScope;
  strength: ConstraintStrength;
  source: ConstraintSource;
};

export type ResolvedCookingIntent = {
  // Dish identity
  dishName: string | null;          // normalized dish name, null if unclear
  rawUserPhrase: string | null;     // verbatim user input
  dishFamily: string | null;        // canonical key from DISH_FAMILIES, or null
  dishFamilyConfidence: number;     // 0–1
  cuisineHint: string | null;       // e.g. "italian", "thai"
  mealOccasion: string | null;      // e.g. "dinner", "breakfast", "snack"

  // Classification
  intentSource: IntentSource;
  premiseTrust: PremiseTrust;

  // Constraints and ingredients
  constraints: ResolvedConstraint[];
  ingredientMentions: string[];     // ingredients explicitly mentioned in user message

  // Pivot state
  pivotDetected: PivotType;
  invalidatedConstraints: ResolvedConstraint[];  // dropped due to pivot

  // Clarification
  requiresClarification: boolean;
  clarificationReason: string | null;  // surfaced to UI when requiresClarification = true

  // Tracing
  requestId: string;
  resolvedAt: string;  // ISO 8601 timestamp
};
