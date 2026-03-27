export const METHOD_TAGS = [
  "mix",
  "combine",
  "stir",
  "whisk",
  "fold",
  "assemble",
  "marinate",
  "soak",
  "strain",
  "melt",
  "set",
  "bake",
  "convection_bake",
  "broil",
  "roast",
  "toast",
  "boil",
  "simmer",
  "braise",
  "steam",
  "poach",
  "blanch",
  "reduce",
  "deglaze",
  "grill",
  "smoke",
  "fry",
  "pan_fry",
  "deep_fry",
  "stir_fry",
  "saute",
  "sear",
  "blend",
  "chill",
  "rest",
  "cook",
  "slow_cook",
  "pressure_cook",
  "air_fry",
  "sous_vide",
  "confit",
  "caramelize",
  "high_heat",
] as const;

export type MethodTag = (typeof METHOD_TAGS)[number];

type MethodDefinition = {
  tag: MethodTag;
  pattern: RegExp;
  guidance?: string;
};

type EquipmentDefinition = {
  label: string;
  pattern: RegExp;
  impliedMethods: MethodTag[];
};

const METHOD_DEFINITIONS: MethodDefinition[] = [
  { tag: "sous_vide", pattern: /\bsous[- ]vide\b/i, guidance: "Cook in a temperature-controlled water bath until evenly done, then finish briefly for color if needed." },
  { tag: "convection_bake", pattern: /\bconvection(?:\s+oven)?\b/i, guidance: "Use convection heat for faster browning and reduce the temperature slightly if the oven runs hot." },
  { tag: "pressure_cook", pattern: /\b(?:pressure cook(?:er|ing)?|instant pot)\b/i, guidance: "Seal and cook under pressure until tender, then vent and adjust the liquid before serving." },
  { tag: "slow_cook", pattern: /\b(?:slow cook(?:er|ing)?|slow[- ]cook(?:er|ing)?|crockpot|crock pot)\b/i, guidance: "Cook gently over low heat with the lid on, then rest briefly so carryover heat finishes the dish without overcooking it." },
  { tag: "air_fry", pattern: /\bair[- ]fry(?:er|ing)?\b/i, guidance: "Arrange in a single layer and cook with circulating dry heat until crisp and browned." },
  { tag: "deep_fry", pattern: /\bdeep[- ]fr(?:y|ied|ying)\b/i, guidance: "Fry fully submerged in hot oil until crisp, then drain well before serving." },
  { tag: "pan_fry", pattern: /\bpan[- ]fr(?:y|ied|ying)\b/i, guidance: "Cook in a shallow layer of fat over steady heat so the surface browns evenly." },
  { tag: "stir_fry", pattern: /\bstir[- ]?fr(?:y|ied|ying)\b/i, guidance: "Cook quickly over very high heat, keeping ingredients moving so they sear without steaming." },
  { tag: "high_heat", pattern: /\b(?:high[- ]heat|wok|flash[- ]sear)\b/i, guidance: "Use strong heat and quick movement to build color before ingredients overcook." },
  { tag: "broil", pattern: /\bbroil(?:ed|ing|er)?\b/i, guidance: "Use intense top heat briefly and watch closely so the surface browns without burning." },
  { tag: "roast", pattern: /\broast(?:ed|ing)?\b/i, guidance: "Cook with dry oven heat until the surface browns and the interior reaches the right doneness." },
  { tag: "braise", pattern: /\bbrais(?:e|ed|ing)\b/i, guidance: "Brown first, then cook covered with liquid at a gentle simmer until tender." },
  { tag: "grill", pattern: /\bgrill(?:ed|ing)?\b/i, guidance: "Cook over direct radiant heat and turn only as needed to develop char without drying out the food." },
  { tag: "smoke", pattern: /\bsmok(?:e|ed|ing)\b/i, guidance: "Cook with controlled smoke and moderate heat until the exterior takes on color and the interior is fully cooked." },
  { tag: "steam", pattern: /\bsteam(?:ed|ing)?\b/i, guidance: "Cook over steam until just tender so the dish stays moist and delicate." },
  { tag: "poach", pattern: /\bpoach(?:ed|ing)?\b/i, guidance: "Cook gently in barely simmering liquid to keep the texture tender." },
  { tag: "blanch", pattern: /\bblanch(?:ed|ing)?\b/i, guidance: "Briefly cook in boiling water, then stop the cooking quickly to preserve texture and color." },
  { tag: "boil", pattern: /\b(?:boil(?:s|ed|ing)?|bring[^.]*to a boil)\b/i, guidance: "Cook in actively boiling liquid until the ingredient reaches the intended tenderness." },
  { tag: "simmer", pattern: /\bsimmer(?:s|ed|ing)?\b/i, guidance: "Maintain a gentle bubble rather than a full boil so the texture stays controlled." },
  { tag: "toast", pattern: /\btoast(?:s|ed|ing)?\b/i, guidance: "Expose briefly to dry heat until aromatic and lightly browned." },
  { tag: "reduce", pattern: /\breduc(?:e|es|ed|ing)\b/i, guidance: "Cook uncovered so excess water evaporates and the flavor concentrates." },
  { tag: "deglaze", pattern: /\bdeglaz(?:e|es|ed|ing)\b/i, guidance: "Loosen browned bits with liquid and fold them back into the sauce for depth." },
  { tag: "soak", pattern: /\b(?:soak(?:s|ed|ing)?|soaked|steep(?:s|ed|ing)?|absorb(?:s|ed|ing)?)\b/i, guidance: "Let the main ingredient absorb liquid long enough to soften or hydrate before finishing the cook." },
  { tag: "strain", pattern: /\bstrain(?:s|ed|ing)?\b/i, guidance: "Pass the mixture through a strainer when you need a smoother texture or to remove solids." },
  { tag: "melt", pattern: /\bmelt(?:s|ed|ing)?\b/i, guidance: "Apply gentle heat only until the ingredient liquefies or softens fully." },
  { tag: "set", pattern: /\bset(?:s|ting)?\b/i, guidance: "Cook or chill until the structure firms enough to hold together cleanly." },
  { tag: "fry", pattern: /\bfr(?:y|ies|ied|ying)\b/i, guidance: "Cook in fat until the surface is crisp or golden, adjusting heat to avoid greasiness." },
  { tag: "saute", pattern: /\b(?:saut[eé](?:s|ed|ing)?|saute(?:s|ed|ing)?)\b/i, guidance: "Cook quickly in a small amount of fat over medium-high heat until fragrant or lightly browned." },
  { tag: "sear", pattern: /\bsear(?:s|ed|ing)?\b/i, guidance: "Brown the surface over high heat first to build flavor before finishing the cook." },
  { tag: "bake", pattern: /\b(?:bak(?:e|es|ed|ing)|oven[- ]cook)\b/i, guidance: "Cook with steady oven heat until set and evenly cooked through." },
  { tag: "confit", pattern: /\bconfit\b/i, guidance: "Cook slowly in fat until exceptionally tender, then crisp the exterior only if needed." },
  { tag: "caramelize", pattern: /\bcarameliz(?:e|es|ed|ing)\b/i, guidance: "Cook until sugars deepen in color and flavor without crossing into bitterness." },
  { tag: "blend", pattern: /\b(?:blend(?:s|ed|ing)?|blender|pur[eé](?:e|es|ed|ing)?)\b/i, guidance: "Blend until smooth, adding liquid gradually to control the final texture." },
  { tag: "chill", pattern: /\b(?:chill(?:s|ed|ing)?|refrigerat(?:e|es|ed|ing)|cool(?:s|ed|ing)?)\b/i, guidance: "Cool fully or chill long enough for the structure and flavor to settle." },
  { tag: "rest", pattern: /\b(?:rest(?:s|ed|ing)?|let stand|stand(?:s|ing)?)\b/i, guidance: "Let the dish sit off heat briefly so juices redistribute or the structure sets cleanly." },
  { tag: "assemble", pattern: /\bassembl(?:e|es|ed|ing)\b/i, guidance: "Build the final dish only after the individual components are ready." },
  { tag: "stir", pattern: /\bstir(?:s|red|ring)?\b/i, guidance: "Stir deliberately so the texture stays even and ingredients cook without sticking." },
  { tag: "whisk", pattern: /\bwhisk(?:s|ed|ing)?\b/i, guidance: "Whisk until the mixture is fully homogeneous and no streaks remain." },
  { tag: "fold", pattern: /\bfold(?:s|ed|ing)?\b/i, guidance: "Fold gently so you preserve air and avoid deflating the mixture." },
  { tag: "combine", pattern: /\bcombin(?:e|es|ed|ing)\b/i, guidance: "Combine components thoroughly without overworking them." },
  { tag: "mix", pattern: /\bmix(?:es|ed|ing)?\b/i, guidance: "Mix until evenly incorporated, stopping before the texture becomes tough or overworked." },
  { tag: "cook", pattern: /\bcook(?:s|ed|ing)?\b/i, guidance: "Cook until the ingredient reaches the intended doneness and texture." },
];

const EQUIPMENT_DEFINITIONS: EquipmentDefinition[] = [
  { label: "slow cooker", pattern: /\b(?:slow cooker|slow-cooker|crockpot|crock pot)\b/i, impliedMethods: ["slow_cook"] },
  { label: "pressure cooker", pattern: /\b(?:pressure cooker|instant pot)\b/i, impliedMethods: ["pressure_cook"] },
  { label: "air fryer", pattern: /\bair fryer\b/i, impliedMethods: ["air_fry"] },
  { label: "convection oven", pattern: /\bconvection(?:\s+oven)?\b/i, impliedMethods: ["convection_bake"] },
  { label: "oven", pattern: /\boven\b/i, impliedMethods: [] },
  { label: "broiler", pattern: /\bbroiler\b/i, impliedMethods: ["broil"] },
  { label: "grill", pattern: /\bgrill\b/i, impliedMethods: ["grill"] },
  { label: "smoker", pattern: /\bsmoker\b/i, impliedMethods: ["smoke"] },
  { label: "skillet", pattern: /\bskillet\b/i, impliedMethods: ["pan_fry"] },
  { label: "stovetop", pattern: /\bstovetop\b/i, impliedMethods: [] },
  { label: "sous vide circulator", pattern: /\b(?:immersion circulator|sous[- ]vide machine|sous[- ]vide circulator)\b/i, impliedMethods: ["sous_vide"] },
];

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}

export function inferMethodTag(text: string): MethodTag | null {
  for (const definition of METHOD_DEFINITIONS) {
    if (definition.pattern.test(text)) {
      return definition.tag;
    }
  }
  return null;
}

export function extractCookingMethodConstraints(text: string): MethodTag[] {
  return unique(
    METHOD_DEFINITIONS.filter((definition) => definition.pattern.test(text)).map((definition) => definition.tag)
  ) as MethodTag[];
}

export function extractEquipmentConstraints(text: string): string[] {
  return unique(
    EQUIPMENT_DEFINITIONS.filter((definition) => definition.pattern.test(text)).map((definition) => definition.label)
  );
}

export function deriveRequiredTechniquesFromConstraints(input: {
  explicitMethods?: string[] | null;
  equipmentLimits?: string[] | null;
  dishFamily?: string | null;
}): MethodTag[] {
  const explicit = Array.isArray(input.explicitMethods) ? input.explicitMethods : [];
  const equipment = Array.isArray(input.equipmentLimits) ? input.equipmentLimits : [];
  const equipmentImplied = EQUIPMENT_DEFINITIONS
    .filter((definition) => equipment.includes(definition.label))
    .flatMap((definition) => definition.impliedMethods);

  return unique([
    ...(input.dishFamily === "pizza" ? ["bake"] : []),
    ...explicit,
    ...equipmentImplied,
  ]) as MethodTag[];
}

export function buildTechniqueHintsFromMethods(methods: string[]): string[] {
  return unique(
    methods
      .map((method) => METHOD_DEFINITIONS.find((definition) => definition.tag === method)?.guidance ?? null)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
  );
}

export function stepSatisfiesMethod(step: { text: string; methodTag?: string | null }, method: string): boolean {
  const inferred = step.methodTag ?? inferMethodTag(step.text);
  if (inferred === method) {
    return true;
  }
  const definition = METHOD_DEFINITIONS.find((entry) => entry.tag === method);
  if (!definition) {
    return step.text.toLowerCase().includes(method.toLowerCase());
  }
  return definition.pattern.test(step.text);
}

export function stepMentionsEquipment(step: { text: string }, equipment: string): boolean {
  const definition = EQUIPMENT_DEFINITIONS.find((entry) => entry.label === equipment);
  if (!definition) {
    return step.text.toLowerCase().includes(equipment.toLowerCase());
  }
  return definition.pattern.test(step.text);
}
