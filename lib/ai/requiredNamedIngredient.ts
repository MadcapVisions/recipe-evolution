export type IngredientConstraintProvenance = {
  phrase: string;
  sourceType:
    | "user_message"
    | "assistant_text"
    | "conversation_history"
    | "recipe_context"
    | "build_spec"
    | "locked_session"
    | "session_seed"
    | "unknown";
  sourceRole?: "user" | "assistant" | "system" | null;
  sourceText?: string | null;
  sourceStart?: number | null;
  sourceEnd?: number | null;
  sourceSnippet?: string | null;
  extractionMethod?: string | null;
};

/**
 * Represents an ingredient the user explicitly asked to include.
 * These are hard obligations that must survive planning, generation, and step writing.
 */
export type RequiredNamedIngredient = {
  rawText: string;
  normalizedName: string;
  aliases: string[];
  quantityHintText?: string | null;
  source: "explicit_use" | "use_up" | "must_include" | "explicit_add";
  requiredStrength: "hard" | "soft";
  provenance?: IngredientConstraintProvenance | null;
};

export function normalizeIngredientToken(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns true if an ingredient name (from the recipe) satisfies a required named ingredient.
 * Uses exact match, substring containment, and alias matching.
 */
export function matchesRequiredIngredient(
  ingredientName: string,
  req: RequiredNamedIngredient
): boolean {
  const normalized = normalizeIngredientToken(ingredientName);
  const target = normalizeIngredientToken(req.normalizedName);

  if (normalized === target) return true;
  if (normalized.includes(target)) return true;

  for (const alias of req.aliases) {
    const a = normalizeIngredientToken(alias);
    if (!a) continue;
    if (normalized === a) return true;
    if (normalized.includes(a)) return true;
  }

  return false;
}

/**
 * Returns true if the ingredient's name or alias appears in any step text.
 */
export function ingredientMentionedInSteps(
  req: RequiredNamedIngredient,
  steps: Array<{ text: string }>
): boolean {
  const candidates = [req.normalizedName, ...req.aliases]
    .map(normalizeIngredientToken)
    .filter((s) => s.length > 2);

  for (const step of steps) {
    const stepNorm = normalizeIngredientToken(step.text);
    if (candidates.some((c) => stepNorm.includes(c))) {
      return true;
    }
  }

  return false;
}

/**
 * Build a RequiredNamedIngredient from a raw ingredient phrase.
 * Aliases are kept minimal — matching uses substring containment, not exhaustive lists.
 */
export function buildRequiredNamedIngredient(
  rawText: string,
  source: RequiredNamedIngredient["source"] = "must_include",
  provenance: IngredientConstraintProvenance | null = null
): RequiredNamedIngredient {
  const normalizedName = normalizeIngredientToken(rawText);
  // Generate one short-form alias for two-word ingredients (e.g. "sourdough discard" → "discard")
  // but only if the short form is longer than 4 chars to avoid false positives.
  const words = normalizedName.split(" ");
  const aliases: string[] = [];
  if (words.length === 2 && words[1].length > 4) {
    aliases.push(words[1]);
  }

  return {
    rawText,
    normalizedName,
    aliases,
    source,
    requiredStrength: "hard",
    provenance,
  };
}
