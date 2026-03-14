import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const pantryPayloadSchema = z.object({
  item: z.string().min(1),
  stocked: z.boolean(),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: true, message: "Authentication required." }, { status: 401 });
  }

  let payload;
  try {
    payload = pantryPayloadSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: true, message: "Invalid pantry payload." }, { status: 400 });
  }

  const normalizedItem = payload.item.trim().toLowerCase();
  const { data: existing, error: readError } = await supabase
    .from("user_preferences")
    .select("pantry_confident_staples")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: true, message: readError.message }, { status: 500 });
  }

  const current = Array.isArray(existing?.pantry_confident_staples)
    ? existing.pantry_confident_staples.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
    : [];

  const next = payload.stocked
    ? Array.from(new Set([...current, normalizedItem]))
    : current.filter((item) => item !== normalizedItem);

  const { error: updateError } = await supabase
    .from("user_preferences")
    .upsert(
      {
        owner_id: user.id,
        pantry_confident_staples: next.length > 0 ? next : null,
      },
      { onConflict: "owner_id" }
    );

  if (updateError) {
    return NextResponse.json({ error: true, message: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ stockedItems: next });
}
