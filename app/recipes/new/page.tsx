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
    <div className="mx-auto max-w-xl page-shell">
      <div className="space-y-3">
        <p className="app-kicker">Create</p>
        <h1 className="page-title">New recipe</h1>
      </div>
      <NewRecipeForm ownerId={user.id} />
    </div>
  );
}
