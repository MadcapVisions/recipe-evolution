type Pattern = {
  tag: string;
  regex: RegExp;
};

/**
 * Order matters: more specific phrases first, short/generic verbs last.
 * Word boundaries prevent "butterfly" → "fry", "mixture" → "mix", etc.
 * Conjugated forms (baking, simmering, etc.) are handled alongside base forms.
 */
const PATTERNS: Pattern[] = [
  { tag: "high_heat", regex: /\b(high[- ]heat|wok|stir[- ]?fr(y|ies|ied|ying))\b/i },
  { tag: "bake",      regex: /\b(bak(e|es|ed|ing)|oven[- ]cook)\b/i },
  { tag: "boil",      regex: /\b(boil(s|ed|ing)?|bring[^.]*to a boil)\b/i },
  { tag: "simmer",    regex: /\bsimmer(s|ed|ing)?\b/i },
  { tag: "steam",     regex: /\bsteam(s|ed|ing)?\b/i },
  { tag: "toast",     regex: /\btoast(s|ed|ing)?\b/i },
  { tag: "reduce",    regex: /\breduc(e|es|ed|ing)\b/i },
  { tag: "grill",     regex: /\b(grill(s|ed|ing)?|char(s|red|ring)?)\b/i },
  { tag: "fry",       regex: /\b(deep[- ]fr(y|ies|ied|ying)|pan[- ]fr(y|ies|ied|ying)|fr(y|ies|ied|ying))\b/i },
  { tag: "saute",     regex: /\b(saut[eé](s|ed|ing)?)\b/i },
  { tag: "blend",     regex: /\b(blend(s|ed|ing)?|blender|pur[eé](e|es|ed|ing)?)\b/i },
  { tag: "chill",     regex: /\b(chill(s|ed|ing)?|refrigerat(e|es|ed|ing)|cool(s|ed|ing)?)\b/i },
  { tag: "rest",      regex: /\b(rest(s|ed|ing)?|let stand|stand(s|ing)?)\b/i },
  { tag: "assemble",  regex: /\bassembl(e|es|ed|ing)\b/i },
  { tag: "whisk",     regex: /\bwhisk(s|ed|ing)?\b/i },
  { tag: "fold",      regex: /\bfold(s|ed|ing)?\b/i },
  { tag: "mix",       regex: /\b(mix(es|ed|ing)?|combin(e|es|ed|ing)|stir(s|red|ring)?)\b/i }, // intentionally late
  { tag: "cook",      regex: /\bcook(s|ed|ing)?\b/i },
];

/** Infer a method tag from plain step text. Returns null if nothing matches. */
export function inferMethodTag(text: string): string | null {
  for (const { tag, regex } of PATTERNS) {
    if (regex.test(text)) return tag;
  }
  return null;
}
