/**
 * Rescue scenario taxonomy for cook-time failures.
 * Scoped to Milestone 3 launch families.
 */

export const RESCUE_SCENARIOS = [
  "too_salty",
  "too_thin",
  "too_thick",
  "overbrowned_aromatics",
  "underseasoned",
  "too_wet_watery",
  "dry_protein",
  "broken_sauce",
  "texture_not_crisping",
  "dough_batter_too_wet",
  "dough_batter_too_dry",
] as const;

export type RescueScenario = (typeof RESCUE_SCENARIOS)[number];

export const RESCUE_SCENARIO_LABELS: Record<RescueScenario, string> = {
  too_salty: "Too salty",
  too_thin: "Too thin / watery",
  too_thick: "Too thick / pasty",
  overbrowned_aromatics: "Garlic / aromatics overbrowned",
  underseasoned: "Under-seasoned / flat",
  too_wet_watery: "Too wet or watery",
  dry_protein: "Protein is dry",
  broken_sauce: "Sauce has broken",
  texture_not_crisping: "Not crisping / browning",
  dough_batter_too_wet: "Dough or batter too wet",
  dough_batter_too_dry: "Dough or batter too dry",
};

export const RESCUE_SCENARIO_DESCRIPTIONS: Record<RescueScenario, string> = {
  too_salty: "The dish tastes overly salty and needs to be balanced.",
  too_thin: "The sauce, soup, or stew is too thin and needs body.",
  too_thick: "The sauce, soup, or stew has become too thick or gluey.",
  overbrowned_aromatics: "Garlic, onion, or other aromatics have gone past golden to burnt.",
  underseasoned: "The dish tastes flat or lacks depth despite following the recipe.",
  too_wet_watery: "Excess moisture is diluting flavour or preventing browning.",
  dry_protein: "Chicken, meat, or fish has cooked dry and lost juiciness.",
  broken_sauce: "An emulsified sauce has split and looks greasy or grainy.",
  texture_not_crisping: "A surface that should be crispy or browned is staying soft.",
  dough_batter_too_wet: "The dough or batter is sticky, slack, or hard to work with.",
  dough_batter_too_dry: "The dough or batter is crumbly, stiff, or cracking.",
};
