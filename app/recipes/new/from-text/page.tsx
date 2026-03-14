import { redirect } from "next/navigation";
import { NewRecipeFromTextForm } from "@/components/forms/NewRecipeFromTextForm";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export default async function NewRecipeFromTextPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="mx-auto max-w-3xl page-shell">
      <div className="space-y-3">
        <p className="app-kicker">Import</p>
        <h1 className="page-title">Import from text</h1>
        <p className="max-w-2xl text-[16px] leading-7 text-[color:var(--muted)]">
          Paste a recipe, let Chef structure it, then review the result before saving.
        </p>
      </div>
      <NewRecipeFromTextForm />
    </div>
  );
}
