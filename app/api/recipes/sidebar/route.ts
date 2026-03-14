import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import {
  loadCachedRecipeSidebarData,
  loadCachedRecipeSidebarFavoriteRecipes,
  loadCachedRecipeSidebarRecentRecipes,
} from "@/lib/recipeSidebarData";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const section = new URL(request.url).searchParams.get("section") ?? "all";
  const data =
    section === "favorites"
      ? await loadCachedRecipeSidebarFavoriteRecipes(user.id)
      : section === "recent"
        ? await loadCachedRecipeSidebarRecentRecipes(user.id)
        : await loadCachedRecipeSidebarData(user.id);

  if (!data) {
    return NextResponse.json({ error: "Could not load recipe sidebar." }, { status: 500 });
  }

  return NextResponse.json(data);
}
