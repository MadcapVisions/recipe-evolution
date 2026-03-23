import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildRecipeFailureFixtureFromAttempt, type GenerationAttemptFailureRow } from "../lib/ai/evals/failureFixtureExport";

const OUTPUT_DIR = path.join(process.cwd(), "tests/fixtures/ai-failures");
const DEFAULT_LIMIT = 10;

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
  const stageFilter = typeof process.argv[3] === "string" && process.argv[3].trim().length > 0 ? process.argv[3].trim() : null;
  const admin = createScriptSupabaseAdminClient();

  let query = admin
    .from("ai_generation_attempts")
    .select("id, created_at, conversation_key, attempt_number, outcome, generator_payload_json, raw_model_output_json, normalized_recipe_json, verification_json")
    .neq("outcome", "passed")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (stageFilter) {
    query = query.eq("verification_json->>failure_stage", stageFilter);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Could not load failed generation attempts: ${error.message}`);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const rows = (data ?? []) as GenerationAttemptFailureRow[];
  for (const row of rows) {
    const fixture = buildRecipeFailureFixtureFromAttempt(row);
    const filePath = path.join(OUTPUT_DIR, `${fixture.id}.json`);
    fs.writeFileSync(filePath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
    process.stdout.write(`wrote ${path.relative(process.cwd(), filePath)}\n`);
  }

  process.stdout.write(`exported ${rows.length} fixture(s)${stageFilter ? ` for stage ${stageFilter}` : ""}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
