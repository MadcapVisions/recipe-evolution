import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const testEmail = process.env.E2E_TEST_EMAIL;
const testPassword = process.env.E2E_TEST_PASSWORD;

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

export async function cleanupRecipesByTitlePrefix(titlePrefix: string) {
  const client = await createAuthenticatedClient();
  const { error } = await client.from("recipes").delete().like("title", `${titlePrefix}%`);
  await client.auth.signOut();
  if (error) {
    throw new Error(`Could not clean up e2e recipes: ${error.message}`);
  }
}

export async function createRecipeWithVersion(input: {
  title: string;
  description?: string;
  ingredients?: string[];
  steps?: string[];
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

  await client.auth.signOut();

  if (versionError || !versionRow) {
    throw new Error(`Could not create e2e recipe version: ${versionError?.message ?? "unknown error"}`);
  }

  return {
    recipeId: recipeRow.id,
    versionId: versionRow.id,
  };
}
