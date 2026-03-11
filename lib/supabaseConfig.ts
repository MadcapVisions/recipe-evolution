const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function requireSupabaseUrl(): string {
  if (!NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return NEXT_PUBLIC_SUPABASE_URL;
}

function requireSupabaseAnonKey(): string {
  if (!NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export function getSupabasePublicEnv() {
  return {
    supabaseUrl: requireSupabaseUrl(),
    supabaseAnonKey: requireSupabaseAnonKey(),
  };
}

export function hasSupabasePublicEnv() {
  return Boolean(NEXT_PUBLIC_SUPABASE_URL && NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
