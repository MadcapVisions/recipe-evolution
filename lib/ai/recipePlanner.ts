import type { CookingBrief } from "./contracts/cookingBrief";
import { createEmptyRecipePlan, type RecipePlan } from "./contracts/recipePlan";
import { findDishFamilyRule } from "./dishFamilyRules";
import { buildTechniqueHintsFromMethods } from "./methodRegistry";

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}

function inferCoreComponents(brief: CookingBrief) {
  const family = brief.dish.dish_family;
  if (family === "pizza") {
    return unique(["dough", "sauce", "cheese", ...brief.ingredients.required]);
  }
  if (family === "pasta") {
    return unique(["pasta", "sauce", ...brief.ingredients.required]);
  }
  if (family === "tacos") {
    return unique(["tortillas", "filling", "topping", ...brief.ingredients.required]);
  }
  if (family === "dip") {
    return unique(["main ingredient", "acid", "fat", ...brief.ingredients.required]);
  }
  return unique([...brief.ingredients.required, ...brief.directives.must_have]);
}

const TECHNIQUE_OUTLINES: Record<string, string[]> = {
  custard_flan: [
    "Whisk eggs with sugar and cream until smooth — do not overbeat.",
    "Temper the eggs slowly with warm liquid to avoid curdling.",
    "Bake in a water bath (bain-marie) at low heat until just set with a slight wobble.",
    "Chill fully before unmolding or serving.",
  ],
  bread_pudding: [
    "Tear or slice bread and arrange in the baking vessel; stale or day-old bread absorbs custard better.",
    "Whisk together eggs, dairy, sweetener, and flavoring to form the custard.",
    "Pour custard over bread and soak thoroughly — press down if needed — rest at least 20 minutes.",
    "Bake at moderate heat until set and golden on top, or slow-cook on low until custard is just firm.",
  ],
  brownie_chocolate_cake: [
    "Melt chocolate and butter together gently — do not overheat.",
    "Whisk in sugar, then eggs one at a time for structure.",
    "Fold in dry ingredients minimally to keep the texture fudgy.",
    "Bake until just set — a clean edge with a soft center is correct.",
  ],
  cookie: [
    "Cream fat and sugar until light and fluffy for the right spread.",
    "Mix in eggs and vanilla, then fold in dry ingredients.",
    "Chill the dough if needed for shape control.",
    "Bake until edges are golden but centers are still soft.",
  ],
  cheesecake: [
    "Beat cream cheese until fully smooth before adding other ingredients.",
    "Add eggs one at a time — do not overmix after eggs go in.",
    "Bake in a water bath to prevent cracking, or use no-bake setting method.",
    "Cool slowly in the oven with the door cracked, then chill overnight.",
  ],
  muffin_quick_bread: [
    "Mix dry and wet ingredients separately, then combine with minimal strokes.",
    "Do not overmix — lumps in the batter are fine.",
    "Fill molds to 2/3 capacity to allow rise.",
    "Bake until a toothpick comes out clean.",
  ],
  pancake_waffle: [
    "Combine wet and dry ingredients until just mixed — a few lumps are correct.",
    "Let the batter rest 5 minutes before cooking.",
    "Cook on a preheated griddle or waffle iron at medium heat.",
    "Flip once bubbles form on the surface and edges look set.",
  ],
  risotto: [
    "Toast the rice in fat until translucent at the edges.",
    "Add wine first and stir until fully absorbed.",
    "Add warm broth one ladle at a time, stirring constantly until absorbed before adding more.",
    "Finish off heat with butter and cheese for a creamy consistency.",
  ],
  stir_fry: [
    "Prepare all ingredients before starting — high-heat cooking moves fast.",
    "Heat the wok until smoking before adding oil.",
    "Cook protein first, remove, then cook aromatics and vegetables.",
    "Return protein, add sauce, and toss to coat over high heat.",
  ],
  curry: [
    "Bloom whole spices in fat first, then add aromatics.",
    "Cook the spice paste until the fat separates and deepens in color.",
    "Add the protein and seal, then add the sauce base.",
    "Simmer uncovered until the sauce reduces and coats the protein.",
  ],
  pasta: [
    "Cook pasta in heavily salted boiling water — reserve 1 cup pasta water before draining.",
    "Build the sauce in a wide pan while pasta cooks.",
    "Add drained pasta directly to the sauce with a splash of pasta water.",
    "Toss vigorously off heat to emulsify and coat every strand.",
  ],
  soup_stew: [
    "Build flavor with aromatics and fat as the base.",
    "Brown any meat or dense vegetables for depth before adding liquid.",
    "Add liquid and bring to a simmer — not a rapid boil.",
    "Cook until all components are fully tender and flavors have melded.",
  ],
  smoothie: [
    "Add liquid to the blender first for easier blending.",
    "Layer soft ingredients before frozen or dense ones.",
    "Blend on high until fully smooth — 30–60 seconds.",
    "Adjust consistency with more liquid or add-ins as needed.",
  ],
  salad: [
    "Prepare all components and let them come to room temperature if needed.",
    "Make the dressing separately and taste for acid-fat balance.",
    "Dress the salad just before serving to prevent wilting.",
    "Toss gently to coat without bruising delicate greens.",
  ],
  omelet_frittata: [
    "Whisk eggs with salt until fully homogeneous — no streaks.",
    "Heat fat in a non-stick or well-seasoned pan over medium heat.",
    "Add eggs and gently move them while the bottom sets.",
    "Fold or finish under the broiler until just set — not rubbery.",
  ],
  tacos: [
    "Season and cook the protein with concentrated dry or wet seasoning.",
    "Warm tortillas in a dry skillet or directly over flame.",
    "Prepare fresh toppings separately — texture contrast is key.",
    "Assemble at serving time so tortillas stay intact.",
  ],
  pizza: [
    "Prepare or stretch the dough into the intended shape.",
    "Add sauce and toppings with restraint so the crust stays crisp.",
    "Bake at high heat until the crust is deeply golden.",
    "Finish with herbs, acid, or oil only after baking if needed.",
  ],
};

function inferTechniqueOutline(brief: CookingBrief) {
  const family = brief.dish.dish_family;
  const methodHints = buildTechniqueHintsFromMethods(brief.directives.required_techniques);
  if (brief.constraints.equipment_limits.includes("slow cooker")) {
    return unique([
      ...methodHints,
      ...(family === "bread_pudding"
      ? [
          "Grease the slow cooker insert well and arrange the bread directly in it.",
          "Whisk together the custard, pour it over the bread, and soak thoroughly before cooking.",
          "Cook on low until the custard is just set and the center is softly jiggly, keeping the lid on as much as possible.",
          "Rest briefly with the heat off before serving so the pudding finishes setting without overcooking.",
        ]
      : [
          "Prepare the ingredients and layer or transfer them into the slow cooker insert.",
          "Add the cooking liquid or sauce, then cover tightly.",
          "Cook on low until the main components are tender and fully cooked through.",
          "Finish uncovered if needed to adjust consistency before serving.",
        ]),
    ]);
  }
  if (family && TECHNIQUE_OUTLINES[family]) {
    return unique([...methodHints, ...TECHNIQUE_OUTLINES[family]]);
  }
  return methodHints.length > 0
    ? methodHints
    : [
        "Build the main flavor base first.",
        "Cook the central component to the right texture.",
        "Finish with balancing acid, herbs, or garnish if needed.",
      ];
}

function inferExpectedTextures(brief: CookingBrief) {
  return unique([...brief.style.texture_tags, ...brief.style.tags.filter((tag) => ["crispy", "airy", "creamy", "delicate"].includes(tag))]);
}

function inferExpectedFlavors(brief: CookingBrief) {
  return unique(
    brief.directives.must_have.filter((item) =>
      ["bright", "savory", "spicy", "herby", "traditional"].some((token) => item.toLowerCase().includes(token))
    )
  );
}

export function buildRecipePlanFromBrief(brief: CookingBrief): RecipePlan {
  const plan = createEmptyRecipePlan();
  plan.title_direction = brief.dish.normalized_name ?? brief.dish.raw_user_phrase ?? "Chef recipe";
  plan.dish_family = brief.dish.dish_family ?? "dish";
  plan.style_tags = unique([...brief.style.tags, ...brief.style.format_tags]);
  plan.core_components = inferCoreComponents(brief);
  plan.key_ingredients = unique([
    ...brief.ingredients.required,
    ...brief.ingredients.preferred,
    ...(brief.ingredients.centerpiece ? [brief.ingredients.centerpiece] : []),
  ]);
  plan.blocked_ingredients = unique(brief.ingredients.forbidden);
  plan.technique_outline = inferTechniqueOutline(brief);
  plan.expected_texture = inferExpectedTextures(brief);
  plan.expected_flavor = inferExpectedFlavors(brief);
  plan.confidence = Math.max(0.5, brief.confidence);
  const familyRule = findDishFamilyRule(brief.dish.dish_family ?? "");
  plan.notes = unique([
    ...(brief.dish.authenticity_target ? [`Honor the ${brief.dish.authenticity_target} direction.`] : []),
    ...(brief.constraints.time_max_minutes ? [`Aim for roughly ${brief.constraints.time_max_minutes} minutes total.`] : []),
    ...(brief.constraints.equipment_limits.length > 0
      ? [`Use: ${brief.constraints.equipment_limits.join(", ")}.`]
      : []),
    ...(brief.ingredients.forbidden.length > 0 ? [`Avoid: ${brief.ingredients.forbidden.join(", ")}.`] : []),
    ...(familyRule ? familyRule.generationConstraints : []),
  ]);

  return plan;
}
