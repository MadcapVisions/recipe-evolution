import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export default async function MyRecipesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="page-shell">
      <h1 className="page-title">My Cookbook</h1>
      <p className="saas-card p-4 text-slate-600">Your saved dishes and working versions can live here.</p>
    </div>
  );
}
