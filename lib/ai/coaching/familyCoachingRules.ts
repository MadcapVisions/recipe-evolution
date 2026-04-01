import type { CoachRule } from "./chefRules";

// ---------------------------------------------------------------------------
// Universal rules — apply to all families
// ---------------------------------------------------------------------------

export const UNIVERSAL_COACH_RULES: CoachRule[] = [
  {
    id: "universal-dry-protein",
    category: "universal",
    outputType: "chef_secret",
    applicability: { roles: ["protein"] },
    rationale: "Surface moisture steams instead of searing",
    priority: 10,
    text: "Pat protein completely dry before heat. Moisture steams instead of searing — a damp surface can't brown.",
    stepHint: "first",
  },
  {
    id: "universal-taste-before-plate",
    category: "universal",
    outputType: "watch_for",
    applicability: {},
    rationale: "Final seasoning adjustment prevents underseasoned dish",
    priority: 6,
    text: "Taste and adjust seasoning just before plating — heat changes how salt registers.",
    stepHint: "last",
  },
  {
    id: "universal-hot-pan-first",
    category: "universal",
    outputType: "watch_for",
    applicability: { methods: ["sear", "saute", "stir-fry", "stir_fry"] },
    rationale: "Cold pan leads to sticking and steaming",
    priority: 9,
    text: "Get the pan properly hot before adding oil or protein. If oil shimmers immediately on contact, the pan is ready.",
    stepHint: 0,
  },
  {
    id: "universal-rest-protein",
    category: "universal",
    outputType: "watch_for",
    applicability: { roles: ["protein"] },
    rationale: "Resting redistributes juices",
    priority: 7,
    text: "Rest protein 3–5 minutes off heat before slicing. Cutting too early loses the juices you worked for.",
    stepHint: "last",
  },
  {
    id: "universal-acid-finish",
    category: "finish",
    outputType: "finish_guidance",
    applicability: { roles: ["acid"] },
    rationale: "Acid brightens and lifts finished dishes",
    priority: 5,
    text: "A small squeeze of acid (lemon, vinegar) just before serving lifts the whole dish and sharpens flavours.",
    stepHint: "last",
  },
];

// ---------------------------------------------------------------------------
// Family-specific rules
// ---------------------------------------------------------------------------

const SKILLET_SAUTE_RULES: CoachRule[] = [
  {
    id: "skillet-fond-secret",
    category: "family_specific",
    outputType: "chef_secret",
    applicability: { families: ["skillet_saute"] },
    rationale: "Fond is concentrated flavour",
    priority: 10,
    text: "Don't discard the fond — those browned bits on the pan floor are pure concentrated flavour. Deglaze with wine, stock, or even water to pick them up.",
  },
  {
    id: "skillet-pan-temp-watch",
    category: "watch_for",
    outputType: "watch_for",
    applicability: { families: ["skillet_saute"] },
    rationale: "Correct heat prevents steaming",
    priority: 9,
    text: "Watch for a steady sizzle when protein hits the pan. A weak sizzle means pan is too cold — protein will steam and stick.",
    stepHint: 0,
  },
  {
    id: "skillet-crowding-mistake",
    category: "mistake_prevention",
    outputType: "mistake_prevention",
    applicability: { families: ["skillet_saute"] },
    rationale: "Overcrowding drops pan temp",
    priority: 8,
    text: "Don't crowd the pan. Pieces touching each other trap steam and prevent browning. Cook in batches if needed.",
  },
  {
    id: "skillet-sauce-finish",
    category: "finish",
    outputType: "finish_guidance",
    applicability: { families: ["skillet_saute"] },
    rationale: "Sauce should coat, not pool",
    priority: 5,
    text: "Sauce should lightly coat the back of a spoon before tossing protein back in. Too thin means more reduction; too thick, a splash of stock.",
    stepHint: "last",
  },
];

const PASTA_RULES: CoachRule[] = [
  {
    id: "pasta-salt-water",
    category: "family_specific",
    outputType: "chef_secret",
    applicability: { families: ["pasta"] },
    rationale: "Pasta water is the only chance to season the pasta itself",
    priority: 10,
    text: "Season your pasta water aggressively — it should taste noticeably salty. This is the only chance to season the pasta from the inside.",
    stepHint: 0,
  },
  {
    id: "pasta-starchy-water",
    category: "family_specific",
    outputType: "chef_secret",
    applicability: { families: ["pasta"] },
    rationale: "Starchy water emulsifies sauce",
    priority: 9,
    text: "Reserve a cup of pasta cooking water before draining. Starch in the water helps sauce cling to pasta and prevents clumping.",
  },
  {
    id: "pasta-al-dente-watch",
    category: "watch_for",
    outputType: "watch_for",
    applicability: { families: ["pasta"] },
    rationale: "Overcooking is irreversible",
    priority: 8,
    text: "Start tasting pasta 2 minutes before the package time. Al dente means slight resistance at the centre — not crunchy, not soft.",
  },
  {
    id: "pasta-rinse-mistake",
    category: "mistake_prevention",
    outputType: "mistake_prevention",
    applicability: { families: ["pasta"] },
    rationale: "Rinsing washes away the starch that binds sauce to pasta",
    priority: 8,
    text: "Never rinse pasta after draining. Rinsing washes away surface starch — that starch is what makes sauce cling to every strand.",
  },
  {
    id: "pasta-sauce-finish",
    category: "finish",
    outputType: "finish_guidance",
    applicability: { families: ["pasta"] },
    rationale: "Pasta finishes in sauce",
    priority: 7,
    text: "Toss drained pasta directly in the sauce over low heat for 30–60 seconds. This is where the starch glues everything together.",
    stepHint: "last",
  },
];

const SOUPS_STEWS_RULES: CoachRule[] = [
  {
    id: "soups-layer-seasoning",
    category: "family_specific",
    outputType: "chef_secret",
    applicability: { families: ["soups_stews"] },
    rationale: "Seasoning in layers builds depth",
    priority: 10,
    text: "Season at each stage — when you add aromatics, after adding liquid, and before serving. Seasoning only at the end produces flat depth.",
  },
  {
    id: "soups-low-slow-watch",
    category: "watch_for",
    outputType: "watch_for",
    applicability: { families: ["soups_stews"] },
    rationale: "Hard boil breaks down proteins and emulsifies fat",
    priority: 9,
    text: "Once simmering, reduce to a gentle bubble. A hard boil makes broth cloudy and toughens protein.",
  },
  {
    id: "soups-skim-mistake",
    category: "mistake_prevention",
    outputType: "mistake_prevention",
    applicability: { families: ["soups_stews"] },
    rationale: "Skim foam for clean flavour",
    priority: 7,
    text: "Skim grey foam from the surface in the first 10 minutes of simmering. That foam is coagulated protein and produces off-flavours.",
  },
  {
    id: "soups-acid-finish",
    category: "finish",
    outputType: "finish_guidance",
    applicability: { families: ["soups_stews"] },
    rationale: "Acid brightens long-cooked flavours",
    priority: 6,
    text: "A small splash of vinegar or squeeze of lemon added off heat brightens a long-simmered soup or stew dramatically.",
    stepHint: "last",
  },
];

const SHEET_PAN_RULES: CoachRule[] = [
  {
    id: "sheet-pan-spacing",
    category: "family_specific",
    outputType: "chef_secret",
    applicability: { families: ["sheet_pan"] },
    rationale: "Space is required for roasting not steaming",
    priority: 10,
    text: "Give every piece space on the pan — at least a finger-width gap. Crowded vegetables steam and go soft instead of roasting and caramelising.",
  },
  {
    id: "sheet-pan-preheat",
    category: "watch_for",
    outputType: "watch_for",
    applicability: { families: ["sheet_pan"] },
    rationale: "Hot pan starts caramelisation immediately",
    priority: 9,
    text: "Preheat the pan in the oven before adding food. Placing cold food on a cold pan delays browning and produces soggy undersides.",
    stepHint: 0,
  },
  {
    id: "sheet-pan-fat-coating",
    category: "mistake_prevention",
    outputType: "mistake_prevention",
    applicability: { families: ["sheet_pan"] },
    rationale: "Fat must coat every surface",
    priority: 8,
    text: "Toss everything with oil until every cut surface is coated — not just drizzled on top. Bare surfaces dry out and stick.",
  },
  {
    id: "sheet-pan-dense-first",
    category: "watch_for",
    outputType: "watch_for",
    applicability: { families: ["sheet_pan"] },
    rationale: "Dense vegetables need a head start",
    priority: 7,
    text: "Add dense vegetables (potatoes, carrots, beets) first and delicate ones (asparagus, cherry tomatoes) in the last 10–15 minutes.",
  },
];

const CHICKEN_DINNERS_RULES: CoachRule[] = [
  {
    id: "chicken-temp-target",
    category: "family_specific",
    outputType: "chef_secret",
    applicability: { families: ["chicken_dinners"] },
    rationale: "Temperature is the definitive doneness signal",
    priority: 10,
    text: "Pull chicken at 74°C / 165°F internal — not by colour alone. Pink near bone doesn't mean undercooked; translucent juices at the thickest point do.",
  },
  {
    id: "chicken-dry-brine",
    category: "family_specific",
    outputType: "chef_secret",
    applicability: { families: ["chicken_dinners"] },
    rationale: "Dry brining draws moisture out then back in",
    priority: 9,
    text: "Salt chicken at least 30 minutes ahead — overnight is even better. Salt draws moisture out, then the protein reabsorbs it, seasoning from within.",
  },
  {
    id: "chicken-crispy-skin-watch",
    category: "watch_for",
    outputType: "watch_for",
    applicability: { families: ["chicken_dinners"] },
    rationale: "Skin rendering takes time",
    priority: 8,
    text: "Resist moving skin-on chicken too early. Skin sticks until it has rendered enough fat to release naturally — usually 4–5 minutes undisturbed.",
  },
  {
    id: "chicken-rest-mistake",
    category: "mistake_prevention",
    outputType: "mistake_prevention",
    applicability: { families: ["chicken_dinners"] },
    rationale: "Cutting hot releases all the juice",
    priority: 8,
    text: "Rest chicken at least 5 minutes before slicing — 10 for a whole breast. Cutting too early loses the juices that took the whole cook to build.",
  },
];

const RICE_GRAIN_BOWLS_RULES: CoachRule[] = [
  {
    id: "rice-rinse-secret",
    category: "family_specific",
    outputType: "chef_secret",
    applicability: { families: ["rice_grain_bowls"] },
    rationale: "Rinsing removes surface starch",
    priority: 9,
    text: "Rinse rice until water runs mostly clear before cooking. Surface starch makes grains clump and turn gummy rather than fluffy and separate.",
    stepHint: 0,
  },
  {
    id: "rice-steam-watch",
    category: "watch_for",
    outputType: "watch_for",
    applicability: { families: ["rice_grain_bowls"] },
    rationale: "Steam cooks the top layer after liquid is absorbed",
    priority: 9,
    text: "Once the water is absorbed, keep lid on and reduce to lowest heat for 10 minutes. The steam in the pot finishes the top layer without burning.",
  },
  {
    id: "rice-fluff-finish",
    category: "finish",
    outputType: "finish_guidance",
    applicability: { families: ["rice_grain_bowls"] },
    rationale: "Fluffing separates grains and releases steam",
    priority: 7,
    text: "Fluff rice with a fork 5 minutes after removing from heat — not a spoon, which compresses grains. This separates and lightens the texture.",
    stepHint: "last",
  },
  {
    id: "rice-lift-lid-mistake",
    category: "mistake_prevention",
    outputType: "mistake_prevention",
    applicability: { families: ["rice_grain_bowls"] },
    rationale: "Steam is what cooks the top layer",
    priority: 8,
    text: "Don't lift the lid while rice is steaming. Every peek releases the steam that's cooking the top layer and can result in undercooked, uneven grains.",
  },
  {
    id: "rice-bowl-build-order",
    category: "family_specific",
    outputType: "watch_for",
    applicability: { families: ["rice_grain_bowls"] },
    rationale: "Warm base absorbs sauce; cold toppings add contrast",
    priority: 6,
    text: "Build the bowl with warm grain base, then warm protein, then cold or room-temperature toppings last. Temperature contrast is part of the eating experience.",
    stepHint: "last",
  },
];

const ROASTED_VEGETABLES_RULES: CoachRule[] = [
  {
    id: "roasted-veg-high-heat",
    category: "family_specific",
    outputType: "chef_secret",
    applicability: { families: ["roasted_vegetables"] },
    rationale: "High heat is required for caramelisation",
    priority: 10,
    text: "Roast at high heat (200°C+ / 400°F+). Lower temperatures produce soft, steamed vegetables rather than the caramelised, slightly-charred edges you're after.",
  },
  {
    id: "roasted-veg-cut-size",
    category: "mistake_prevention",
    outputType: "mistake_prevention",
    applicability: { families: ["roasted_vegetables"] },
    rationale: "Inconsistent sizes cook unevenly",
    priority: 8,
    text: "Cut vegetables to consistent sizes — pieces within 1–2cm of each other in thickness. Uneven cuts mean some pieces overcook while others are still raw.",
  },
  {
    id: "roasted-veg-dont-stir",
    category: "watch_for",
    outputType: "watch_for",
    applicability: { families: ["roasted_vegetables"] },
    rationale: "Contact with hot pan builds the crust",
    priority: 7,
    text: "Resist stirring for at least the first half of cooking time. Contact with the hot pan surface builds caramelisation — moving them constantly prevents browning.",
  },
  {
    id: "roasted-veg-fresh-herb-finish",
    category: "finish",
    outputType: "finish_guidance",
    applicability: { families: ["roasted_vegetables"] },
    rationale: "Fresh herbs added hot wilt and lose colour",
    priority: 6,
    text: "Add delicate fresh herbs (parsley, basil, chives) after roasting comes off the heat, not before. Heat destroys their colour and volatises their flavour.",
    stepHint: "last",
  },
];

const BAKED_CASSEROLES_RULES: CoachRule[] = [
  {
    id: "casserole-rest-secret",
    category: "family_specific",
    outputType: "chef_secret",
    applicability: { families: ["baked_casseroles"] },
    rationale: "Resting allows the centre to set",
    priority: 10,
    text: "Rest the casserole 10 minutes before cutting and serving. The centre continues to set as it cools — cutting too soon produces a runny, collapsing slice.",
    stepHint: "last",
  },
  {
    id: "casserole-cover-uncover",
    category: "watch_for",
    outputType: "watch_for",
    applicability: { families: ["baked_casseroles"] },
    rationale: "Cover traps moisture; uncover crisps top",
    priority: 9,
    text: "Bake covered for the first two-thirds of cooking time to keep moisture in, then remove the cover for the final third to crisp and brown the top.",
  },
  {
    id: "casserole-centre-temp",
    category: "watch_for",
    outputType: "watch_for",
    applicability: { families: ["baked_casseroles"] },
    rationale: "Edge bubbling doesn't mean centre is cooked",
    priority: 8,
    text: "Bubbling around the edges doesn't mean the centre is done. Test with a probe — the centre should read 74°C / 165°F or feel set with no liquid jiggle.",
  },
  {
    id: "casserole-layers-mistake",
    category: "mistake_prevention",
    outputType: "mistake_prevention",
    applicability: { families: ["baked_casseroles"] },
    rationale: "Even layers cook more uniformly",
    priority: 7,
    text: "Press layers down evenly when assembling. Air pockets between layers dry out and create uneven cooking — the surface overcooks before the interior is done.",
  },
];

// ---------------------------------------------------------------------------
// Family rule registry
// ---------------------------------------------------------------------------

const FAMILY_RULE_MAP: Record<string, CoachRule[]> = {
  skillet_saute: SKILLET_SAUTE_RULES,
  pasta: PASTA_RULES,
  soups_stews: SOUPS_STEWS_RULES,
  sheet_pan: SHEET_PAN_RULES,
  chicken_dinners: CHICKEN_DINNERS_RULES,
  rice_grain_bowls: RICE_GRAIN_BOWLS_RULES,
  roasted_vegetables: ROASTED_VEGETABLES_RULES,
  baked_casseroles: BAKED_CASSEROLES_RULES,
};

/**
 * Returns all coaching rules applicable to the given family:
 * family-specific rules + universal rules.
 * Falls back to universal rules only for unrecognised families
 * (conservative — does not produce fake expertise).
 */
export function getFamilyCoachRules(family: string): CoachRule[] {
  const familyRules = FAMILY_RULE_MAP[family] ?? [];
  return [...UNIVERSAL_COACH_RULES, ...familyRules];
}

export const LAUNCH_COACHING_FAMILY_KEYS = Object.keys(FAMILY_RULE_MAP) as Array<
  keyof typeof FAMILY_RULE_MAP
>;
