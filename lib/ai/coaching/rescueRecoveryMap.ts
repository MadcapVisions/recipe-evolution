import type { RescueScenario } from "./rescueScenarios";

// ---------------------------------------------------------------------------
// Recovery entry
// ---------------------------------------------------------------------------

export type RecoveryEntry = {
  scenario: RescueScenario;
  /** Practical recovery instruction for home cooks */
  move: string;
  /**
   * If specified, this entry applies only when the dish belongs to one of
   * these families. Entries without families apply to all families.
   */
  families?: string[];
};

// ---------------------------------------------------------------------------
// Recovery map
// ---------------------------------------------------------------------------

export const RECOVERY_MAP: RecoveryEntry[] = [
  // ── too_salty ─────────────────────────────────────────────────────────────
  {
    scenario: "too_salty",
    move: "Add a starchy element — cooked potato, extra pasta, or unseasoned rice — to absorb salt as it cooks through.",
    families: ["soups_stews"],
  },
  {
    scenario: "too_salty",
    move: "Add unsalted pasta cooking water to the sauce gradually to dilute without losing body.",
    families: ["pasta"],
  },
  {
    scenario: "too_salty",
    move: "Add an acid (a squeeze of lemon or a splash of vinegar) — it won't remove salt but it shifts the perception away from saltiness.",
  },

  // ── too_thin ──────────────────────────────────────────────────────────────
  {
    scenario: "too_thin",
    move: "Simmer uncovered on medium heat to reduce. For soups and stews this concentrates flavour as it thickens.",
    families: ["soups_stews"],
  },
  {
    scenario: "too_thin",
    move: "Make a slurry: dissolve 1 tsp cornstarch in 2 tbsp cold water, stir into simmering sauce, cook 2 minutes.",
    families: ["skillet_saute", "pasta"],
  },
  {
    scenario: "too_thin",
    move: "Continue reducing the sauce uncovered over medium heat until it lightly coats a spoon.",
  },

  // ── too_thick ─────────────────────────────────────────────────────────────
  {
    scenario: "too_thick",
    move: "Add pasta cooking water a splash at a time, stirring between each addition, until the sauce moves loosely.",
    families: ["pasta"],
  },
  {
    scenario: "too_thick",
    move: "Add warm stock or water a small amount at a time while stirring. Avoid cold liquid which can seize a starch-thickened sauce.",
    families: ["soups_stews"],
  },
  {
    scenario: "too_thick",
    move: "Thin with warm water or stock, one tablespoon at a time, until the sauce reaches the right consistency.",
  },

  // ── overbrowned_aromatics ─────────────────────────────────────────────────
  {
    scenario: "overbrowned_aromatics",
    move: "Deglaze immediately with a splash of water, wine, or stock and scrape the bits. The fond carries flavour even when dark.",
  },
  {
    scenario: "overbrowned_aromatics",
    move: "If the aromatics taste bitter, remove them and start a fresh batch in a clean pan on lower heat. The rest of the dish is salvageable.",
  },

  // ── underseasoned ─────────────────────────────────────────────────────────
  {
    scenario: "underseasoned",
    move: "Add salt in small increments (¼ tsp at a time), stirring and tasting between each addition. Salt amplifies existing flavours.",
  },
  {
    scenario: "underseasoned",
    move: "Add an umami boost — a splash of soy sauce, a smear of tomato paste, or a few drops of fish sauce. They add depth without making the dish taste 'Asian'.",
  },
  {
    scenario: "underseasoned",
    move: "Add a squeeze of lemon or a splash of vinegar. Acid often reads as brightness missing from underseasoned food.",
  },

  // ── too_wet_watery ────────────────────────────────────────────────────────
  {
    scenario: "too_wet_watery",
    move: "Remove the lid and increase heat to medium-high to drive off excess moisture. Stir more frequently to prevent sticking.",
    families: ["soups_stews", "skillet_saute"],
  },
  {
    scenario: "too_wet_watery",
    move: "If vegetables are releasing too much water, increase the heat and spread them out on the pan to evaporate the liquid quickly.",
    families: ["sheet_pan", "roasted_vegetables"],
  },
  {
    scenario: "too_wet_watery",
    move: "Drain off excess liquid and reduce it separately in a small pan, then return to the dish.",
  },

  // ── dry_protein ───────────────────────────────────────────────────────────
  {
    scenario: "dry_protein",
    move: "Slice the protein thinly across the grain and serve with a sauce or pan drippings spooned directly over it at the table.",
    families: ["chicken_dinners", "skillet_saute"],
  },
  {
    scenario: "dry_protein",
    move: "Shred dry chicken and toss in a flavourful sauce (the pan drippings with a splash of stock and butter work well). This is now a different dish, not a ruined one.",
    families: ["chicken_dinners"],
  },
  {
    scenario: "dry_protein",
    move: "Slice thinly and serve with extra sauce. A good sauce can mask dryness and restore juiciness at the table.",
  },

  // ── broken_sauce ──────────────────────────────────────────────────────────
  {
    scenario: "broken_sauce",
    move: "Remove from heat. Add a tablespoon of cold water and whisk vigorously — the shock often re-emulsifies a broken butter or cream sauce.",
    families: ["pasta", "skillet_saute"],
  },
  {
    scenario: "broken_sauce",
    move: "Take the pan off heat. Slowly drizzle the broken sauce into a new base (an egg yolk or a teaspoon of dijon mustard) while whisking constantly.",
  },
  {
    scenario: "broken_sauce",
    move: "If the sauce is irreparably broken, strain out solids, reduce the liquid, and finish with cold butter pieces added off heat, swirling until glossy.",
  },

  // ── texture_not_crisping ──────────────────────────────────────────────────
  {
    scenario: "texture_not_crisping",
    move: "Increase oven temperature to 220°C / 425°F and move the tray to the top rack for the last 10 minutes.",
    families: ["sheet_pan", "roasted_vegetables", "baked_casseroles"],
  },
  {
    scenario: "texture_not_crisping",
    move: "Pat the surface dry with paper towel and increase heat. Surface moisture is the main barrier to crisping.",
    families: ["skillet_saute", "chicken_dinners"],
  },
  {
    scenario: "texture_not_crisping",
    move: "Ensure the pan or tray is not overcrowded — spread pieces out and increase temperature. Steam from crowded food prevents crisping.",
  },

  // ── dough_batter_too_wet ──────────────────────────────────────────────────
  {
    scenario: "dough_batter_too_wet",
    move: "Add flour one tablespoon at a time, working it in gently. Avoid overworking bread doughs — just enough to bring it together.",
    families: ["baked_casseroles"],
  },
  {
    scenario: "dough_batter_too_wet",
    move: "Chill the dough for 20–30 minutes in the fridge. Cold firms fat and makes wet dough much easier to handle without adding flour.",
  },

  // ── dough_batter_too_dry ──────────────────────────────────────────────────
  {
    scenario: "dough_batter_too_dry",
    move: "Add liquid (water, milk, or eggs) one tablespoon at a time, incorporating fully before adding more.",
    families: ["baked_casseroles"],
  },
  {
    scenario: "dough_batter_too_dry",
    move: "Add liquid a tablespoon at a time and fold gently. Overmixing after liquid is added activates gluten and produces a tough result.",
  },
];

// ---------------------------------------------------------------------------
// Lookup function
// ---------------------------------------------------------------------------

/**
 * Returns recovery moves for the given scenario and dish family.
 * Returns family-specific moves first, then generic fallbacks.
 * Always returns at least one move if the scenario is covered.
 */
export function getRecoveryMoves(
  scenario: RescueScenario,
  family: string
): RecoveryEntry[] {
  const all = RECOVERY_MAP.filter((e) => e.scenario === scenario);
  const familySpecific = all.filter(
    (e) => e.families && e.families.includes(family)
  );
  const generic = all.filter((e) => !e.families || e.families.length === 0);

  // Return family-specific first, then generic fallbacks, dedup
  const combined = [...familySpecific, ...generic];
  // Deduplicate by move text
  const seen = new Set<string>();
  return combined.filter((e) => {
    if (seen.has(e.move)) return false;
    seen.add(e.move);
    return true;
  });
}
