import type { FailureAdjudication } from "../failureAdjudicator";

export type CiaAdjudicationRow = {
  id: string;
  created_at: string;
  flow: "home_create" | "recipe_improve" | "recipe_import";
  failure_kind: string;
  failure_stage: string | null;
  conversation_key: string | null;
  packet_json: Record<string, unknown> | null;
  result_json: Record<string, unknown> | null;
};

export type CiaFailureFixture = {
  id: string;
  source: {
    adjudication_id: string;
    created_at: string;
    conversation_key: string | null;
  };
  flow: "home_create" | "recipe_improve" | "recipe_import";
  failure_kind: string;
  failure_stage: string | null;
  packet: Record<string, unknown>;
  observed: Partial<FailureAdjudication> | null;
};

function sanitizeToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

export function buildCiaFailureFixtureFromAdjudication(row: CiaAdjudicationRow): CiaFailureFixture {
  return {
    id: `${sanitizeToken(row.flow)}_${sanitizeToken(row.failure_kind)}_${sanitizeToken(row.id)}`,
    source: {
      adjudication_id: row.id,
      created_at: row.created_at,
      conversation_key: row.conversation_key,
    },
    flow: row.flow,
    failure_kind: row.failure_kind,
    failure_stage: row.failure_stage,
    packet: row.packet_json ?? {},
    observed:
      row.result_json && typeof row.result_json === "object" && !Array.isArray(row.result_json)
        ? (row.result_json as Partial<FailureAdjudication>)
        : null,
  };
}
