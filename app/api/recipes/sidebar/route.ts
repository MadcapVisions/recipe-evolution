import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { loadRecipeSidebarData } from "@/lib/recipeSidebarData";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await loadRecipeSidebarData(supabase, user.id);
  if (!data) {
    return NextResponse.json({ error: "Could not load recipe sidebar." }, { status: 500 });
  }

  return NextResponse.json(data);
}
