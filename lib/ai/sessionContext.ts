import type { CookingBrief } from "./contracts/cookingBrief";
import type { LockedDirectionSession } from "./contracts/lockedDirectionSession";
import type { AIMessage, RecipeContext } from "./chatPromptBuilder";
import type { ConversationTurnRow } from "./conversationStore";
import type { AiConversationScope } from "./briefStore";
import type { CanonicalRecipeSessionState } from "./contracts/sessionState";

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

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function preferNonEmptyArray(next: string[], previous: string[]) {
  return next.length > 0 ? next : previous;
}

function mergeRejectedBranches(
  previous: CanonicalRecipeSessionState["rejected_branches"] | null | undefined,
  next: CanonicalRecipeSessionState["rejected_branches"] | null | undefined
) {
  const merged = [...(previous ?? []), ...(next ?? [])];
  const seen = new Set<string>();
  const deduped: CanonicalRecipeSessionState["rejected_branches"] = [];
  for (const item of merged) {
    const title = item.title.trim();
    if (!title) continue;
    const key = `${title.toLowerCase()}::${(item.reason ?? "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({
      title,
      reason: item.reason?.trim() || null,
    });
  }
  return deduped;
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

export function buildCanonicalSessionState(input: {
  conversationKey: string;
  scope: AiConversationScope;
  recipeId?: string | null;
  versionId?: string | null;
  brief?: CookingBrief | null;
  lockedSession?: LockedDirectionSession | null;
  recipeContext?: RecipeContext;
  conversationHistory?: AIMessage[] | null;
  previousState?: CanonicalRecipeSessionState | null;
  updatedBy: string;
}): CanonicalRecipeSessionState {
  const brief = input.brief ?? null;
  const selectedDirection = input.lockedSession?.selected_direction ?? null;
  const normalizedName = brief?.dish.normalized_name?.trim() || input.recipeContext?.title?.trim() || null;
  const conversationHistory = input.conversationHistory ?? [];
  const lastUserMessage =
    [...conversationHistory].reverse().find((message) => message.role === "user")?.content?.trim() || null;
  const lastAssistantMessage =
    [...conversationHistory].reverse().find((message) => message.role === "assistant")?.content?.trim() || null;

  return {
    conversation_key: input.conversationKey,
    scope: input.scope,
    recipe_id: input.recipeId ?? null,
    version_id: input.versionId ?? null,
    active_dish: {
      title: normalizedName,
      dish_family: brief?.dish.dish_family ?? null,
      locked: Boolean(selectedDirection || brief?.field_state.dish_family === "locked" || brief?.request_mode === "locked"),
    },
    selected_direction: selectedDirection
      ? {
          id: selectedDirection.id,
          title: selectedDirection.title,
          summary: selectedDirection.summary,
          tags: selectedDirection.tags,
        }
      : null,
    hard_constraints: {
      required_named_ingredients: unique(
        (brief?.ingredients.requiredNamedIngredients ?? [])
          .filter((item) => item.requiredStrength === "hard")
          .map((item) => item.normalizedName)
      ),
      required_ingredients: unique(brief?.ingredients.required ?? []),
      forbidden_ingredients: unique(brief?.ingredients.forbidden ?? []),
      required_techniques: unique(brief?.directives.required_techniques ?? []),
      equipment_limits: unique(brief?.constraints.equipment_limits ?? []),
    },
    soft_preferences: {
      preferred_ingredients: unique(brief?.ingredients.preferred ?? []),
      style_tags: unique([
        ...(brief?.style.tags ?? []),
        ...(brief?.style.texture_tags ?? []),
        ...(brief?.style.format_tags ?? []),
      ]),
      nice_to_have: unique(brief?.directives.nice_to_have ?? []),
    },
    rejected_branches: input.previousState?.rejected_branches ?? [],
    recipe_context: input.recipeContext
      ? {
          title: input.recipeContext.title?.trim() || null,
          ingredients: summarizeList(input.recipeContext.ingredients ?? [], 12),
          steps: summarizeList(input.recipeContext.steps ?? [], 8),
        }
      : null,
    conversation: {
      last_user_message: lastUserMessage,
      last_assistant_message: lastAssistantMessage,
      turn_count: conversationHistory.length,
    },
    source: {
      updated_by: input.updatedBy,
      brief_confidence: brief?.confidence ?? null,
    },
  };
}

export function updateCanonicalSessionState(input: {
  conversationKey: string;
  scope: AiConversationScope;
  recipeId?: string | null;
  versionId?: string | null;
  brief?: CookingBrief | null;
  lockedSession?: LockedDirectionSession | null;
  recipeContext?: RecipeContext;
  conversationHistory?: AIMessage[] | null;
  previousState?: CanonicalRecipeSessionState | null;
  updatedBy: string;
}) {
  const previous = input.previousState ?? null;
  const next = buildCanonicalSessionState(input);

  return {
    conversation_key: next.conversation_key,
    scope: next.scope,
    recipe_id: next.recipe_id ?? previous?.recipe_id ?? null,
    version_id: next.version_id ?? previous?.version_id ?? null,
    active_dish: {
      title: next.active_dish.title ?? previous?.active_dish.title ?? null,
      dish_family: next.active_dish.dish_family ?? previous?.active_dish.dish_family ?? null,
      locked: next.active_dish.locked || previous?.active_dish.locked || false,
    },
    selected_direction: next.selected_direction ?? previous?.selected_direction ?? null,
    hard_constraints: {
      required_named_ingredients: preferNonEmptyArray(
        next.hard_constraints.required_named_ingredients,
        previous?.hard_constraints.required_named_ingredients ?? []
      ),
      required_ingredients: preferNonEmptyArray(
        next.hard_constraints.required_ingredients,
        previous?.hard_constraints.required_ingredients ?? []
      ),
      forbidden_ingredients: preferNonEmptyArray(
        next.hard_constraints.forbidden_ingredients,
        previous?.hard_constraints.forbidden_ingredients ?? []
      ),
      required_techniques: preferNonEmptyArray(
        next.hard_constraints.required_techniques,
        previous?.hard_constraints.required_techniques ?? []
      ),
      equipment_limits: preferNonEmptyArray(
        next.hard_constraints.equipment_limits,
        previous?.hard_constraints.equipment_limits ?? []
      ),
    },
    soft_preferences: {
      preferred_ingredients: preferNonEmptyArray(
        next.soft_preferences.preferred_ingredients,
        previous?.soft_preferences.preferred_ingredients ?? []
      ),
      style_tags: preferNonEmptyArray(
        next.soft_preferences.style_tags,
        previous?.soft_preferences.style_tags ?? []
      ),
      nice_to_have: preferNonEmptyArray(
        next.soft_preferences.nice_to_have,
        previous?.soft_preferences.nice_to_have ?? []
      ),
    },
    rejected_branches: mergeRejectedBranches(previous?.rejected_branches, next.rejected_branches),
    recipe_context: next.recipe_context ?? previous?.recipe_context ?? null,
    conversation: next.conversation,
    source: {
      updated_by: next.source.updated_by,
      brief_confidence: next.source.brief_confidence ?? previous?.source.brief_confidence ?? null,
    },
  } satisfies CanonicalRecipeSessionState;
}

export function buildSessionMemoryBlock(input: {
  sessionState?: CanonicalRecipeSessionState | null;
  brief?: CookingBrief | null;
  lockedSession?: LockedDirectionSession | null;
  recipeContext?: RecipeContext;
  conversationHistory?: AIMessage[] | null;
}) {
  const state =
    input.sessionState ??
    buildCanonicalSessionState({
      conversationKey: "transient",
      scope: "home_hub",
      brief: input.brief ?? null,
      lockedSession: input.lockedSession ?? null,
      recipeContext: input.recipeContext,
      conversationHistory: input.conversationHistory ?? [],
      updatedBy: "session_memory",
    });

  const lines: string[] = [];

  if (state.selected_direction) {
    lines.push(`Locked direction: ${state.selected_direction.title}. ${state.selected_direction.summary}`);
  }

  if (state.active_dish.title) {
    lines.push(`Active dish: ${state.active_dish.title}`);
  }

  if (state.active_dish.dish_family) {
    lines.push(`Dish family: ${state.active_dish.dish_family}`);
  }

  const hardRequired = summarizeList(state.hard_constraints.required_named_ingredients);
  if (hardRequired.length > 0) {
    lines.push(`Must keep: ${hardRequired.join(", ")}`);
  }

  const preferred = summarizeList(state.soft_preferences.preferred_ingredients);
  if (preferred.length > 0) {
    lines.push(`Preferred ingredients: ${preferred.join(", ")}`);
  }

  const forbidden = summarizeList(state.hard_constraints.forbidden_ingredients);
  if (forbidden.length > 0) {
    lines.push(`Avoid: ${forbidden.join(", ")}`);
  }

  const styles = summarizeList(state.soft_preferences.style_tags);
  if (styles.length > 0) {
    lines.push(`Style targets: ${styles.join(", ")}`);
  }

  const requiredTechniques = summarizeList(state.hard_constraints.required_techniques);
  if (requiredTechniques.length > 0) {
    lines.push(`Required methods: ${requiredTechniques.join(", ")}`);
  }

  const equipmentLimits = summarizeList(state.hard_constraints.equipment_limits);
  if (equipmentLimits.length > 0) {
    lines.push(`Equipment constraints: ${equipmentLimits.join(", ")}`);
  }

  if (state.rejected_branches.length > 0) {
    lines.push(
      `Rejected branches: ${state.rejected_branches
        .slice(-4)
        .map((item) => (item.reason ? `${item.title} (${item.reason})` : item.title))
        .join(", ")}`
    );
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
