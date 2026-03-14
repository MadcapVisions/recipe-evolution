import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { loadCachedRecipeBrowsePage, type RecipeBrowseSort, type RecipeBrowseTab } from "@/lib/recipeBrowseData";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const tab = (url.searchParams.get("tab") as RecipeBrowseTab | null) ?? "active";
  const sort = (url.searchParams.get("sort") as RecipeBrowseSort | null) ?? "recent";
  const search = url.searchParams.get("search") ?? "";
  const offset = Math.max(Number(url.searchParams.get("offset") ?? "0") || 0, 0);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "24") || 24, 1), 48);

  try {
    const result = await loadCachedRecipeBrowsePage(user.id, {
      tab: tab === "hidden" || tab === "archived" ? tab : "active",
      sort: sort === "alphabetical" || sort === "favorites" ? sort : "recent",
      search,
      offset,
      limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: true, message: error instanceof Error ? error.message : "Could not load recipes." },
      { status: 500 }
    );
  }
}
