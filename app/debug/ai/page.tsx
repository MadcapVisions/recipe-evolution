import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { canAccessAdmin } from "@/lib/auth/adminAccess";

export default async function AiDebugPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (!canAccessAdmin(user.email)) {
    redirect("/dashboard");
  }

  redirect("/admin/logs#ai-debug");
}
