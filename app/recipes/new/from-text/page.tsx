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
        <h1 className="page-title">Turn pasted text into a workable recipe</h1>
        <p className="max-w-2xl text-[16px] leading-7 text-[color:var(--muted)]">
          Paste from notes, a website, or an old document. Chef will structure it into editable fields so you can save a clean starting version in your cookbook.
        </p>
      </div>
      <NewRecipeFromTextForm />
    </div>
  );
}
