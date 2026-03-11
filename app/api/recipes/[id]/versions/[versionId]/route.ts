import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { loadVersionDetailData } from "@/lib/versionDetailData";

type RouteContext = {
  params: Promise<{ id: string; versionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id, versionId } = await context.params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await loadVersionDetailData(supabase, user.id, id, versionId);
  if (!data) {
    return NextResponse.json({ error: "Version not found or access denied." }, { status: 404 });
  }
  return NextResponse.json(data);
}
