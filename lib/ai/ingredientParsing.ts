// Deterministic, rule-based ingredient phrase parser.
// Extracts the core ingredient nucleus from noisy user language.
// This is a pure extraction step — canonical resolution is handled separately by ingredientResolver.

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

// ---- Strip patterns (applied in order) ----

// Leading conversational / intent markers
const LEADING_INTENT_PATTERN =
  /^(?:can we add|can we use|let(?:'?s)? add|let(?:'?s)? use|how about|what about|maybe add|maybe use|maybe some|maybe|perhaps|possibly|would love some|i(?:'d| would) love(?: some)?|i(?:'m| am) craving|craving|i need|can you add|please add|add in|add|include|put in|i want|we want|try adding)\s+/i;

// Leading quantity expressions (number + optional unit)
const LEADING_QUANTITY_PATTERN =
  /^(?:\d+(?:[.,]\d+)?(?:\s*(?:\/)\s*\d+)?|a\s+(?:few|couple\s+of|bit\s+of|handful\s+of|little|touch\s+of|dash\s+of)|half\s+a?|some|one|two|three|four|five|six|seven|eight|nine|ten)\s+/i;

// Leading unit words (after quantity stripping removes the number)
const LEADING_UNIT_PATTERN =
  /^(?:cups?|tablespoons?|tbsp|teaspoons?|tsp|ounces?|oz|pounds?|lbs?|grams?|g|kilograms?|kg|cans?|jars?|bottles?|bags?|boxes?|packages?|bunches?|heads?|cloves?|pieces?|slices?|sprigs?|stalks?|strips?|sheets?|knobs?|pinch(?:es)?|dash(?:es)?|handful(?:s)?|scoop(?:s)?)\s+(?:of\s+)?/i;

// Leading packaging descriptors (not identity-defining)
const LEADING_PACKAGING_PATTERN =
  /^(?:canned|packaged)\s+/i;

// Leading prep words that are pure technique (not identity)
const LEADING_PREP_PATTERN =
  /^(?:chopped|diced|minced|sliced|julienned|grated|shredded|crumbled|torn|bruised|drained|rinsed|washed|peeled|halved|quartered|roughly\s+chopped|finely\s+chopped|finely\s+diced|finely\s+minced|thinly\s+sliced)\s+/i;

// Leading "fresh" — informational, not identity (Thai basil is "thai" not "fresh")
const LEADING_FRESH_PATTERN = /^fresh\s+(?=\S)/i;

// Trailing prep qualifiers appended with comma (e.g. "beans, drained")
const TRAILING_PREP_SUFFIX_PATTERN =
  /\s*,\s*(?:drained|rinsed|washed|peeled|halved|quartered|toasted|thawed|defrosted|chopped|diced|minced|sliced|grated|shredded|crumbled|torn|at room temperature)\b.*/i;

// Trailing conversational context
const TRAILING_CONTEXT_PATTERN =
  /\b(?:to|for|in|into|on|with)\s+(?:this|it|that|there|here|the dish|the recipe|the pasta|the tacos|the sauce|the bowl|the salad|the soup)\b.*$/i;

// Trailing polite / hedge endings
const TRAILING_POLITE_PATTERN =
  /\b(?:please|if you can|if possible|or whatever|on top|on the side|as a garnish)\b.*$/i;

// Trailing noise like "or something", "or similar"
const TRAILING_OR_SOMETHING_PATTERN = /\s+or\s+(?:something|similar|anything)\b.*$/i;

// ---- Phrase validity ----

// Phrases that look like ingredient candidates but are not
const INVALID_FULL_PHRASES = new Set([
  "something",
  "something creamy",
  "something spicy",
  "something brighter",
  "something lighter",
  "something heartier",
  "anything",
  "anything else",
  "make it",
  "make it nice",
  "make it spicy",
  "keep it spicy",
  "spicy",
  "bright",
  "crispy",
  "crunchy",
  "creamy",
  "lighter",
  "richer",
  "heartier",
  "traditional",
  "more flavor",
  "more depth of flavor",
  "depth of flavor",
  "flavor",
  "it",
  "this",
  "that",
  "more",
  "less",
  "better",
  "different",
]);

// Single tokens that are never ingredients on their own
const BARE_TOKEN_BLOCKLIST = new Set([
  "protein",
  "dish",
  "recipe",
  "meal",
  "ingredient",
  "food",
  "it",
  "this",
  "that",
  "more",
  "less",
  "bit",
  "some",
  "thing",
  "stuff",
]);

function stripLeading(text: string): string {
  let current = text;
  let changed = true;

  // Multi-pass: keep stripping until nothing changes
  while (changed) {
    changed = false;

    const after = current
      .replace(LEADING_INTENT_PATTERN, "")
      .replace(LEADING_QUANTITY_PATTERN, "")
      .replace(LEADING_UNIT_PATTERN, "")
      .replace(LEADING_PACKAGING_PATTERN, "")
      .replace(LEADING_PREP_PATTERN, "")
      .replace(LEADING_FRESH_PATTERN, "")
      .replace(/^(?:for me|for us)\s+/i, "")
      .trimStart();

    if (after !== current) {
      current = normalizeWhitespace(after);
      changed = true;
    }
  }

  return current;
}

function stripTrailing(text: string): string {
  return normalizeWhitespace(
    text
      .replace(TRAILING_PREP_SUFFIX_PATTERN, "")
      .replace(TRAILING_CONTEXT_PATTERN, "")
      .replace(TRAILING_POLITE_PATTERN, "")
      .replace(TRAILING_OR_SOMETHING_PATTERN, "")
      .replace(/[.?!,;:]+$/, "")
  );
}

/**
 * Parse a raw ingredient-like phrase into its core ingredient nucleus.
 * Returns null if the phrase does not contain a usable ingredient.
 *
 * Examples:
 *   "2 cans great northern beans, drained" → "great northern beans"
 *   "some fresh Thai basil"                → "thai basil"
 *   "can we add white beans to this"       → "white beans"
 *   "maybe a little pecorino on top"       → "pecorino"
 *   "something brighter"                   → null
 *   "make it spicy"                        → null
 *   "dark soy sauce"                       → "dark soy sauce"  (identity preserved)
 *   "smoked paprika"                       → "smoked paprika"  (identity preserved)
 */
export function parseIngredientPhrase(raw: string): string | null {
  if (!raw || typeof raw !== "string") {
    return null;
  }

  let text = normalizeWhitespace(raw);
  if (!text) {
    return null;
  }

  // Strip leading filler and trailing context
  text = stripLeading(text);
  text = stripTrailing(text);
  text = normalizeWhitespace(text);

  if (!text) {
    return null;
  }

  // Reject "make it X" / "keep it X" patterns
  const lower = text.toLowerCase();
  if (/^(?:make|keep|be)\s+it\b/.test(lower)) {
    return null;
  }

  // Reject phrases that start with "something" or "anything" — always filler
  if (/^(?:something|anything)\b/.test(lower)) {
    return null;
  }

  // Reject invalid full phrases
  if (INVALID_FULL_PHRASES.has(lower)) {
    return null;
  }

  // Reject bare single tokens that are never ingredients
  const tokens = lower.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 1 && BARE_TOKEN_BLOCKLIST.has(tokens[0]!)) {
    return null;
  }

  // Reject very short single characters or numbers alone
  if (text.length <= 1) {
    return null;
  }

  return lower;
}

/**
 * Returns true if the phrase is clearly conversational filler with no ingredient content.
 */
export function isConversationalFiller(phrase: string): boolean {
  return parseIngredientPhrase(phrase) === null;
}
