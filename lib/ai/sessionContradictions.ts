import type { CanonicalRecipeSessionState } from "./contracts/sessionState";

export type SessionContradiction = {
  kind: "required_ingredient_removed" | "forbidden_ingredient_added" | "required_method_conflict" | "equipment_conflict";
  subject: string;
  message: string;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function includesPhrase(text: string, phrase: string) {
  const normalizedText = normalize(text);
  const normalizedPhrase = normalize(phrase);
  return normalizedPhrase.length > 0 && normalizedText.includes(normalizedPhrase);
}

function asksToRemove(message: string, phrase: string) {
  const normalizedMessage = normalize(message);
  return (
    new RegExp(`\\b(?:without|remove|skip|leave out|omit|no)\\s+${normalize(phrase).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(normalizedMessage) ||
    new RegExp(`\\b${normalize(phrase).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(?:out|off)\\b`, "i").test(normalizedMessage)
  );
}

function asksToAdd(message: string, phrase: string) {
  const normalizedMessage = normalize(message);
  return (
    new RegExp(`\\b(?:add|use|include|with|put in)\\s+${normalize(phrase).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(normalizedMessage) ||
    includesPhrase(normalizedMessage, phrase)
  );
}

export function detectSessionContradictions(
  sessionState: CanonicalRecipeSessionState | null | undefined,
  userMessage: string
): SessionContradiction[] {
  if (!sessionState) {
    return [];
  }

  const contradictions: SessionContradiction[] = [];

  for (const ingredient of sessionState.hard_constraints.required_named_ingredients) {
    if (asksToRemove(userMessage, ingredient)) {
      contradictions.push({
        kind: "required_ingredient_removed",
        subject: ingredient,
        message: `This conflicts with a locked required ingredient: ${ingredient}.`,
      });
    }
  }

  for (const ingredient of sessionState.hard_constraints.forbidden_ingredients) {
    if (asksToAdd(userMessage, ingredient)) {
      contradictions.push({
        kind: "forbidden_ingredient_added",
        subject: ingredient,
        message: `This conflicts with a locked forbidden ingredient: ${ingredient}.`,
      });
    }
  }

  const normalizedMessage = normalize(userMessage);
  if (
    sessionState.hard_constraints.required_techniques.includes("slow_cook") &&
    /\b(?:oven|bake|roast)\b/i.test(normalizedMessage) &&
    !/\bslow cooker\b/i.test(normalizedMessage)
  ) {
    contradictions.push({
      kind: "required_method_conflict",
      subject: "slow_cook",
      message: "This conflicts with the locked slow-cook method.",
    });
  }

  if (
    sessionState.hard_constraints.equipment_limits.includes("slow cooker") &&
    /\b(?:oven|sheet pan|skillet|air fryer|grill)\b/i.test(normalizedMessage) &&
    !/\bslow cooker\b/i.test(normalizedMessage)
  ) {
    contradictions.push({
      kind: "equipment_conflict",
      subject: "slow cooker",
      message: "This conflicts with the locked slow cooker equipment constraint.",
    });
  }

  return contradictions;
}

