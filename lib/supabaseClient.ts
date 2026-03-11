import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/supabaseConfig";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

function getBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabasePublicEnv();

  browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}

export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_target, property, receiver) {
    return Reflect.get(getBrowserClient(), property, receiver);
  },
});
