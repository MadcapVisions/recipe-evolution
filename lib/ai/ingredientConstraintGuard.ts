function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

const NON_INGREDIENT_QUESTION_PATTERNS = [
  /^(?:what|who|why|when|where)\s+(?:is|are|was|were)\b/,
  /^what's\b/,
  /^what does\b/,
  /^(?:how\s+(?:do|should|can|could|would)\s+i|how\s+to)\b/,
  /^(?:tell me about|explain|define|describe|meaning of)\b/,
];

export function isQuestionLikeIngredientCandidate(value: string): boolean {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  return NON_INGREDIENT_QUESTION_PATTERNS.some((pattern) => pattern.test(normalized));
}
