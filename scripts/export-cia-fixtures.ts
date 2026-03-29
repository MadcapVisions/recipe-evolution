import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildCiaFailureFixtureFromAdjudication, type CiaAdjudicationRow } from "../lib/ai/evals/ciaFixtureExport";

const OUTPUT_DIR = path.join(process.cwd(), "tests/fixtures/cia-failures");
const DEFAULT_LIMIT = 20;

function createScriptSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function main() {
  const limitArg = Number(process.argv[2] ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(limitArg) && limitArg > 0 ? Math.min(Math.floor(limitArg), 100) : DEFAULT_LIMIT;
  const flowFilter = typeof process.argv[3] === "string" && process.argv[3].trim().length > 0 ? process.argv[3].trim() : null;
  const admin = createScriptSupabaseAdminClient();

  let query = admin
    .from("ai_cia_adjudications")
    .select("id, created_at, flow, failure_kind, failure_stage, conversation_key, packet_json, result_json")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (flowFilter) {
    query = query.eq("flow", flowFilter);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Could not load CIA adjudications: ${error.message}`);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const rows = (data ?? []) as CiaAdjudicationRow[];
  for (const row of rows) {
    const fixture = buildCiaFailureFixtureFromAdjudication(row);
    const filePath = path.join(OUTPUT_DIR, `${fixture.id}.json`);
    fs.writeFileSync(filePath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
    process.stdout.write(`wrote ${path.relative(process.cwd(), filePath)}\n`);
  }

  process.stdout.write(`exported ${rows.length} CIA fixture(s)${flowFilter ? ` for flow ${flowFilter}` : ""}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
