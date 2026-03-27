import type { ChefRuleType, ChefEditAction } from "./chefIntelligence";

export type ChefRuleRecord = {
  id: string;
  ruleKey: string;
  title: string;
  category: string;
  subcategory: string | null;
  layer: "foundation" | "technique" | "ingredient" | "dish" | "risk" | "upgrade";
  triggerConditions: Record<string, boolean | string | string[]>;
  exclusionConditions: Record<string, boolean | string | string[]>;
  ruleType: ChefRuleType;
  severity: "low" | "medium" | "high" | "critical";
  userExplanation: string;
  failureIfMissing: string | null;
  actionType: ChefEditAction["type"] | null;
  actionPayloadTemplate: Record<string, unknown> | null;
  expectedScoreImpact: number;
  confidence: number;
  applicability: "broad" | "conditional" | "niche";
  priority: number;
};

export type ChefFixStrategyRecord = {
  issueKey: string;
  category: "reliability" | "quality" | "teaching";
  title: string;
  description: string;
  expectedScoreImpact: number;
  priority: number;
  actions: ChefEditAction[];
};

export type ChefExpectedRuleRecord = {
  category: string;
  key: string;
  description: string;
  bucket: "flavor" | "technique" | "texture" | "harmony" | "clarity" | "risk" | "extras";
  impact: number;
};

export type ChefScoreProfileRecord = {
  recipeCategory: string;
  flavorWeight: number;
  techniqueWeight: number;
  textureWeight: number;
  harmonyWeight: number;
  clarityWeight: number;
  riskWeight: number;
  extrasWeight: number;
};

function rule(
  id: number,
  title: string,
  category: string,
  triggerConditions: Record<string, boolean | string | string[]>,
  ruleType: ChefRuleType,
  ruleText: string,
  priority = ruleType === "mandatory" ? 3 : ruleType === "warning" ? 4 : 2,
  meta?: Partial<Omit<ChefRuleRecord, "id" | "title" | "category" | "triggerConditions" | "ruleType" | "userExplanation" | "priority">>
): ChefRuleRecord {
  const [topLevelCategory, subcategory] = category.split(".", 2);
  const inferredLayer =
    meta?.layer ??
    (topLevelCategory === "universal"
      ? "foundation"
      : topLevelCategory === "baking" || topLevelCategory === "protein" || topLevelCategory === "flavor" || topLevelCategory === "sauce" || topLevelCategory === "grilling"
      ? "technique"
      : topLevelCategory === "special"
      ? "risk"
      : "dish");
  return {
    id: `chef-rule-${id}`,
    ruleKey: meta?.ruleKey ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
    title,
    category: topLevelCategory,
    subcategory: meta?.subcategory ?? subcategory ?? null,
    layer: inferredLayer,
    triggerConditions,
    exclusionConditions: meta?.exclusionConditions ?? {},
    ruleType,
    severity:
      meta?.severity ??
      (ruleType === "warning" ? "high" : ruleType === "mandatory" ? "high" : "medium"),
    userExplanation: ruleText,
    failureIfMissing: meta?.failureIfMissing ?? null,
    actionType: meta?.actionType ?? null,
    actionPayloadTemplate: meta?.actionPayloadTemplate ?? null,
    expectedScoreImpact: meta?.expectedScoreImpact ?? (ruleType === "mandatory" ? 5 : ruleType === "warning" ? 4 : 3),
    confidence: meta?.confidence ?? 0.85,
    applicability: meta?.applicability ?? (Object.keys(triggerConditions).length === 1 && triggerConditions.always === true ? "broad" : "conditional"),
    priority,
  };
}

export const CHEF_RULES_SEED: ChefRuleRecord[] = [
  rule(1, "Taste as you cook", "universal", { always: true }, "mandatory", "Taste as you cook so seasoning and balance stay under control."),
  rule(2, "Season in layers", "universal", { always: true }, "mandatory", "Season in layers instead of dumping all the salt in at the end."),
  rule(3, "Mise en place", "universal", { always: true }, "mandatory", "Prep your ingredients before heat is involved so timing stays manageable."),
  rule(4, "Sharp knives matter", "universal", { always: true }, "recommended", "A sharp knife gives cleaner cuts, faster prep, and more even cooking."),
  rule(5, "Do not overcrowd searing surfaces", "universal", { usesSearMethod: true }, "mandatory", "Do not overcrowd the pan or you will steam instead of brown."),
  rule(6, "Let food release naturally", "universal", { usesSearMethod: true }, "recommended", "Let the surface release naturally before flipping so browning can develop."),
  rule(7, "Control heat", "universal", { always: true }, "mandatory", "Control the heat instead of defaulting to high."),
  rule(8, "Fix flat flavor with acid", "universal", { always: true }, "recommended", "If a dish tastes flat, acid is often the fastest way to wake it up."),
  rule(9, "Salt is structure", "universal", { always: true }, "mandatory", "Salt should build flavor, not just make the final bite salty."),
  rule(10, "Rest proteins", "protein", { isProtein: true }, "mandatory", "Rest cooked proteins before slicing so juices redistribute."),
  rule(11, "Dry before searing", "protein", { isProtein: true }, "mandatory", "Dry the surface before searing so you can brown instead of steam."),
  rule(12, "Preheat cookware", "universal", { usesSauteMethod: true }, "mandatory", "Preheat the pan before adding food so color develops quickly."),
  rule(13, "Match oil to heat", "universal", { usesHighHeat: true }, "mandatory", "Use a fat with the right smoke point for the heat level."),
  rule(14, "Too many ingredients can blur the dish", "universal", { hasHighIngredientCount: true }, "warning", "If too many ingredients compete, the dish can lose focus."),
  rule(15, "Clean as you go", "universal", { always: true }, "recommended", "Clean as you go so the cook stays calm and organized."),
  rule(16, "Read the recipe first", "universal", { always: true }, "mandatory", "Read the full recipe before you start cooking."),
  rule(17, "Final seasoning matters", "universal", { always: true }, "mandatory", "Check seasoning at the end after reduction and carryover change the flavor."),
  rule(18, "Rest dough when possible", "baking", { isDough: true }, "recommended", "Resting dough improves hydration and structure."),
  rule(19, "Temperature beats time", "universal", { always: true }, "mandatory", "Temperature and sensory cues matter more than the clock alone."),
  rule(20, "Use a thermometer when needed", "protein", { isProtein: true }, "recommended", "A thermometer removes guesswork from protein cooking."),
  rule(21, "Bake by weight when possible", "baking", { isBaking: true }, "mandatory", "Measure baking ingredients precisely, ideally by weight."),
  rule(22, "Preheat the oven fully", "baking", { isBaking: true }, "mandatory", "Do not start baking before the oven is fully preheated."),
  rule(23, "Avoid overmixing", "baking", { isBaking: true }, "mandatory", "Mix only until combined unless the method clearly calls for more."),
  rule(
    24,
    "Chill cookie dough",
    "baking.cookies",
    { isCookies: true },
    "recommended",
    "Chill cookie dough before baking for better texture and less spread.",
    2,
    {
      exclusionConditions: { isSourdough: true, isNonDairyBaking: true },
      actionType: "add_step",
      actionPayloadTemplate: { content: "Refrigerate the dough for 30 to 60 minutes before baking." },
    }
  ),
  rule(25, "Room-temperature ingredients", "baking", { isBaking: true }, "recommended", "Room-temperature ingredients combine more evenly in many batters and doughs."),
  rule(26, "Correct pan size", "baking", { isBaking: true }, "mandatory", "Use the intended pan size so time and texture stay predictable."),
  rule(27, "Rotate pans", "baking", { isBaking: true }, "recommended", "Rotate pans if your oven browns unevenly."),
  rule(28, "Do not open the oven early", "baking", { isBaking: true }, "mandatory", "Avoid opening the oven too early or fragile bakes can collapse."),
  rule(29, "Sift when needed", "baking", { isBaking: true }, "recommended", "Sift dry ingredients when clumping or delicate texture matters."),
  rule(30, "Weigh flour", "baking", { isBaking: true }, "mandatory", "Weigh flour instead of scooping it when accuracy matters."),
  rule(31, "Know hot spots", "baking", { isBaking: true }, "recommended", "Know your oven's hot spots and rotate if needed."),
  rule(32, "Use parchment", "baking", { isBaking: true }, "recommended", "Parchment improves release and makes browning more consistent."),
  rule(33, "Bake for color, not just time", "baking", { isBaking: true }, "mandatory", "Use color and structure cues, not only minutes, to judge doneness."),
  rule(34, "One variable at a time", "baking", { isBaking: true }, "warning", "Changing too many baking variables at once makes failures hard to diagnose."),
  rule(35, "Cool properly", "baking", { isBaking: true }, "mandatory", "Cooling is part of the bake because structure continues to set."),
  rule(36, "Salt supports sweetness", "baking", { isBaking: true }, "recommended", "Salt sharpens sweetness and prevents desserts from tasting flat."),
  rule(37, "Fresh leaveners", "baking", { isBaking: true }, "mandatory", "Old baking soda and baking powder quietly ruin results."),
  rule(38, "Do not overbake", "baking", { isBaking: true }, "mandatory", "Pull baked goods when they are done, not when they look dried out."),
  rule(39, "Hydration shapes texture", "baking", { isBaking: true }, "recommended", "Hydration changes chew, spread, and crumb more than many cooks expect."),
  rule(40, "Gluten develops with rest", "baking", { isDough: true }, "recommended", "Resting dough helps gluten and hydration settle."),
  rule(41, "Fat temperature matters", "baking", { isBaking: true }, "mandatory", "The state of the fat changes spread, aeration, and tenderness."),
  rule(42, "Cream butter and sugar correctly", "baking", { usesCreamingMethod: true }, "mandatory", "Cream butter and sugar long enough to build structure."),
  rule(43, "Avoid blind substitutions", "baking", { isBaking: true }, "warning", "Substitutions in baking need method and ratio awareness."),
  rule(44, "Internal cues decide doneness", "baking", { isBaking: true }, "mandatory", "Look for structure, color, and texture cues before trusting time."),
  rule(45, "Ratios are chemistry", "baking", { isBaking: true }, "mandatory", "Baking works because ratios hold together."),
  rule(46, "Temper proteins before cooking", "protein", { isProtein: true }, "recommended", "Taking the chill off protein can help it cook more evenly."),
  rule(47, "Pat meat dry", "protein", { isProtein: true }, "mandatory", "Pat protein dry before high heat for better browning."),
  rule(48, "Do not move meat too early", "protein", { isProtein: true }, "mandatory", "Let browning happen before you start moving meat around."),
  rule(49, "Sear then manage heat", "protein", { isProtein: true }, "mandatory", "Use strong initial heat for color, then lower it if needed to finish gently."),
  rule(50, "Rest before slicing", "protein", { isProtein: true }, "mandatory", "Rest before slicing so juices stay in the meat."),
  rule(51, "Slice against the grain", "protein", { isProtein: true }, "mandatory", "Slice against the grain when tenderness matters."),
  rule(52, "Thermometer beats guessing", "protein", { isProtein: true }, "mandatory", "Use a thermometer instead of guessing doneness."),
  rule(53, "Season early", "protein", { isProtein: true }, "mandatory", "Season protein before cooking so the surface is not bland."),
  rule(54, "Do not crowd browning pans", "protein", { isProtein: true }, "mandatory", "Crowding the pan kills the sear."),
  rule(55, "Use carryover cooking", "protein", { isProtein: true }, "recommended", "Carryover heat keeps cooking after the pan or oven is gone."),
  rule(56, "Fat carries flavor", "protein", { isProtein: true }, "recommended", "A little fat often carries flavor and improves perception of juiciness."),
  rule(57, "Marinate tougher cuts", "protein", { isProtein: true }, "recommended", "Use marinades or brines when the cut needs help."),
  rule(58, "Low and slow for tough cuts", "protein", { isToughCut: true }, "mandatory", "Tough cuts need time to soften."),
  rule(59, "Protect lean meats", "protein", { isLeanProtein: true }, "mandatory", "Lean proteins dry out quickly, so stop cooking precisely."),
  rule(60, "Chicken temp guidance", "protein.chicken", { isChicken: true }, "mandatory", "Chicken needs explicit internal temperature guidance for safety and texture."),
  rule(61, "Dry skin crisps", "protein", { hasSkinOnProtein: true }, "mandatory", "Dry skin crisps better than damp skin."),
  rule(62, "Oil the food for grilling", "grilling", { isGrilling: true }, "recommended", "For grilling, lightly oil the food instead of flooding the grates."),
  rule(63, "Rest redistributes juices", "protein", { isProtein: true }, "mandatory", "Resting gives meat time to reabsorb juices."),
  rule(64, "Gentler cooking avoids toughness", "protein", { isProtein: true }, "recommended", "Lower, steadier heat often prevents toughness."),
  rule(65, "Salt early for penetration", "protein", { isProtein: true }, "recommended", "Early salting penetrates better than last-second seasoning."),
  rule(66, "Balance salt fat acid heat", "flavor", { always: true }, "mandatory", "Think in salt, fat, acid, and heat so flavor stays balanced."),
  rule(67, "Brighten with acid near the end", "flavor", { always: true }, "recommended", "A finishing acid often restores life to a heavy or flat dish."),
  rule(68, "Finish herbs late", "flavor", { hasHerbs: true }, "recommended", "Delicate herbs are brighter when added near the end."),
  rule(69, "Toast spices", "flavor", { hasSpices: true }, "recommended", "Toasting spices deepens aroma and complexity."),
  rule(70, "Bloom spices in fat", "flavor", { hasSpices: true }, "recommended", "Bloom spices in fat so their flavor opens up."),
  rule(71, "Sweetness can tame acid", "flavor", { hasHighAcid: true }, "recommended", "A touch of sweetness can round off high acid."),
  rule(72, "Salt can reduce bitterness", "flavor", { always: true }, "recommended", "A little salt often softens bitterness."),
  rule(73, "Umami builds depth", "flavor", { always: true }, "recommended", "Depth often comes from umami rather than more salt alone."),
  rule(74, "Layer flavors", "flavor", { always: true }, "mandatory", "Layer flavor over time instead of dumping everything in at once."),
  rule(75, "Taste after major changes", "flavor", { always: true }, "mandatory", "Taste after every major step or seasoning change."),
  rule(76, "Reduce sauces enough", "sauce", { isSauce: true }, "mandatory", "Sauces need enough reduction to develop body and concentration."),
  rule(77, "Fat carries flavor everywhere", "flavor", { always: true }, "recommended", "Flavor perception changes when there is enough fat to carry aroma."),
  rule(78, "Fresh ingredients beat clutter", "flavor", { always: true }, "mandatory", "Freshness matters more than adding extra ingredients."),
  rule(79, "Use texture contrast", "flavor", { always: true }, "recommended", "Texture contrast makes food feel more complete."),
  rule(80, "Finish with salt or acid", "flavor", { always: true }, "mandatory", "Final salt or acid often separates a finished dish from a dull one."),
  rule(
    81,
    "Cookie structure needs cold dough",
    "special.cookies",
    { isCookies: true, isSourdough: true },
    "mandatory",
    "Cookies that are prone to spread should be baked from chilled dough.",
    3,
    {
      actionType: "add_step",
      actionPayloadTemplate: { content: "Refrigerate the dough for 30 to 60 minutes before baking." },
      failureIfMissing: "Cookies spread too thin and lose texture.",
      severity: "critical",
    }
  ),
  rule(
    82,
    "Non-dairy fats spread faster",
    "special.non_dairy_baking",
    { isNonDairyBaking: true },
    "mandatory",
    "Non-dairy fats melt faster than butter, so cold dough matters more.",
    3,
    {
      actionType: "add_note",
      actionPayloadTemplate: { content: "Non-dairy fats soften quickly, so keep the dough cold and bake on parchment for better structure." },
      failureIfMissing: "Cookies spread excessively and bake up greasy or thin.",
      severity: "critical",
    }
  ),
  rule(83, "Balance sourdough acidity", "special.sourdough", { isSourdough: true }, "recommended", "Sourdough discard adds acidity and benefits from deliberate balancing."),
  rule(84, "Do not boil low-fat dairy", "special.dairy", { usesLowFatDairy: true }, "mandatory", "Low-fat dairy can split when boiled aggressively."),
  rule(85, "Starch stabilizes sauces", "special.sauce", { isSauce: true }, "recommended", "Starch can stabilize a sauce that wants to break."),
  rule(86, "Finish pasta in sauce", "special.pasta", { isPasta: true }, "mandatory", "Finish pasta in the sauce so it emulsifies instead of sitting on top."),
  rule(87, "Reserve pasta water", "special.pasta", { isPasta: true }, "mandatory", "Pasta water is the easiest tool for emulsifying sauce."),
  rule(88, "Do not rinse pasta", "special.pasta", { isPasta: true }, "mandatory", "Do not rinse pasta unless the dish specifically needs it."),
  rule(89, "Preheat the grill", "special.grilling", { isGrilling: true }, "mandatory", "A fully preheated grill gives better release and browning."),
  rule(90, "Manage flare-ups", "special.grilling", { isGrilling: true }, "recommended", "Control flare-ups by managing excess fat and hot spots."),
  rule(91, "Use carryover in baking too", "special.baking", { isBaking: true }, "recommended", "Carryover heat matters in baking, especially with cookies and bars."),
  rule(92, "Let sauces settle briefly", "special.sauce", { isSauce: true }, "recommended", "A short rest helps sauces thicken and flavors settle."),
  rule(93, "Parchment improves consistency", "special.baking", { isBaking: true }, "recommended", "Parchment removes a lot of unnecessary baking variance."),
  rule(94, "Hydrate grains properly", "special.grains", { isGrains: true }, "mandatory", "Grains need the right liquid and a proper rest to finish well."),
  rule(95, "Rinse rice when appropriate", "special.rice", { isRice: true }, "recommended", "Rinsing rice can improve final texture when separate grains matter."),
  rule(96, "Toast rice for flavor", "special.rice", { isRice: true }, "recommended", "Toasting rice before adding liquid adds depth."),
  rule(97, "Do not stir risotto nonstop", "special.risotto", { isRisotto: true }, "recommended", "Constant risotto stirring is less important than steady liquid management."),
  rule(98, "Finish some sauces with butter", "special.finish", { isSauce: true }, "recommended", "A butter finish can round out texture and shine when the dish allows it."),
  rule(99, "Acid revives flat dishes", "special.flavor_fix", { always: true }, "mandatory", "When a dish tastes flat, try acid before piling on more salt."),
  rule(100, "Simplicity wins", "special.universal", { always: true }, "mandatory", "A simpler, coherent dish usually beats a cluttered one."),
  rule(101, "Butter contains water", "ingredient.fat", { hasButter: true }, "recommended", "Butter carries water as well as fat, so it changes browning and texture compared with pure fats.", 2, { layer: "ingredient", severity: "medium" }),
  rule(102, "Brown sugar adds moisture", "ingredient.sugar", { hasBrownSugar: true }, "recommended", "Brown sugar holds more moisture and pushes baked goods toward chew and softness.", 2, { layer: "ingredient", severity: "medium" }),
  rule(103, "Flour protein affects structure", "ingredient.flour", { hasFlour: true }, "mandatory", "Flour choice changes structure, chew, and tenderness more than most substitutions do.", 3, { layer: "ingredient", severity: "high" }),
  rule(104, "Eggs provide structure and binding", "ingredient.egg", { hasEgg: true }, "recommended", "Eggs add structure, moisture, and emulsification, so replacing them changes more than richness.", 2, { layer: "ingredient", severity: "medium" }),
  rule(105, "Frozen fruit releases extra water", "ingredient.fruit", { hasFrozenFruit: true }, "warning", "Frozen fruit sheds water into batters and fillings, which can leave baked goods gummy or underbaked.", 4, {
    layer: "ingredient",
    severity: "high",
    actionType: "add_note",
    actionPayloadTemplate: { content: "Frozen fruit releases moisture, so avoid overmixing and expect slightly longer bake time." },
    failureIfMissing: "The batter can bake up wet or uneven.",
  }),
  rule(106, "Mushrooms need time to shed moisture", "ingredient.vegetable", { hasMushrooms: true }, "mandatory", "Mushrooms release water before they brown, so the pan needs enough time and space to cook that moisture off.", 3, {
    layer: "ingredient",
    severity: "high",
    actionType: "add_note",
    actionPayloadTemplate: { content: "Cook the mushrooms until they release and then evaporate their moisture before expecting deep browning." },
  }),
  rule(107, "Garlic burns quickly", "ingredient.aromatic", { hasGarlic: true }, "warning", "Garlic turns bitter fast on aggressive heat, so add it after the pan has settled down or keep it moving.", 4, {
    layer: "ingredient",
    severity: "high",
    actionType: "add_note",
    actionPayloadTemplate: { content: "Add the garlic after the main browning step or lower the heat so it does not scorch." },
    failureIfMissing: "Burned garlic makes the dish bitter.",
  }),
  rule(108, "Cheese needs controlled heat", "ingredient.dairy", { hasCheese: true }, "warning", "Cheese can split or turn greasy when the heat stays too high, especially in sauces.", 4, {
    layer: "ingredient",
    severity: "high",
    actionType: "add_note",
    actionPayloadTemplate: { content: "Lower the heat before adding cheese so it melts smoothly instead of separating." },
    failureIfMissing: "The sauce can break or turn grainy.",
  }),
  rule(109, "Garlic is high-risk on high heat", "special.aromatic_risk", { hasGarlic: true, usesHighHeat: true }, "warning", "High heat plus garlic is a common bitterness trap unless timing is controlled carefully.", 4, {
    layer: "risk",
    severity: "high",
    actionType: "add_note",
    actionPayloadTemplate: { content: "If the pan is very hot, add the garlic later or pull the heat back before it goes in." },
  }),
  rule(110, "Sauces need a final seasoning check", "special.sauce_seasoning", { isSauce: true }, "recommended", "Sauces almost always need a final taste after reduction because salt and acid shift as they cook.", 2, {
    layer: "risk",
    severity: "medium",
    actionType: "add_note",
    actionPayloadTemplate: { content: "Taste the sauce at the end and adjust salt or acid before serving." },
  }),
  rule(111, "Lean proteins need carryover awareness", "protein", { isLeanProtein: true }, "recommended", "Lean proteins are easiest to overcook, so pull them with carryover in mind instead of chasing a perfect-looking exterior.", 2, {
    layer: "technique",
    severity: "medium",
    actionType: "add_note",
    actionPayloadTemplate: { content: "Pull lean proteins as soon as they hit target temperature because carryover will keep cooking them." },
  }),
  rule(112, "Skin-on proteins need rendering time", "protein", { hasSkinOnProtein: true }, "recommended", "Skin-on proteins usually need enough moderate heat up front to render fat before you chase deep color.", 2, {
    layer: "technique",
    severity: "medium",
    actionType: "add_note",
    actionPayloadTemplate: { content: "Give the skin side enough time to render and dry before pushing for maximum color." },
  }),
  rule(113, "Pasta sauces should finish glossy", "sauce.pasta_finish", { isPasta: true }, "recommended", "A pasta sauce should finish glossy and cling to the noodles instead of sitting loose underneath them.", 2, {
    layer: "dish",
    severity: "medium",
    actionType: "add_note",
    actionPayloadTemplate: { content: "Loosen the sauce only until it looks glossy and coats the pasta instead of pooling." },
  }),
  rule(114, "Cheese sauces tighten as they cool", "sauce.cheese_finish", { isSauce: true, hasCheese: true }, "recommended", "Cheese sauces tighten quickly as they cool, so finish them slightly looser than the final texture you want.", 2, {
    layer: "dish",
    severity: "medium",
    actionType: "add_note",
    actionPayloadTemplate: { content: "Stop the sauce while it is still slightly looser than you want because the cheese will tighten it as it sits." },
  }),
  rule(115, "Low-fat dairy sauces need very gentle heat", "sauce.low_fat_dairy", { isSauce: true, usesLowFatDairy: true }, "mandatory", "Low-fat dairy sauces should stay below a hard simmer if you want them smooth and stable.", 3, {
    layer: "risk",
    severity: "high",
    actionType: "add_note",
    actionPayloadTemplate: { content: "Keep low-fat dairy sauces on very gentle heat and avoid boiling once the dairy is in." },
    failureIfMissing: "The sauce can break or turn grainy.",
  }),
  rule(116, "High-heat mushrooms need space", "ingredient.mushroom_heat", { hasMushrooms: true, usesHighHeat: true }, "mandatory", "Mushrooms cooked over high heat need space in the pan or they steam before they ever brown.", 3, {
    layer: "ingredient",
    severity: "high",
    actionType: "add_note",
    actionPayloadTemplate: { content: "Spread the mushrooms out so high heat can evaporate moisture instead of trapping steam." },
    failureIfMissing: "The mushrooms stay pale and watery instead of browning.",
  }),
];

export const CHEF_EXPECTED_RULES_SEED: ChefExpectedRuleRecord[] = [
  { category: "cookies", key: "hasBakeTemperature", description: "Specify a bake temperature.", bucket: "clarity", impact: -3 },
  { category: "cookies", key: "hasDonenessCue", description: "Add a sensory doneness cue for cookies.", bucket: "technique", impact: -4 },
  { category: "cookies", key: "hasCoolingStep", description: "Include a cooling step so the cookies finish setting.", bucket: "texture", impact: -3 },
  { category: "cookies", key: "hasChillStep", description: "Add a chill step when the dough is spread-prone.", bucket: "technique", impact: -5 },
  { category: "cookies", key: "hasSaltIngredient", description: "Salt should be present to support sweetness and structure.", bucket: "flavor", impact: -2 },
  { category: "cookies", key: "hasFatBehaviorGuidance", description: "Call out how the fat behaves so texture is predictable.", bucket: "extras", impact: -3 },
  { category: "chicken", key: "hasInternalTempCue", description: "Add a specific internal temperature cue.", bucket: "risk", impact: -5 },
  { category: "chicken", key: "hasRestStep", description: "Include a rest step before slicing or serving.", bucket: "technique", impact: -4 },
  { category: "chicken", key: "hasDrySurfaceCue", description: "Tell the cook to dry the surface before roasting or searing.", bucket: "technique", impact: -3 },
  { category: "chicken", key: "hasSeasoningCue", description: "Seasoning should be explicit, not implied.", bucket: "flavor", impact: -2 },
  { category: "baking", key: "hasBakeTemperature", description: "Include a specific oven temperature.", bucket: "clarity", impact: -3 },
  { category: "baking", key: "hasCoolingStep", description: "Tell the cook how to cool the bake.", bucket: "texture", impact: -3 },
  { category: "baking", key: "hasFrozenFruitGuidance", description: "Call out frozen-fruit moisture behavior when using frozen fruit in a bake.", bucket: "texture", impact: -2 },
  { category: "protein", key: "hasRestStep", description: "Include a rest step to protect texture.", bucket: "technique", impact: -4 },
  { category: "protein", key: "hasInternalTempCue", description: "Use internal temperature guidance when relevant.", bucket: "risk", impact: -4 },
  { category: "sauce", key: "hasFinalSeasoningCue", description: "Taste and adjust a sauce right before serving.", bucket: "flavor", impact: -2 },
];

export const DEFAULT_CHEF_SCORE_PROFILES: ChefScoreProfileRecord[] = [
  { recipeCategory: "general", flavorWeight: 20, techniqueWeight: 20, textureWeight: 15, harmonyWeight: 15, clarityWeight: 10, riskWeight: 10, extrasWeight: 10 },
  { recipeCategory: "cookies", flavorWeight: 20, techniqueWeight: 20, textureWeight: 15, harmonyWeight: 15, clarityWeight: 10, riskWeight: 10, extrasWeight: 10 },
  { recipeCategory: "baking", flavorWeight: 20, techniqueWeight: 20, textureWeight: 15, harmonyWeight: 15, clarityWeight: 10, riskWeight: 10, extrasWeight: 10 },
  { recipeCategory: "protein", flavorWeight: 20, techniqueWeight: 20, textureWeight: 15, harmonyWeight: 15, clarityWeight: 10, riskWeight: 10, extrasWeight: 10 },
  { recipeCategory: "chicken", flavorWeight: 20, techniqueWeight: 20, textureWeight: 15, harmonyWeight: 15, clarityWeight: 10, riskWeight: 10, extrasWeight: 10 },
  { recipeCategory: "pasta", flavorWeight: 20, techniqueWeight: 20, textureWeight: 15, harmonyWeight: 15, clarityWeight: 10, riskWeight: 10, extrasWeight: 10 },
  { recipeCategory: "grains", flavorWeight: 20, techniqueWeight: 20, textureWeight: 15, harmonyWeight: 15, clarityWeight: 10, riskWeight: 10, extrasWeight: 10 },
  { recipeCategory: "sauce", flavorWeight: 20, techniqueWeight: 20, textureWeight: 15, harmonyWeight: 15, clarityWeight: 10, riskWeight: 10, extrasWeight: 10 },
];

export const CHEF_FIX_STRATEGIES_SEED: ChefFixStrategyRecord[] = [
  {
    issueKey: "cookie_chill_step_missing",
    category: "reliability",
    title: "Add a dough chilling step",
    description: "This reduces spread and makes texture more consistent.",
    expectedScoreImpact: 8,
    priority: 10,
    actions: [
      {
        type: "add_step",
        stepPosition: "before_baking",
        content: "Refrigerate the dough for 30 to 60 minutes before baking.",
        rationale: "Cold dough spreads less and bakes more evenly.",
      },
    ],
  },
  {
    issueKey: "vague_cookie_doneness",
    category: "teaching",
    title: "Add a clear doneness cue",
    description: "A sensory cue prevents overbaking and teaches the cook what to look for.",
    expectedScoreImpact: 5,
    priority: 8,
    actions: [
      {
        type: "insert_doneness_cue",
        content: "Bake until the edges are set and lightly golden while the centers still look slightly soft.",
        rationale: "The clock alone is not enough for reliable cookie texture.",
      },
    ],
  },
  {
    issueKey: "cookie_cooling_step_missing",
    category: "reliability",
    title: "Add a cooling step",
    description: "Cookies finish setting on the tray.",
    expectedScoreImpact: 4,
    priority: 6,
    actions: [
      {
        type: "add_step",
        stepPosition: "after_baking",
        content: "Let the cookies cool on the tray for 5 minutes before moving them to a rack.",
        rationale: "Cooling stabilizes the structure before handling.",
      },
    ],
  },
  {
    issueKey: "baking_cooling_step_missing",
    category: "reliability",
    title: "Add a bake cooling step",
    description: "Many bakes keep setting after they leave the oven and need a clear cooling instruction.",
    expectedScoreImpact: 4,
    priority: 6,
    actions: [
      {
        type: "add_step",
        stepPosition: "after_baking",
        content: "Let the bake cool in the pan or on a rack until set enough to handle cleanly.",
        rationale: "Cooling is part of the final texture, not just a holding period.",
      },
    ],
  },
  {
    issueKey: "non_dairy_spread_risk",
    category: "quality",
    title: "Call out non-dairy fat behavior",
    description: "Non-dairy fats soften quickly and need colder handling.",
    expectedScoreImpact: 4,
    priority: 7,
    actions: [
      {
        type: "add_note",
        content: "Non-dairy fats soften quickly, so keep the dough cold and bake on parchment for better structure.",
        rationale: "This warns the cook about the main spread risk.",
      },
    ],
  },
  {
    issueKey: "cookie_fat_behavior_guidance_missing",
    category: "teaching",
    title: "Explain cookie fat behavior",
    description: "The recipe should tell the cook how dough temperature affects spread and texture.",
    expectedScoreImpact: 3,
    priority: 5,
    actions: [
      {
        type: "add_note",
        content: "If the dough starts to soften while scooping, chill it again before baking so the cookies keep better structure.",
        rationale: "This teaches the cook how dough temperature affects spread.",
      },
    ],
  },
  {
    issueKey: "sourdough_balance_missing",
    category: "quality",
    title: "Balance the sourdough tang",
    description: "Sourdough discard varies in acidity and needs explicit balancing guidance.",
    expectedScoreImpact: 4,
    priority: 7,
    actions: [
      {
        type: "add_chef_insight",
        content: "If your discard tastes especially tangy, round it out with a touch more vanilla or a slight sugar increase.",
        rationale: "This helps the cook adapt to the acidity of their starter.",
      },
    ],
  },
  {
    issueKey: "protein_temp_guidance_missing",
    category: "reliability",
    title: "Add internal temperature guidance",
    description: "Specific temperature cues reduce safety and dryness mistakes.",
    expectedScoreImpact: 8,
    priority: 10,
    actions: [
      {
        type: "insert_doneness_cue",
        content: "Cook until the thickest part reaches the target internal temperature instead of relying on time alone.",
        rationale: "Temperature is the most reliable doneness check for protein.",
      },
    ],
  },
  {
    issueKey: "chicken_rest_step_missing",
    category: "reliability",
    title: "Add a rest step",
    description: "Resting keeps the protein juicier and easier to carve.",
    expectedScoreImpact: 6,
    priority: 8,
    actions: [
      {
        type: "insert_rest_time",
        content: "Rest for 10 minutes before carving so the juices stay in the meat.",
        rationale: "Resting improves texture and moisture retention.",
      },
    ],
  },
  {
    issueKey: "dry_surface_prep_missing",
    category: "reliability",
    title: "Dry the protein before cooking",
    description: "Dry surfaces brown better and crisp more easily.",
    expectedScoreImpact: 4,
    priority: 7,
    actions: [
      {
        type: "add_step",
        stepIndex: 0,
        content: "Pat the surface dry before seasoning and cooking.",
        rationale: "Moisture blocks browning and crisping.",
      },
    ],
  },
  {
    issueKey: "sauce_reduction_missing",
    category: "quality",
    title: "Reduce the sauce further",
    description: "Reduction concentrates flavor and improves body.",
    expectedScoreImpact: 5,
    priority: 7,
    actions: [
      {
        type: "add_note",
        content: "Simmer until the sauce coats the back of a spoon so it tastes concentrated instead of watery.",
        rationale: "Reduction gives the sauce enough body and intensity.",
      },
    ],
  },
  {
    issueKey: "acid_finish_missing",
    category: "quality",
    title: "Add a finishing acid cue",
    description: "A final acid note often fixes heaviness or flatness.",
    expectedScoreImpact: 4,
    priority: 6,
    actions: [
      {
        type: "add_note",
        content: "Taste before serving and add a squeeze of lemon or splash of vinegar if the dish needs brightness.",
        rationale: "A finishing acid can wake up a heavy or flat dish.",
      },
    ],
  },
  {
    issueKey: "pasta_water_missing",
    category: "reliability",
    title: "Reserve pasta water",
    description: "Pasta water is the simplest emulsifier for many sauces.",
    expectedScoreImpact: 5,
    priority: 7,
    actions: [
      {
        type: "add_step",
        stepPosition: "before_serving",
        content: "Reserve a cup of pasta water before draining and use it to loosen and emulsify the sauce.",
        rationale: "Starchy water helps the sauce cling instead of breaking.",
      },
    ],
  },
  {
    issueKey: "grain_rest_missing",
    category: "reliability",
    title: "Add a grain resting step",
    description: "Resting grains lets steam finish the texture evenly.",
    expectedScoreImpact: 4,
    priority: 6,
    actions: [
      {
        type: "insert_rest_time",
        content: "Cover and rest off the heat for 10 minutes before fluffing.",
        rationale: "The resting steam finishes hydration more evenly.",
      },
    ],
  },
  {
    issueKey: "storage_tip_missing",
    category: "teaching",
    title: "Add storage guidance",
    description: "Storage advice makes the recipe more usable beyond the first cook.",
    expectedScoreImpact: 3,
    priority: 4,
    actions: [
      {
        type: "insert_storage_tip",
        content: "Store leftovers in an airtight container and refresh gently before serving again.",
        rationale: "Storage guidance improves repeatability and confidence.",
      },
    ],
  },
  {
    issueKey: "make_ahead_tip_missing",
    category: "teaching",
    title: "Add a make-ahead note",
    description: "Make-ahead cues help users plan better and cook with less stress.",
    expectedScoreImpact: 3,
    priority: 4,
    actions: [
      {
        type: "insert_make_ahead_tip",
        content: "This can be prepped ahead so the final cook is faster and more controlled.",
        rationale: "Make-ahead guidance teaches planning, not just execution.",
      },
    ],
  },
  {
    issueKey: "frozen_fruit_moisture_missing",
    category: "reliability",
    title: "Add frozen-fruit moisture guidance",
    description: "Frozen fruit releases extra water and can leave the bake wet if the recipe does not account for it.",
    expectedScoreImpact: 4,
    priority: 7,
    actions: [
      {
        type: "add_note",
        content: "Frozen fruit releases extra moisture, so fold it in quickly, avoid thawing, and expect slightly longer bake time if needed.",
        rationale: "This helps the cook avoid gummy or underbaked centers.",
      },
    ],
  },
  {
    issueKey: "garlic_timing_control_missing",
    category: "reliability",
    title: "Control garlic timing",
    description: "Garlic can turn bitter on high heat unless the recipe tells the cook when to add it.",
    expectedScoreImpact: 4,
    priority: 7,
    actions: [
      {
        type: "add_note",
        content: "If the pan is very hot, add the garlic after the main browning step or lower the heat first so it does not scorch.",
        rationale: "This prevents the dish from turning bitter.",
      },
    ],
  },
  {
    issueKey: "cheese_heat_control_missing",
    category: "reliability",
    title: "Add cheese heat-control guidance",
    description: "Cheese sauces need lower heat to stay smooth instead of splitting.",
    expectedScoreImpact: 4,
    priority: 7,
    actions: [
      {
        type: "add_note",
        content: "Lower the heat before adding the cheese so it melts smoothly instead of separating.",
        rationale: "This reduces the risk of a grainy or broken sauce.",
      },
    ],
  },
  {
    issueKey: "mushroom_browning_guidance_missing",
    category: "quality",
    title: "Add mushroom browning guidance",
    description: "Mushrooms need to release and evaporate their moisture before they can actually brown.",
    expectedScoreImpact: 3,
    priority: 6,
    actions: [
      {
        type: "add_note",
        content: "Cook the mushrooms until they release and then evaporate their moisture before expecting deep browning.",
        rationale: "This improves texture and flavor concentration.",
      },
    ],
  },
  {
    issueKey: "sauce_final_seasoning_missing",
    category: "quality",
    title: "Add a final sauce seasoning check",
    description: "Sauces often need a last taste after reduction because balance shifts as they cook.",
    expectedScoreImpact: 3,
    priority: 6,
    actions: [
      {
        type: "add_note",
        content: "Taste the sauce right before serving and adjust salt or acid if it needs more balance.",
        rationale: "This catches flat or over-reduced flavor before the dish goes out.",
      },
    ],
  },
];
