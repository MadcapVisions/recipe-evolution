import { replayRecipeFailureFixture, type RecipeFailureFixture } from "./failureFixtureReplay";

export type GenerationAttemptFailureRow = {
  id: string;
  created_at: string;
  conversation_key: string | null;
  attempt_number: number | null;
  outcome: string | null;
  generator_payload_json: Record<string, unknown> | null;
  raw_model_output_json: unknown;
  normalized_recipe_json: unknown;
  verification_json?: {
    failure_stage?: string | null;
    failure_context?: Record<string, unknown> | null;
  } | null;
};

function sanitizeFixtureToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function toRawText(rawModelOutput: unknown): string {
  if (typeof rawModelOutput === "string") {
    return rawModelOutput;
  }

  if (rawModelOutput && typeof rawModelOutput === "object" && !Array.isArray(rawModelOutput)) {
    const raw = rawModelOutput as Record<string, unknown>;
    if (typeof raw.text === "string" && raw.text.trim().length > 0) {
      return raw.text;
    }
    if (typeof raw.raw_text === "string" && raw.raw_text.trim().length > 0) {
      return raw.raw_text;
    }
  }

  return JSON.stringify(rawModelOutput ?? null, null, 2);
}

function resolveFallbackTitle(row: GenerationAttemptFailureRow) {
  const candidate = row.generator_payload_json?.ideaTitle;
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate.trim() : "Fallback Title";
}

function normalizeFailureContext(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .slice(0, 12);
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export function buildRecipeFailureFixtureFromAttempt(row: GenerationAttemptFailureRow): RecipeFailureFixture {
  const conversationToken = sanitizeFixtureToken(row.conversation_key ?? "conversation");
  const fixture: RecipeFailureFixture = {
    id: `${conversationToken}_attempt_${row.attempt_number ?? 1}_${sanitizeFixtureToken(row.outcome ?? "failed")}`,
    raw_text: toRawText(row.raw_model_output_json),
    fallback_title: resolveFallbackTitle(row),
    source: {
      attempt_id: row.id,
      created_at: row.created_at,
      conversation_key: row.conversation_key,
      attempt_number: row.attempt_number,
    },
    observed: {
      outcome: row.outcome ?? null,
      failure_stage: row.verification_json?.failure_stage ?? null,
      failure_context: normalizeFailureContext(row.verification_json?.failure_context ?? null),
    },
    expected: {
      parse_success: false,
      normalization_reason: null,
      structural_passes: null,
      title: null,
      outcome: null,
      failure_stage: null,
      failure_context: null,
    },
  };

  const replay = replayRecipeFailureFixture(fixture);
  fixture.expected = {
    parse_success: replay.parse_success,
    normalization_reason: replay.normalization_reason,
    structural_passes: replay.structural_passes,
    title: replay.normalized_title,
    outcome: replay.derived_outcome,
    failure_stage: replay.derived_failure_stage,
    failure_context: null,
  };

  return fixture;
}
