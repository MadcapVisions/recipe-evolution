/**
 * Output type classification for a coaching rule.
 * Controls which slot of CookingCoach the rule contributes to.
 */
export type CoachRuleOutputType =
  | "chef_secret"
  | "watch_for"
  | "mistake_prevention"
  | "recovery_move"
  | "finish_guidance";
