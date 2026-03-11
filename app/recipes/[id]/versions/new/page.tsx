import { notFound, redirect } from "next/navigation";
import { NewVersionForm } from "@/components/forms/NewVersionForm";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

type NewVersionPageProps = {
  params: Promise<{ id: string }>;
};

export default async function NewVersionPage({ params }: NewVersionPageProps) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: recipe, error } = await supabase
    .from("recipes")
    .select("id, title")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error || !recipe) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl page-shell">
      <div className="space-y-3">
        <p className="app-kicker">Versioning</p>
        <h1 className="page-title">New Version: {recipe.title}</h1>
      </div>
      <NewVersionForm recipeId={recipe.id} />
    </div>
  );
}
