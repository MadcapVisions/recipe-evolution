import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

const mealPlanEntrySchema = z.object({
  plan_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sort_order: z.number().int().min(0),
  recipe_id: z.string().uuid(),
  version_id: z.string().uuid(),
  servings: z.number().int().min(1),
});

const weekPayloadSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z.array(mealPlanEntrySchema),
});

function withinRange(date: string, startDate: string, endDate: string) {
  return date >= startDate && date <= endDate;
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: true, message: "Authentication required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");

  if (!startDate || !endDate) {
    return NextResponse.json({ error: true, message: "start_date and end_date are required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("meal_plan_entries")
    .select("plan_date, sort_order, recipe_id, version_id, servings")
    .eq("owner_id", user.id)
    .gte("plan_date", startDate)
    .lte("plan_date", endDate)
    .order("plan_date", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: true, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ entries: data ?? [] });
}

export async function PUT(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: true, message: "Authentication required." }, { status: 401 });
  }

  let payload;
  try {
    payload = weekPayloadSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: true, message: "Invalid planner payload." }, { status: 400 });
  }

  const { start_date: startDate, end_date: endDate, entries } = payload;
  const hasOutOfRangeEntry = entries.some((entry) => !withinRange(entry.plan_date, startDate, endDate));
  if (hasOutOfRangeEntry) {
    return NextResponse.json({ error: true, message: "Planner entries must stay within the requested week." }, { status: 400 });
  }

  const { error: deleteError } = await supabase
    .from("meal_plan_entries")
    .delete()
    .eq("owner_id", user.id)
    .gte("plan_date", startDate)
    .lte("plan_date", endDate);

  if (deleteError) {
    return NextResponse.json({ error: true, message: deleteError.message }, { status: 500 });
  }

  if (entries.length === 0) {
    return NextResponse.json({ ok: true, entries: [] });
  }

  const { data, error } = await supabase
    .from("meal_plan_entries")
    .insert(
      entries.map((entry) => ({
        owner_id: user.id,
        plan_date: entry.plan_date,
        sort_order: entry.sort_order,
        recipe_id: entry.recipe_id,
        version_id: entry.version_id,
        servings: entry.servings,
      }))
    )
    .select("plan_date, sort_order, recipe_id, version_id, servings")
    .order("plan_date", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: true, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, entries: data ?? [] });
}
