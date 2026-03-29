import type { CookingBrief } from "./contracts/cookingBrief";
import type { LockedDirectionSession } from "./contracts/lockedDirectionSession";
import type { AIMessage, RecipeContext } from "./chatPromptBuilder";
import type { ConversationTurnRow } from "./conversationStore";

function normalizeMessageContent(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeHistory(messages: AIMessage[] | null | undefined): AIMessage[] {
  return (messages ?? [])
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role,
      content: normalizeMessageContent(message.content),
    }))
    .filter((message) => message.content.length > 0);
}

function normalizePersistedTurns(turns: ConversationTurnRow[] | null | undefined): AIMessage[] {
  return (turns ?? [])
    .map((turn) => ({
      role: turn.role,
      content: normalizeMessageContent(turn.message),
    }))
    .filter((message) => message.content.length > 0);
}

function findOverlap(persisted: AIMessage[], client: AIMessage[]) {
  const maxOverlap = Math.min(persisted.length, client.length);
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    let matches = true;
    for (let index = 0; index < overlap; index += 1) {
      const left = persisted[persisted.length - overlap + index];
      const right = client[index];
      if (!left || !right || left.role !== right.role || left.content !== right.content) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return overlap;
    }
  }
  return 0;
}

function dedupeAdjacent(messages: AIMessage[]) {
  const out: AIMessage[] = [];
  for (const message of messages) {
    const previous = out.at(-1);
    if (previous && previous.role === message.role && previous.content === message.content) {
      continue;
    }
    out.push(message);
  }
  return out;
}

function summarizeList(items: string[] | null | undefined, max = 6) {
  return (items ?? []).map((item) => item.trim()).filter(Boolean).slice(0, max);
}

export function mergeSessionConversationHistory(input: {
  persistedTurns?: ConversationTurnRow[] | null;
  clientHistory?: AIMessage[] | null;
  maxMessages?: number;
}) {
  const persisted = normalizePersistedTurns(input.persistedTurns);
  const client = normalizeHistory(input.clientHistory);
  const overlap = findOverlap(persisted, client);
  const merged = dedupeAdjacent([...persisted, ...client.slice(overlap)]);
  const maxMessages = input.maxMessages ?? 12;
  return merged.slice(-maxMessages);
}

export function buildSessionMemoryBlock(input: {
  brief?: CookingBrief | null;
  lockedSession?: LockedDirectionSession | null;
  recipeContext?: RecipeContext;
  conversationHistory?: AIMessage[] | null;
}) {
  const lines: string[] = [];
  const selectedDirection = input.lockedSession?.selected_direction ?? null;
  const brief = input.brief ?? null;

  if (selectedDirection) {
    lines.push(`Locked direction: ${selectedDirection.title}. ${selectedDirection.summary}`);
  }

  const normalizedName = brief?.dish.normalized_name?.trim() || input.recipeContext?.title?.trim() || null;
  if (normalizedName) {
    lines.push(`Active dish: ${normalizedName}`);
  }

  if (brief?.dish.dish_family) {
    lines.push(`Dish family: ${brief.dish.dish_family}`);
  }

  const hardRequired = summarizeList(
    (brief?.ingredients.requiredNamedIngredients ?? [])
      .filter((item) => item.requiredStrength === "hard")
      .map((item) => item.normalizedName)
  );
  if (hardRequired.length > 0) {
    lines.push(`Must keep: ${hardRequired.join(", ")}`);
  }

  const preferred = summarizeList(brief?.ingredients.preferred ?? []);
  if (preferred.length > 0) {
    lines.push(`Preferred ingredients: ${preferred.join(", ")}`);
  }

  const forbidden = summarizeList(brief?.ingredients.forbidden ?? []);
  if (forbidden.length > 0) {
    lines.push(`Avoid: ${forbidden.join(", ")}`);
  }

  const styles = summarizeList([
    ...(brief?.style.tags ?? []),
    ...(brief?.style.texture_tags ?? []),
    ...(brief?.style.format_tags ?? []),
  ]);
  if (styles.length > 0) {
    lines.push(`Style targets: ${styles.join(", ")}`);
  }

  const requiredTechniques = summarizeList(brief?.directives.required_techniques ?? []);
  if (requiredTechniques.length > 0) {
    lines.push(`Required methods: ${requiredTechniques.join(", ")}`);
  }

  const equipmentLimits = summarizeList(brief?.constraints.equipment_limits ?? []);
  if (equipmentLimits.length > 0) {
    lines.push(`Equipment constraints: ${equipmentLimits.join(", ")}`);
  }

  const transcript = (input.conversationHistory ?? [])
    .slice(-6)
    .map((message) => `${message.role === "user" ? "User" : "Chef"}: ${message.content}`);
  if (transcript.length > 0) {
    lines.push(`Recent transcript:\n${transcript.join("\n")}`);
  }

  if (lines.length === 0) {
    return null;
  }

  return `Session memory:
- Treat this as the current source of truth for the active dish and constraints.
- Stay anchored to this dish unless the user explicitly pivots away.
- If the user asks for different options again, keep the same dish/theme unless they explicitly request a new dish.
${lines.map((line) => `- ${line}`).join("\n")}`;
}
