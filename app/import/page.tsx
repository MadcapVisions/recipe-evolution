import { redirect } from "next/navigation";
import { ImportRecipeForm } from "@/components/import/ImportRecipeForm";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export default async function ImportPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return <ImportRecipeForm ownerId={user.id} />;
}
