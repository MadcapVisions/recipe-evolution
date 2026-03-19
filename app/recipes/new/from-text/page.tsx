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
      <div className="space-y-3 rounded-[28px] border border-[rgba(142,84,60,0.1)] bg-[radial-gradient(circle_at_top_left,rgba(210,76,47,0.08),transparent_28%),linear-gradient(180deg,rgba(255,251,246,0.98)_0%,rgba(255,245,236,0.94)_100%)] p-6 shadow-[0_14px_30px_rgba(101,47,29,0.06)]">
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
