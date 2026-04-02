import { expect, type Page } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { getTestCredentials } from "./testAccount";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const appBaseUrl = "http://127.0.0.1:3011";

function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing ${name} for authenticated e2e tests.`);
  }
  return value;
}

function toSameSite(value: boolean | string | undefined): "Lax" | "None" | "Strict" | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  switch (value?.toLowerCase()) {
    case "lax":
      return "Lax";
    case "none":
      return "None";
    case "strict":
      return "Strict";
    default:
      return undefined;
  }
}

async function createSessionCookies() {
  const cookiesToSet: Array<{
    name: string;
    value: string;
    options?: {
      path?: string;
      maxAge?: number;
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: boolean | string;
    };
  }> = [];

  const client = createServerClient(
    requireEnv(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv(supabaseAnonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll(nextCookies) {
          cookiesToSet.splice(0, cookiesToSet.length, ...nextCookies);
        },
      },
    }
  );

  const { email, password } = getTestCredentials();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Could not create e2e browser session: ${error.message}`);
  }

  return cookiesToSet.map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    url: appBaseUrl,
    httpOnly: cookie.options?.httpOnly ?? false,
    secure: cookie.options?.secure ?? false,
    sameSite: toSameSite(cookie.options?.sameSite),
    expires:
      typeof cookie.options?.maxAge === "number"
        ? Math.floor(Date.now() / 1000) + cookie.options.maxAge
        : undefined,
  }));
}

export async function signInAsTestUser(page: Page) {
  const sessionCookies = await createSessionCookies();
  await page.context().addCookies(sessionCookies);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
}
