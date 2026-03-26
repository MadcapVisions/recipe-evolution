export const METHOD_TAGS = [
  "mix",
  "bake",
  "boil",
  "simmer",
  "saute",
  "grill",
  "fry",
  "blend",
  "assemble",
  "chill",
  "rest",
  "toast",
  "reduce",
  "steam",
  "whisk",
  "fold",
  "combine",
  "cook",
  "high_heat",
] as const;

export type MethodTag = (typeof METHOD_TAGS)[number];
