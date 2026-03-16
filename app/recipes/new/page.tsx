import { redirect } from "next/navigation";
import { NewRecipeForm } from "@/components/forms/NewRecipeForm";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export default async function NewRecipePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="mx-auto max-w-2xl page-shell">
      <div className="space-y-3">
        <p className="app-kicker">Create</p>
        <h1 className="page-title">Start a new dish</h1>
        <p className="max-w-2xl text-[16px] leading-7 text-[color:var(--muted)]">
          Capture the base recipe cleanly. You can refine it, save future versions, and build on it once it is in your cookbook.
        </p>
      </div>
      <NewRecipeForm />
    </div>
  );
}
