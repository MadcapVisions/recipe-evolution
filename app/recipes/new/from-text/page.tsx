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
        <p className="app-kicker">Create</p>
        <h1 className="page-title">New recipe from text</h1>
      </div>
      <NewRecipeFromTextForm ownerId={user.id} />
    </div>
  );
}
