import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { canAccessAdmin } from "@/lib/auth/adminAccess";
import { getFeatureFlag, setFeatureFlag, invalidateFeatureFlagCache } from "@/lib/ai/featureFlags";

const ALLOWED_KEYS = ["graceful_mode"] as const;
type AllowedKey = (typeof ALLOWED_KEYS)[number];

const patchSchema = z.object({
  key: z.enum(ALLOWED_KEYS),
  value: z.boolean(),
});

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !canAccessAdmin(user.email)) {
    return null;
  }
  return user;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const flags: Record<AllowedKey, boolean> = {} as Record<AllowedKey, boolean>;
  for (const key of ALLOWED_KEYS) {
    flags[key] = await getFeatureFlag(key, false);
  }

  return NextResponse.json({ flags });
}

export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { key, value } = parsed.data;
  await setFeatureFlag(key, value);
  invalidateFeatureFlagCache(key);

  return NextResponse.json({ key, value });
}
