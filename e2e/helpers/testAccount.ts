import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const testEmail = process.env.E2E_TEST_EMAIL;
const testPassword = process.env.E2E_TEST_PASSWORD;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing ${name} for authenticated e2e tests.`);
  }
  return value;
}

export function getTestCredentials() {
  return {
    email: requireEnv(testEmail, "E2E_TEST_EMAIL"),
    password: requireEnv(testPassword, "E2E_TEST_PASSWORD"),
  };
}

export function hasTestCredentials() {
  return Boolean(testEmail && testPassword && supabaseUrl && supabaseAnonKey);
}

export function hasServiceRole() {
  return Boolean(serviceRoleKey && supabaseUrl);
}

async function createAuthenticatedClient() {
  const client = createClient(
    requireEnv(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv(supabaseAnonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
  const { email, password } = getTestCredentials();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Could not sign in test user: ${error.message}`);
  }
  return client;
}

function createAdminClient() {
  return createClient(
    requireEnv(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function cleanupRecipesByTitlePrefix(titlePrefix: string) {
  const client = await createAuthenticatedClient();
  const { error } = await client.from("recipes").delete().like("title", `${titlePrefix}%`);
  await client.auth.signOut();
  if (error) {
    throw new Error(`Could not clean up e2e recipes: ${error.message}`);
  }
}

export async function cleanupPlannerEntriesForE2E() {
  const client = await createAuthenticatedClient();
  const { error } = await client.from("meal_plan_entries").delete().gte("plan_date", "2000-01-01").lte("plan_date", "2100-01-01");
  await client.auth.signOut();
  if (error) {
    throw new Error(`Could not clean up e2e planner entries: ${error.message}`);
  }
}

export async function setPantryStaplesForE2E(input: {
  pantryStaples: string[];
  pantryConfidentStaples?: string[];
}) {
  const client = await createAuthenticatedClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    throw new Error("Could not load authenticated e2e user for pantry settings.");
  }

  const { error } = await client.from("user_preferences").upsert(
    {
      owner_id: user.id,
      pantry_staples: input.pantryStaples,
      pantry_confident_staples: input.pantryConfidentStaples ?? [],
    },
    { onConflict: "owner_id" }
  );
  await client.auth.signOut();

  if (error) {
    throw new Error(`Could not set pantry staples for e2e: ${error.message}`);
  }
}

export async function createRecipeWithVersion(input: {
  title: string;
  description?: string;
  ingredients?: string[];
  steps?: string[];
  chefScore?: number;
}) {
  const client = await createAuthenticatedClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    throw new Error("Could not load authenticated e2e user.");
  }

  const { data: recipeRow, error: recipeError } = await client
    .from("recipes")
    .insert({
      owner_id: user.id,
      title: input.title,
      description: input.description ?? null,
    })
    .select("id")
    .single();

  if (recipeError || !recipeRow) {
    await client.auth.signOut();
    throw new Error(`Could not create e2e recipe: ${recipeError?.message ?? "unknown error"}`);
  }

  const { data: versionRow, error: versionError } = await client
    .from("recipe_versions")
    .insert({
      recipe_id: recipeRow.id,
      version_number: 1,
      ingredients_json: (input.ingredients ?? ["1 test ingredient"]).map((name) => ({ name })),
      steps_json: (input.steps ?? ["Test step"]).map((text) => ({ text })),
      change_log: "Initial version",
    })
    .select("id")
    .single();

  if (versionError || !versionRow) {
    await client.auth.signOut();
    throw new Error(`Could not create e2e recipe version: ${versionError?.message ?? "unknown error"}`);
  }

  const { error: recipeUpdateError } = await client
    .from("recipes")
    .update({ best_version_id: versionRow.id })
    .eq("id", recipeRow.id);

  if (recipeUpdateError) {
    throw new Error(`Could not mark e2e recipe best version: ${recipeUpdateError.message}`);
  }

  const { error: scoreError } = await client.from("recipe_scores").upsert({
    owner_id: user.id,
    recipe_version_id: versionRow.id,
    total_score: input.chefScore ?? 86,
    flavor_score: input.chefScore ?? 86,
    technique_score: input.chefScore ?? 86,
    texture_score: input.chefScore ?? 86,
    harmony_score: input.chefScore ?? 86,
    clarity_score: input.chefScore ?? 86,
    risk_score: input.chefScore ?? 86,
    extras_score: input.chefScore ?? 86,
    score_band: "strong",
    summary: "E2E seeded score",
    improvement_priorities: [],
    risk_flags: [],
    updated_at: new Date().toISOString(),
  });

  if (scoreError) {
    await client.auth.signOut();
    throw new Error(`Could not seed e2e recipe score: ${scoreError.message}`);
  }

  await client.auth.signOut();

  return {
    recipeId: recipeRow.id,
    versionId: versionRow.id,
  };
}

export async function setFeatureFlagForE2E(key: string, value: boolean) {
  const client = createAdminClient();
  const { error } = await client.from("feature_flags").upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );

  if (error) {
    throw new Error(`Could not set feature flag ${key}: ${error.message}`);
  }
}
