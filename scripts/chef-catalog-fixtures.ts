export type ChefCatalogFixture = {
  id: string;
  title: string;
  ingredients: string[];
  steps: string[];
  tags?: string[];
  scoreRange?: [number, number];
  expectedTopFix?: string;
  expectedFixesInclude?: string[];
  expectedFixesExclude?: string[];
  expectedRiskFlag?: RegExp;
  expectNoConflicts?: boolean;
};

export const CHEF_CATALOG_FIXTURES: ChefCatalogFixture[] = [
  {
    id: "cookies_fragile",
    title: "Non-dairy oatmeal raisin cookies with sourdough discard",
    ingredients: [
      "1 cup sourdough discard",
      "1/2 cup vegan butter",
      "1 cup rolled oats",
      "3/4 cup raisins",
      "1 tsp cinnamon",
      "1/2 tsp salt",
    ],
    steps: [
      "Mix the wet ingredients and sugar.",
      "Fold in the dry ingredients and raisins.",
      "Bake at 350 F for 12 minutes.",
    ],
    scoreRange: [55, 70],
    expectedTopFix: "cookie_chill_step_missing",
    expectedRiskFlag: /spread/i,
    expectNoConflicts: true,
  },
  {
    id: "chicken_strong",
    title: "Simple roast chicken",
    ingredients: ["1 whole chicken", "1 tbsp olive oil", "1 tsp salt", "1/2 tsp black pepper"],
    steps: [
      "Pat the chicken dry and season it all over.",
      "Roast at 425 F until the thickest part reaches 165 F.",
      "Rest for 10 minutes before carving.",
    ],
    scoreRange: [75, 90],
    expectNoConflicts: true,
  },
  {
    id: "pasta_basic",
    title: "Weeknight tomato pasta",
    ingredients: ["12 oz spaghetti", "2 tbsp olive oil", "3 cloves garlic", "1 can crushed tomatoes", "salt"],
    steps: [
      "Boil the pasta until al dente.",
      "Cook the garlic in olive oil, then add tomatoes and simmer.",
      "Drain the pasta and spoon the sauce over it.",
    ],
    scoreRange: [68, 80],
    expectedTopFix: "pasta_water_missing",
    expectNoConflicts: true,
  },
  {
    id: "salad_basic",
    title: "Herb salad with vinaigrette",
    ingredients: ["romaine", "parsley", "olive oil", "red wine vinegar", "salt"],
    steps: [
      "Whisk together the vinaigrette.",
      "Toss the greens with the dressing and let the salad sit for 15 minutes before serving.",
    ],
  },
  {
    id: "grains_basic",
    title: "Simple rice pilaf",
    ingredients: ["1 cup rice", "2 cups stock", "1 tbsp butter", "salt"],
    steps: [
      "Melt the butter and stir in the rice.",
      "Add the stock and simmer until the liquid is absorbed.",
      "Serve warm.",
    ],
  },
  {
    id: "grilled_skin_on_chicken",
    title: "Grilled chicken thighs",
    ingredients: ["6 chicken thighs", "1 tbsp neutral oil", "salt", "pepper"],
    steps: [
      "Pat the chicken dry and season it.",
      "Preheat the grill and cook over medium-high heat until browned and cooked through.",
      "Rest for 5 minutes before serving.",
    ],
    expectedTopFix: "protein_temp_guidance_missing",
  },
  {
    id: "beef_braise",
    title: "Braised beef chuck",
    ingredients: ["2 lb beef chuck", "salt", "pepper", "onion", "stock"],
    steps: [
      "Season the beef and brown it in a pot.",
      "Add onion and stock, cover, and cook low until tender.",
      "Rest briefly before serving.",
    ],
  },
  {
    id: "low_fat_dairy_sauce",
    title: "Low-fat yogurt herb sauce",
    ingredients: ["1 cup low-fat yogurt", "parsley", "garlic", "salt"],
    steps: [
      "Mix the yogurt with herbs and garlic.",
      "Warm gently and serve.",
    ],
    expectedTopFix: "sauce_final_seasoning_missing",
  },
  {
    id: "risotto_basic",
    title: "Basic mushroom risotto",
    ingredients: ["1 cup arborio rice", "mushrooms", "stock", "butter", "parmesan", "salt"],
    steps: [
      "Cook the mushrooms in a pan until browned.",
      "Add the rice and cook briefly, then add stock gradually while stirring occasionally.",
      "Finish with butter and parmesan.",
    ],
  },
  {
    id: "crowded_sear",
    title: "Crowded skillet steak bites",
    ingredients: ["2 lb steak", "salt", "pepper", "oil"],
    steps: [
      "Add all the steak to a skillet over high heat.",
      "Cook until browned and serve immediately.",
    ],
  },
  {
    id: "classic_creamed_cookies",
    title: "Classic chocolate chip cookie dough",
    ingredients: ["butter", "brown sugar", "white sugar", "egg", "flour", "baking soda", "salt", "chocolate chips"],
    steps: [
      "Cream butter and sugar until light and fluffy.",
      "Beat in the egg, then fold in the dry ingredients and chocolate chips.",
      "Chill the dough for 30 minutes.",
      "Bake at 350 F until the edges are golden.",
    ],
    expectedFixesInclude: ["cookie_fat_behavior_guidance_missing"],
  },
  {
    id: "pizza_dough_rest",
    title: "Overnight pizza dough",
    ingredients: ["bread flour", "water", "yeast", "salt", "olive oil"],
    steps: [
      "Mix the dough until shaggy.",
      "Rest the dough for 20 minutes, then knead briefly until smooth.",
      "Chill the dough overnight before shaping and baking.",
    ],
  },
  {
    id: "lean_chicken_breast",
    title: "Skillet lemon chicken breast",
    ingredients: ["2 chicken breasts", "olive oil", "salt", "pepper", "lemon"],
    steps: [
      "Pat the chicken breast dry and season it.",
      "Sear over high heat until browned, then lower the heat and cook through.",
      "Rest briefly before slicing.",
    ],
  },
  {
    id: "overbuilt_stew",
    title: "Loaded market vegetable stew",
    ingredients: [
      "olive oil",
      "onion",
      "garlic",
      "carrot",
      "celery",
      "potato",
      "turnip",
      "parsnip",
      "fennel",
      "tomato",
      "zucchini",
      "beans",
      "kale",
      "paprika",
      "oregano",
    ],
    steps: [
      "Sweat all the vegetables together in a large pot.",
      "Add beans, tomato, spices, and water and simmer until tender.",
      "Taste and serve.",
    ],
  },
  {
    id: "frozen_blueberry_muffins",
    title: "Frozen blueberry muffins",
    ingredients: ["flour", "brown sugar", "egg", "butter", "frozen blueberries", "baking powder", "salt"],
    steps: [
      "Cream the butter and brown sugar, then beat in the egg.",
      "Fold in the flour and frozen blueberries.",
      "Bake at 375 F until golden.",
    ],
    expectedFixesInclude: ["frozen_fruit_moisture_missing", "baking_cooling_step_missing"],
  },
  {
    id: "mushroom_garlic_saute",
    title: "Mushroom garlic saute",
    ingredients: ["mushrooms", "garlic", "olive oil", "salt", "parsley"],
    steps: [
      "Heat a skillet over high heat.",
      "Add the mushrooms and garlic together and cook until browned.",
      "Finish with parsley and serve.",
    ],
    expectedFixesInclude: ["garlic_timing_control_missing", "mushroom_browning_guidance_missing"],
  },
  {
    id: "cheesy_pan_sauce",
    title: "Creamy parmesan pan sauce",
    ingredients: ["parmesan", "garlic", "butter", "stock", "salt"],
    steps: [
      "Boil the stock and butter in a skillet over high heat.",
      "Stir in the parmesan and garlic and simmer until combined.",
      "Serve immediately.",
    ],
    expectedFixesInclude: ["garlic_timing_control_missing", "cheese_heat_control_missing", "sauce_final_seasoning_missing"],
  },
  {
    id: "cookies_refined",
    title: "Refined oatmeal cookies",
    ingredients: ["butter", "brown sugar", "egg", "flour", "oats", "salt", "cinnamon"],
    steps: [
      "Cream the butter and sugar until light and fluffy, then beat in the egg.",
      "Fold in the dry ingredients and chill the dough for 30 minutes if it softens while scooping.",
      "Bake at 350 F until the edges are set and lightly golden while the centers still look slightly soft.",
      "Let the cookies cool on the tray for 5 minutes before moving them to a rack.",
    ],
    scoreRange: [80, 92],
    expectedFixesExclude: ["cookie_chill_step_missing", "vague_cookie_doneness", "cookie_cooling_step_missing", "cookie_fat_behavior_guidance_missing"],
    expectNoConflicts: true,
  },
  {
    id: "chicken_temp_guided",
    title: "Thermometer-guided roast chicken breasts",
    ingredients: ["chicken breasts", "olive oil", "salt", "pepper"],
    steps: [
      "Pat the chicken dry, season it well, and sear briefly in a hot pan.",
      "Transfer to the oven and cook until the thickest part reaches 160 F to 165 F.",
      "Rest for 5 to 10 minutes before slicing.",
    ],
    scoreRange: [78, 90],
    expectedFixesExclude: ["protein_temp_guidance_missing", "chicken_rest_step_missing"],
    expectNoConflicts: true,
  },
  {
    id: "sauce_finished_strong",
    title: "Finished pan sauce",
    ingredients: ["shallot", "stock", "butter", "lemon", "salt"],
    steps: [
      "Reduce the stock with the shallot until slightly thickened.",
      "Whisk in the butter off the heat.",
      "Taste and adjust salt or lemon before serving.",
    ],
    scoreRange: [72, 88],
    expectedFixesExclude: ["sauce_final_seasoning_missing"],
    expectNoConflicts: true,
  },
  {
    id: "baking_cooled_strong",
    title: "Blueberry muffins with cooling guidance",
    ingredients: ["flour", "sugar", "egg", "butter", "blueberries", "baking powder", "salt"],
    steps: [
      "Mix the batter until just combined and fold in the blueberries.",
      "Bake at 375 F until lightly golden and the tops spring back.",
      "Cool in the pan for 5 minutes, then transfer to a wire rack to cool completely.",
    ],
    scoreRange: [76, 90],
    expectedFixesExclude: ["baking_cooling_step_missing"],
    expectNoConflicts: true,
  },
  {
    id: "beef_temp_guided",
    title: "Temperature-guided steak",
    ingredients: ["strip steak", "salt", "pepper", "oil"],
    steps: [
      "Pat the steak dry and season it well.",
      "Sear over high heat, then finish until the internal temperature reaches 130 F to 135 F.",
      "Rest for 5 minutes before slicing against the grain.",
    ],
    scoreRange: [76, 90],
    expectedFixesExclude: ["protein_temp_guidance_missing", "chicken_rest_step_missing"],
    expectNoConflicts: true,
  },
  {
    id: "low_fat_dairy_sauce_stable",
    title: "Stable low-fat yogurt sauce",
    ingredients: ["1 cup low-fat yogurt", "garlic", "parsley", "salt", "lemon"],
    steps: [
      "Warm the yogurt very gently over low heat and do not let it boil.",
      "Stir in the garlic and parsley.",
      "Taste and adjust salt or lemon before serving.",
    ],
    scoreRange: [72, 86],
    expectedFixesExclude: ["sauce_final_seasoning_missing"],
    expectNoConflicts: true,
  },
  {
    id: "pasta_glossy_finish",
    title: "Glossy finished tomato pasta",
    ingredients: ["spaghetti", "olive oil", "garlic", "crushed tomatoes", "salt"],
    steps: [
      "Boil the pasta until al dente and reserve a cup of pasta water.",
      "Simmer the sauce, then toss in the pasta with a splash of pasta water until the sauce looks glossy and coats the noodles.",
      "Taste and adjust salt before serving.",
    ],
    scoreRange: [73, 90],
    expectedFixesExclude: ["pasta_water_missing", "sauce_final_seasoning_missing"],
    expectNoConflicts: true,
  },
  {
    id: "skin_on_chicken_rendered",
    title: "Rendered skin-on chicken thighs",
    ingredients: ["skin-on chicken thighs", "salt", "pepper", "oil"],
    steps: [
      "Pat the chicken dry and season it well.",
      "Start skin-side down over medium heat so the fat renders before you chase deeper color.",
      "Cook until the thickest part reaches 175 F, then rest before serving.",
    ],
    scoreRange: [78, 92],
    expectedFixesExclude: ["protein_temp_guidance_missing"],
    expectNoConflicts: true,
  },
];
