/**
 * Static dish family rules for culinary validation and constrained generation.
 *
 * These rules are intentionally conservative.
 * They are meant to:
 * 1. guide ingredient planning
 * 2. validate generated recipes
 * 3. reduce implausible combinations like carrots in flan
 *
 * Important design notes:
 * - requiredClassGroups are OR-groups. At least one class in each group must exist.
 * - commonClasses are normal for the family
 * - optionalClasses are allowed but not expected
 * - suspiciousClasses are unusual and should usually fail in safe mode
 * - forbiddenClasses should hard-fail
 * - requiredMethods should usually all appear in the recipe steps
 * - optionalMethods improve confidence but are not mandatory
 */

export type RatioRule = {
  min: number;
  max: number;
};

export type DishFamilyRule = {
  key: string;
  displayName: string;
  /**
   * Lowercase strings that map to this family from dish_family or title hints.
   * Keep these short and practical.
   */
  aliases: string[];

  /**
   * OR-groups: at least one class in each group must be present.
   * Example:
   * [["egg"], ["dairy"], ["sweetener"]]
   * means the recipe must contain:
   * - at least one egg
   * - at least one dairy
   * - at least one sweetener
   */
  requiredClassGroups: string[][];

  /**
   * Classes that are common and strongly expected in this family.
   * Missing these should reduce confidence even if the recipe technically passes.
   */
  commonClasses: string[];

  /**
   * Classes that are allowed but not necessary.
   */
  optionalClasses: string[];

  /**
   * No ingredient in this list should appear in the recipe.
   */
  forbiddenClasses: string[];

  /**
   * Classes that are unusual for this family.
   * These should usually be rejected in safe mode unless explicitly requested.
   */
  suspiciousClasses: string[];

  /**
   * Step keywords that are strongly expected.
   * These are softer than requiredMethods.
   */
  expectedMethodKeywords: string[];

  /**
   * Methods that should usually appear in valid recipes for this family.
   * Treated as warnings until methodTag reliability is confirmed.
   */
  requiredMethods: string[];

  /**
   * Helpful but not mandatory methods.
   */
  optionalMethods: string[];

  /**
   * Ratio rules interpreted by ratioValidator.ts (not yet implemented).
   * Key names should stay stable across the app.
   */
  // Enforced by ratioValidator.ts (not yet implemented)
  ratioRules?: Record<string, RatioRule>;

  /**
   * Plain-English constraints injected into generation prompts.
   * Keep these short and imperative.
   */
  generationConstraints: string[];

  /**
   * Used by scoring and validator behavior.
   * high = less tolerance for weirdness
   * medium = balanced
   * low = more flexible family
   */
  strictness: "high" | "medium" | "low";

  /**
   * Maximum number of unusual but not forbidden ingredients tolerated.
   */
  maxUncommonIngredients: number;
};

const DISH_FAMILY_RULES: DishFamilyRule[] = [
  {
    key: "custard_flan",
    displayName: "Custard / Flan",
    aliases: [
      "custard",
      "flan",
      "crème brûlée",
      "creme brulee",
      "pots de crème",
      "pots de creme",
      "pudding custard",
      "baked custard",
    ],
    requiredClassGroups: [["egg"], ["dairy"], ["sweetener"]],
    commonClasses: ["liquid_base", "flavoring_extract"],
    optionalClasses: ["citrus_zest", "coffee", "spice_warm"],
    forbiddenClasses: [
      "flour_grain",
      "leavening",
      "starch",
      "soy_sauce",
      "hot_sauce_or_spicy",
      "leafy_green",
      "tomato_product",
    ],
    suspiciousClasses: [
      "protein_meat",
      "protein_fish",
      "allium",
      "vegetable",
      "savory_herb",
      "broth",
    ],
    expectedMethodKeywords: [
      "bake",
      "water bath",
      "bain-marie",
      "steam",
      "set",
      "chill",
      "strain",
      "caramel",
    ],
    requiredMethods: ["mix", "bake", "chill"],
    optionalMethods: ["strain", "steam", "unmold", "caramelize"],
    // Enforced by ratioValidator.ts (not yet implemented)
    ratioRules: {
      egg_to_liquid: { min: 0.12, max: 0.3 },
      sweetener_to_liquid: { min: 0.08, max: 0.35 },
    },
    generationConstraints: [
      "Must include eggs, dairy, and sweetener.",
      "No flour, starch, savory vegetables, or savory sauces.",
      "Use gentle heat and chill to set.",
      "Keep flavoring classic unless the user explicitly requests variation.",
    ],
    strictness: "high",
    maxUncommonIngredients: 1,
  },

  {
    key: "bread_pudding",
    displayName: "Bread Pudding",
    aliases: [
      "bread pudding",
      "banana bread pudding",
      "salted caramelized banana bread pudding",
      "croissant pudding",
      "panettone pudding",
      "brioche pudding",
      "challah pudding",
      "pain perdu",
    ],
    // flour_grain is the whole point — bread is the base
    requiredClassGroups: [["flour_grain"], ["egg"], ["dairy", "liquid_base"]],
    commonClasses: ["sweetener", "spice_warm", "fruit", "flavoring_extract"],
    optionalClasses: ["fat_oil", "salt", "nut", "dried_fruit", "chocolate"],
    forbiddenClasses: [
      "protein_fish",
      "soy_sauce",
      "hot_sauce_or_spicy",
      "leafy_green",
      "tomato_product",
    ],
    suspiciousClasses: ["allium", "protein_meat", "vegetable"],
    expectedMethodKeywords: ["soak", "bake", "custard", "rest", "set"],
    requiredMethods: ["soak"],
    optionalMethods: ["bake", "slow_cook", "caramelize", "rest", "mix"],
    generationConstraints: [
      "Must include bread or a baked flour-based base such as brioche, challah, croissant, or panettone.",
      "Must include a custard base with eggs and milk or cream.",
      "Bread must be torn or sliced and soaked in custard before baking or slow-cooking.",
      "flour_grain is required — bread pudding is a bread-based custard dessert, not a flourless custard.",
      "Slow cooker is allowed if the user requests it; custard texture must still be soft and set, not scrambled.",
      "Texture inside should be soft, creamy, and pudding-like.",
    ],
    strictness: "medium",
    maxUncommonIngredients: 2,
  },

  {
    key: "brownie",
    displayName: "Brownie",
    aliases: [
      "brownie",
      "brownies",
      "fudge brownie",
      "cakey brownie",
      "blondie brownie",
    ],
    requiredClassGroups: [["cocoa_or_chocolate"], ["fat_oil"], ["sweetener"]],
    commonClasses: ["egg", "flour_grain", "flavoring_extract"],
    optionalClasses: ["nut", "coffee", "spice_warm"],
    forbiddenClasses: [
      "protein_meat",
      "protein_fish",
      "allium",
      "soy_sauce",
      "tomato_product",
      "broth",
      "savory_herb",
    ],
    suspiciousClasses: ["leafy_green", "acid", "hot_sauce_or_spicy"],
    expectedMethodKeywords: ["bake", "melt", "mix", "fold", "cool"],
    requiredMethods: ["mix", "bake"],
    optionalMethods: ["melt", "fold", "cool", "slice"],
    // Enforced by ratioValidator.ts (not yet implemented)
    ratioRules: {
      flour_to_fat: { min: 0.4, max: 1.5 },
      sugar_to_flour: { min: 0.7, max: 2.0 },
    },
    generationConstraints: [
      "Must include chocolate or cocoa, fat, and sweetener.",
      "Eggs are strongly preferred unless this is explicitly vegan.",
      "No savory ingredients, alliums, or broth.",
      "Brownies should bake as a dense bar, not a frosted layer cake.",
    ],
    strictness: "high",
    maxUncommonIngredients: 1,
  },

  {
    key: "chocolate_cake",
    displayName: "Chocolate Cake",
    aliases: [
      "chocolate cake",
      "fudge cake",
      "layer cake",
      "sheet cake",
      "molten cake",
      "lava cake",
      "molten chocolate cake",
    ],
    requiredClassGroups: [["cocoa_or_chocolate"], ["flour_grain"], ["sweetener"], ["fat_oil"]],
    commonClasses: ["egg", "leavening", "liquid_base", "flavoring_extract"],
    optionalClasses: ["coffee", "dairy", "spice_warm"],
    forbiddenClasses: [
      "protein_meat",
      "protein_fish",
      "allium",
      "soy_sauce",
      "broth",
      "savory_herb",
    ],
    suspiciousClasses: ["tomato_product", "hot_sauce_or_spicy"],
    expectedMethodKeywords: ["bake", "whisk", "mix", "cool"],
    requiredMethods: ["mix", "bake"],
    optionalMethods: ["whisk", "cool", "fold"],
    // Enforced by ratioValidator.ts (not yet implemented)
    ratioRules: {
      flour_to_liquid: { min: 0.5, max: 1.6 },
      sugar_to_flour: { min: 0.7, max: 2.0 },
    },
    generationConstraints: [
      "Must include flour, fat, sweetener, and cocoa or chocolate.",
      "Leavening is expected unless this is a molten cake variant.",
      "No savory proteins, alliums, or broth.",
      "Primary method is baking.",
    ],
    strictness: "medium",
    maxUncommonIngredients: 2,
  },

  {
    key: "cookie",
    displayName: "Cookie",
    aliases: [
      "cookie",
      "cookies",
      "biscuit",
      "shortbread",
      "snickerdoodle",
      "oatmeal cookie",
      "chocolate chip cookie",
    ],
    requiredClassGroups: [["flour_grain"], ["fat_oil"], ["sweetener"]],
    commonClasses: ["flavoring_extract"],
    optionalClasses: ["egg", "leavening", "nut", "spice_warm"],
    forbiddenClasses: [
      "protein_meat",
      "protein_fish",
      "allium",
      "hot_sauce_or_spicy",
      "soy_sauce",
      "broth",
    ],
    suspiciousClasses: ["tomato_product", "savory_herb", "acid"],
    expectedMethodKeywords: ["bake", "cream", "fold", "chill", "scoop", "roll"],
    requiredMethods: ["mix", "bake"],
    optionalMethods: ["cream", "fold", "chill", "scoop", "roll"],
    // Enforced by ratioValidator.ts (not yet implemented)
    ratioRules: {
      flour_to_fat: { min: 1.0, max: 3.0 },
      sugar_to_flour: { min: 0.4, max: 1.5 },
    },
    generationConstraints: [
      "Must include flour, fat, and sweetener.",
      "No savory proteins, alliums, or savory sauces.",
      "Primary method is baking.",
      "Keep texture aligned with the cookie subtype.",
    ],
    strictness: "medium",
    maxUncommonIngredients: 2,
  },

  {
    key: "cheesecake",
    displayName: "Cheesecake",
    aliases: [
      "cheesecake",
      "cheese cake",
      "new york cheesecake",
      "no-bake cheesecake",
      "basque cheesecake",
    ],
    requiredClassGroups: [["dairy"], ["sweetener"]],
    commonClasses: ["egg", "fat_oil", "flavoring_extract"],
    optionalClasses: ["fruit", "spice_warm", "starch"],
    forbiddenClasses: [
      "protein_meat",
      "protein_fish",
      "allium",
      "soy_sauce",
      "tomato_product",
      "hot_sauce_or_spicy",
      "broth",
    ],
    suspiciousClasses: ["savory_herb", "legume"],
    expectedMethodKeywords: ["bake", "chill", "set", "blend", "beat", "cool"],
    requiredMethods: ["mix", "set"],
    optionalMethods: ["bake", "chill", "cool", "beat"],
    // Enforced by ratioValidator.ts (not yet implemented)
    ratioRules: {
      sweetener_to_dairy: { min: 0.1, max: 0.8 },
    },
    generationConstraints: [
      "Must include cream cheese or a clear dairy base plus sweetener.",
      "Eggs are expected for baked cheesecake and optional for no-bake versions.",
      "No savory proteins, alliums, or savory sauces.",
      "Method is baking or chilling to set.",
    ],
    strictness: "high",
    maxUncommonIngredients: 1,
  },

  {
    key: "muffin_quick_bread",
    displayName: "Muffin / Quick Bread",
    aliases: [
      "muffin",
      "muffins",
      "quick bread",
      "banana bread",
      "zucchini bread",
      "loaf cake",
      "tea loaf",
    ],
    requiredClassGroups: [["flour_grain"], ["leavening"], ["fat_oil", "egg", "dairy"]],
    commonClasses: ["sweetener", "liquid_base"],
    optionalClasses: ["fruit", "nut", "spice_warm", "cocoa_or_chocolate"],
    forbiddenClasses: [
      "protein_meat",
      "protein_fish",
      "allium",
      "hot_sauce_or_spicy",
      "soy_sauce",
      "broth",
    ],
    suspiciousClasses: ["savory_herb", "tomato_product"],
    expectedMethodKeywords: ["bake", "fold", "mix", "pour", "stir"],
    requiredMethods: ["mix", "bake"],
    optionalMethods: ["fold", "stir", "pour", "cool"],
    // Enforced by ratioValidator.ts (not yet implemented)
    ratioRules: {
      flour_to_liquid: { min: 0.8, max: 2.5 },
    },
    generationConstraints: [
      "Must include flour and leavening.",
      "Include eggs, fat, or dairy for structure and moisture.",
      "No savory proteins, alliums, or savory sauces.",
      "Do not overcomplicate technique. Quick breads should stay simple.",
    ],
    strictness: "medium",
    maxUncommonIngredients: 2,
  },

  {
    key: "pancake_waffle",
    displayName: "Pancake / Waffle",
    aliases: [
      "pancake",
      "pancakes",
      "waffle",
      "waffles",
      "crepe",
      "crêpe",
      "flapjack",
      "buttermilk pancake",
    ],
    requiredClassGroups: [["flour_grain"], ["liquid_base", "dairy"], ["egg", "leavening"]],
    commonClasses: ["fat_oil", "sweetener"],
    optionalClasses: ["fruit", "spice_warm", "flavoring_extract", "protein_meat"],
    forbiddenClasses: [
      "protein_fish",
      "allium",
      "soy_sauce",
      "broth",
      "tomato_product",
    ],
    suspiciousClasses: ["hot_sauce_or_spicy", "savory_herb", "starch"],
    expectedMethodKeywords: ["pour", "cook", "flip", "griddle", "waffle iron", "batter"],
    requiredMethods: ["mix", "cook"],
    optionalMethods: ["flip", "rest"],
    // Enforced by ratioValidator.ts (not yet implemented)
    ratioRules: {
      flour_to_liquid: { min: 0.5, max: 1.5 },
    },
    generationConstraints: [
      "Must include flour and a liquid base.",
      "Use eggs or leavening depending on the subtype.",
      "Savory add-ons are possible but should stay coherent.",
      "Method is griddle, pan, or waffle iron cooking.",
    ],
    strictness: "medium",
    maxUncommonIngredients: 2,
  },

  {
    key: "risotto",
    displayName: "Risotto",
    aliases: [
      "risotto",
      "arborio",
      "rice dish",
      "creamy rice",
      "mushroom risotto",
    ],
    requiredClassGroups: [["starch"], ["liquid_base"], ["fat_oil"]],
    commonClasses: ["allium", "dairy"],
    optionalClasses: ["acid", "protein_meat", "protein_fish", "protein_plant", "vegetable", "herb"],
    forbiddenClasses: [
      "flour_grain",
      "leavening",
      "cocoa_or_chocolate",
      "sweetener",
      "hot_sauce_or_spicy",
    ],
    suspiciousClasses: ["fruit"],
    expectedMethodKeywords: ["stir", "ladle", "simmer", "toast", "absorb", "saute", "sauté"],
    requiredMethods: ["toast", "stir", "simmer"],
    optionalMethods: ["ladle", "reduce", "rest"],
    // Enforced by ratioValidator.ts (not yet implemented)
    ratioRules: {
      liquid_to_rice: { min: 2.0, max: 5.0 },
    },
    generationConstraints: [
      "Must include risotto rice, liquid, and fat.",
      "Gradual liquid addition is expected.",
      "No flour, leavening, chocolate, or dessert-style sweetening.",
      "Texture should finish creamy, not dry and not soupy.",
    ],
    strictness: "high",
    maxUncommonIngredients: 1,
  },

  {
    key: "stir_fry",
    displayName: "Stir Fry",
    aliases: [
      "stir fry",
      "stir-fry",
      "stir fried",
      "wok",
      "wok fry",
    ],
    requiredClassGroups: [
      ["protein_meat", "protein_fish", "protein_plant", "vegetable"],
      ["fat_oil"],
      ["allium", "soy_sauce", "sauce_base"],
    ],
    commonClasses: ["vegetable", "acid"],
    optionalClasses: ["starch", "nut", "seed", "herb", "sweetener"],
    forbiddenClasses: ["leavening", "cocoa_or_chocolate", "custard_base", "icing"],
    suspiciousClasses: ["dairy", "flour_grain"],
    expectedMethodKeywords: ["stir", "fry", "wok", "high heat", "toss", "saute", "sauté"],
    requiredMethods: ["cook", "high_heat"],
    optionalMethods: ["toss", "saute"],
    generationConstraints: [
      "Must include a primary ingredient, oil, and a savory flavor base.",
      "Method is fast, high-heat cooking.",
      "Sweetness can appear in sauce but should stay restrained.",
      "Do not turn stir fry into a stew or baked dish.",
    ],
    strictness: "medium",
    maxUncommonIngredients: 3,
  },

  {
    key: "fried_rice",
    displayName: "Fried Rice",
    aliases: [
      "fried rice",
      "egg fried rice",
      "vegetable fried rice",
      "shrimp fried rice",
    ],
    requiredClassGroups: [["starch"], ["fat_oil"], ["allium", "soy_sauce", "sauce_base"]],
    commonClasses: ["egg", "vegetable"],
    optionalClasses: ["protein_meat", "protein_fish", "protein_plant", "acid", "herb"],
    forbiddenClasses: ["leavening", "cocoa_or_chocolate", "custard_base", "icing"],
    suspiciousClasses: ["dairy", "sweetener", "fruit"],
    expectedMethodKeywords: ["stir", "fry", "wok", "high heat", "toss"],
    requiredMethods: ["cook", "high_heat"],
    optionalMethods: ["toss", "scramble"],
    // Enforced by ratioValidator.ts (not yet implemented)
    ratioRules: {
      rice_to_mixins: { min: 0.8, max: 5.0 },
    },
    generationConstraints: [
      "Must include cooked rice, oil, and a savory flavor base.",
      "Use high heat and keep texture distinct, not mushy.",
      "Do not treat fried rice like risotto or soup.",
      "Sweet elements should be minimal unless explicitly requested.",
    ],
    strictness: "medium",
    maxUncommonIngredients: 2,
  },

  {
    key: "curry",
    displayName: "Curry",
    aliases: [
      "curry",
      "tikka masala",
      "korma",
      "vindaloo",
      "thai curry",
      "green curry",
      "red curry",
      "yellow curry",
    ],
    requiredClassGroups: [
      ["protein_meat", "protein_fish", "protein_plant", "vegetable"],
      ["liquid_base", "dairy", "tomato_product"],
      ["fat_oil"],
    ],
    commonClasses: ["allium", "spice_savory"],
    optionalClasses: ["acid", "sweetener", "herb", "legume"],
    forbiddenClasses: ["leavening", "cocoa_or_chocolate", "icing", "custard_base"],
    suspiciousClasses: ["flour_grain"],
    expectedMethodKeywords: ["simmer", "saute", "sauté", "bloom", "cook", "reduce"],
    requiredMethods: ["cook", "simmer"],
    optionalMethods: ["saute", "reduce"],
    // Enforced by ratioValidator.ts (not yet implemented)
    ratioRules: {
      liquid_to_primary: { min: 0.3, max: 3.0 },
    },
    generationConstraints: [
      "Must include a primary ingredient and a sauce base.",
      "Build flavor from aromatics and spices before simmering.",
      "Sweetness can be used carefully in some curry styles.",
      "Do not treat curry like a dry stir fry unless explicitly requested.",
    ],
    strictness: "medium",
    maxUncommonIngredients: 3,
  },

  {
    key: "pasta",
    displayName: "Pasta",
    aliases: [
      "pasta",
      "spaghetti",
      "penne",
      "fettuccine",
      "linguine",
      "tagliatelle",
      "rigatoni",
      "carbonara",
      "bolognese",
      "alfredo",
      "macaroni",
    ],
    requiredClassGroups: [["starch"], ["fat_oil", "dairy", "tomato_product", "sauce_base"]],
    commonClasses: ["allium"],
    optionalClasses: ["protein_meat", "protein_fish", "protein_plant", "vegetable", "dairy", "herb", "acid"],
    forbiddenClasses: ["leavening", "cocoa_or_chocolate", "icing", "custard_base"],
    suspiciousClasses: ["sweetener"],
    expectedMethodKeywords: ["boil", "cook", "toss", "sauce", "saute", "sauté", "simmer"],
    requiredMethods: ["boil", "combine"],
    optionalMethods: ["toss", "simmer", "saute"],
    // Enforced by ratioValidator.ts (not yet implemented)
    ratioRules: {
      sauce_to_pasta: { min: 0.25, max: 2.0 },
    },
    generationConstraints: [
      "Must include pasta and a sauce or coating component.",
      "Build the sauce around the subtype, such as tomato, oil, cheese, or cream.",
      "Sweetness should be minimal unless style-specific.",
      "Primary method is boiling pasta and finishing with sauce.",
    ],
    strictness: "medium",
    maxUncommonIngredients: 2,
  },

  {
    key: "soup_stew",
    displayName: "Soup / Stew",
    aliases: [
      "soup",
      "stew",
      "chowder",
      "bisque",
      "broth",
      "chili",
      "gumbo",
      "minestrone",
      "bouillabaisse",
      "ragout",
    ],
    requiredClassGroups: [["liquid_base"]],
    commonClasses: ["allium", "fat_oil"],
    optionalClasses: ["protein_meat", "protein_fish", "protein_plant", "vegetable", "starch", "dairy", "herb"],
    forbiddenClasses: ["leavening", "icing", "custard_base"],
    suspiciousClasses: ["cocoa_or_chocolate", "sweetener"],
    expectedMethodKeywords: ["simmer", "boil", "cook", "stir", "skim", "reduce"],
    requiredMethods: ["cook", "simmer"],
    optionalMethods: ["boil", "reduce", "blend"],
    // Enforced by ratioValidator.ts (not yet implemented)
    ratioRules: {
      liquid_to_solids: { min: 0.3, max: 5.0 },
    },
    generationConstraints: [
      "Must include a liquid base.",
      "Texture should match the subtype, such as broth-based, creamy, or thick stew.",
      "Avoid dessert-like sweetness.",
      "Method is simmering or slow cooking.",
    ],
    strictness: "low",
    maxUncommonIngredients: 4,
  },

  {
    key: "smoothie",
    displayName: "Smoothie",
    aliases: [
      "smoothie",
      "smoothies",
      "shake",
      "protein shake",
      "fruit smoothie",
      "green smoothie",
    ],
    requiredClassGroups: [
      ["liquid_base", "dairy"],
      ["fruit", "protein_plant", "leafy_green", "dairy"],
    ],
    commonClasses: ["fruit"],
    optionalClasses: ["protein_plant", "sweetener", "nut", "seed", "leafy_green", "flavoring_extract"],
    forbiddenClasses: [
      "protein_meat",
      "protein_fish",
      "allium",
      "savory_herb",
      "leavening",
      "broth",
      "soy_sauce",
    ],
    suspiciousClasses: ["fat_oil", "starch", "tomato_product", "hot_sauce_or_spicy"],
    expectedMethodKeywords: ["blend", "blender", "pulse", "combine"],
    requiredMethods: ["blend"],
    optionalMethods: ["pulse"],
    // Enforced by ratioValidator.ts (not yet implemented)
    ratioRules: {
      liquid_to_solid: { min: 0.3, max: 2.5 },
    },
    generationConstraints: [
      "Must include a liquid base.",
      "Fruit or another coherent smoothie body ingredient is strongly preferred.",
      "No savory proteins, alliums, broth, or cooking steps.",
      "Method is blending only.",
    ],
    strictness: "high",
    maxUncommonIngredients: 2,
  },

  {
    key: "salad",
    displayName: "Salad",
    aliases: [
      "salad",
      "grain salad",
      "pasta salad",
      "coleslaw",
      "tossed salad",
      "green salad",
    ],
    requiredClassGroups: [["fat_oil", "acid", "leafy_green", "vegetable", "starch"]],
    commonClasses: [],
    optionalClasses: ["protein_meat", "protein_fish", "protein_plant", "dairy", "nut", "seed", "fruit", "sweetener", "herb"],
    forbiddenClasses: ["leavening", "cocoa_or_chocolate", "custard_base", "icing"],
    suspiciousClasses: ["broth"],
    expectedMethodKeywords: ["toss", "dress", "mix", "combine", "chop", "slice"],
    requiredMethods: ["combine"],
    optionalMethods: ["toss", "chop", "slice"],
    // Enforced by ratioValidator.ts (not yet implemented)
    ratioRules: {
      dressing_to_salad: { min: 0.02, max: 0.3 },
    },
    generationConstraints: [
      "Must include a coherent salad base or body.",
      "Dressing should usually contain fat and acid, but some salads can rely on a lighter coating.",
      "Chocolate and baking ingredients do not belong here.",
      "Method is assembling and tossing, with minimal cooking unless subtype requires it.",
    ],
    strictness: "low",
    maxUncommonIngredients: 4,
  },

  {
    key: "omelet_frittata",
    displayName: "Omelet / Frittata / Scramble / Quiche",
    aliases: [
      "omelet",
      "omelette",
      "frittata",
      "egg scramble",
      "scrambled eggs",
      "quiche",
    ],
    requiredClassGroups: [["egg"], ["fat_oil"]],
    commonClasses: ["allium", "dairy"],
    optionalClasses: ["dairy", "vegetable", "herb", "protein_meat", "protein_fish", "starch"],
    forbiddenClasses: ["cocoa_or_chocolate", "icing", "custard_base"],
    suspiciousClasses: ["sweetener", "fruit", "hot_sauce_or_spicy"],
    expectedMethodKeywords: ["whisk", "cook", "fold", "set", "saute", "sauté", "bake"],
    requiredMethods: ["cook"],
    optionalMethods: ["whisk", "fold", "bake", "saute"],
    generationConstraints: [
      "Must include eggs and fat for cooking.",
      "Quiche may include flour in crust, but omelets and scrambles usually should not.",
      "Keep sweet dessert ingredients out.",
      "Method is stovetop cooking or oven finishing depending on subtype.",
    ],
    strictness: "medium",
    maxUncommonIngredients: 2,
  },

  {
    key: "tacos",
    displayName: "Tacos / Burritos / Quesadillas / Enchiladas / Fajitas",
    aliases: [
      "taco",
      "tacos",
      "burrito",
      "burritos",
      "quesadilla",
      "enchilada",
      "fajita",
      "fajitas",
    ],
    requiredClassGroups: [
      ["protein_meat", "protein_fish", "protein_plant", "vegetable"],
      ["allium", "hot_sauce_or_spicy", "acid", "spice_savory"],
    ],
    commonClasses: ["starch", "herb"],
    optionalClasses: ["dairy", "tomato_product", "legume", "fat_oil"],
    forbiddenClasses: ["leavening", "cocoa_or_chocolate", "icing", "custard_base"],
    suspiciousClasses: ["sweetener"],
    expectedMethodKeywords: ["season", "cook", "grill", "saute", "sauté", "assemble", "warm"],
    requiredMethods: ["cook", "assemble"],
    optionalMethods: ["grill", "warm", "saute"],
    generationConstraints: [
      "Must include a coherent filling and a savory flavor structure.",
      "Tortillas or shells are expected for most subtypes, but fillings may be planned separately.",
      "Sweetness should stay limited unless style-specific.",
      "Method is cooking the filling and assembling.",
    ],
    strictness: "medium",
    maxUncommonIngredients: 3,
  },

  {
    key: "pizza_flatbread",
    displayName: "Pizza / Flatbread",
    aliases: [
      "pizza",
      "flatbread",
      "margherita",
      "pepperoni pizza",
      "naan pizza",
    ],
    requiredClassGroups: [["flour_grain"], ["fat_oil", "dairy", "tomato_product", "sauce_base"]],
    commonClasses: [],
    optionalClasses: ["dairy", "tomato_product", "protein_meat", "vegetable", "herb", "allium"],
    forbiddenClasses: ["custard_base", "icing", "broth"],
    suspiciousClasses: ["sweetener", "fruit", "cocoa_or_chocolate"],
    expectedMethodKeywords: ["bake", "top", "shape", "stretch"],
    requiredMethods: ["bake"],
    optionalMethods: ["shape", "stretch", "rest"],
    // Enforced by ratioValidator.ts (not yet implemented)
    ratioRules: {
      sauce_to_dough: { min: 0.05, max: 0.8 },
    },
    generationConstraints: [
      "Must include a dough or flatbread base.",
      "Toppings should stay coherent and not overload the base.",
      "Dessert-style ingredients should not appear unless this is explicitly a dessert pizza.",
      "Primary method is baking.",
    ],
    strictness: "medium",
    maxUncommonIngredients: 3,
  },

  {
    key: "sandwich_wrap",
    displayName: "Sandwich / Wrap",
    aliases: [
      "sandwich",
      "wrap",
      "panini",
      "club sandwich",
      "grilled cheese",
      "sub",
      "hoagie",
    ],
    requiredClassGroups: [["flour_grain"], ["protein_meat", "protein_fish", "protein_plant", "dairy", "vegetable"]],
    commonClasses: ["fat_oil", "acid", "allium"],
    optionalClasses: ["dairy", "herb", "tomato_product", "leafy_green"],
    forbiddenClasses: ["leavening", "custard_base", "icing", "broth"],
    suspiciousClasses: ["cocoa_or_chocolate", "sweetener"],
    expectedMethodKeywords: ["assemble", "layer", "toast", "grill", "spread"],
    requiredMethods: ["assemble"],
    optionalMethods: ["toast", "grill", "spread"],
    generationConstraints: [
      "Must include a bread, wrap, or similar carrier plus a coherent filling.",
      "Fillings should be balanced and not wet enough to destroy structure.",
      "Dessert-style ingredients usually do not belong unless explicitly requested.",
      "Method is assembling, with optional toasting or grilling.",
    ],
    strictness: "low",
    maxUncommonIngredients: 4,
  },
];

/**
 * Utility normalization for family matching.
 */
function normalizeFamilyHint(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Score how strongly a hint matches a rule.
 */
function scoreDishFamilyMatch(rule: DishFamilyRule, normalizedHint: string): number {
  if (!normalizedHint) return 0;

  if (rule.key === normalizedHint) return 100;
  if (rule.aliases.includes(normalizedHint)) return 95;

  const hintTokens = new Set(normalizedHint.split(" ").filter(Boolean));
  let score = 0;

  for (const alias of rule.aliases) {
    const normalizedAlias = normalizeFamilyHint(alias);

    if (normalizedHint.includes(normalizedAlias)) {
      score = Math.max(score, 80);
    }
    if (normalizedAlias.includes(normalizedHint)) {
      score = Math.max(score, 70);
    }

    const aliasTokens = normalizedAlias.split(" ").filter(Boolean);
    let overlap = 0;
    for (const token of aliasTokens) {
      if (hintTokens.has(token)) overlap += 1;
    }
    if (aliasTokens.length > 0) {
      score = Math.max(score, Math.floor((overlap / aliasTokens.length) * 60));
    }
  }

  return score;
}

/**
 * Look up a dish family rule by key, alias, or free-text hint.
 * Returns null if no confident match is found.
 */
export function findDishFamilyRule(hint: string): DishFamilyRule | null {
  if (!hint) return null;
  const normalized = normalizeFamilyHint(hint);
  if (!normalized) return null;

  let bestRule: DishFamilyRule | null = null;
  let bestScore = 0;

  for (const rule of DISH_FAMILY_RULES) {
    const score = scoreDishFamilyMatch(rule, normalized);
    if (score > bestScore) {
      bestScore = score;
      bestRule = rule;
    }
  }

  return bestScore >= 50 ? bestRule : null;
}

export function getDishFamilyRuleByKey(key: string): DishFamilyRule | null {
  if (!key) return null;
  const normalized = normalizeFamilyHint(key);
  return DISH_FAMILY_RULES.find((r) => r.key === normalized) ?? null;
}

export { DISH_FAMILY_RULES };
