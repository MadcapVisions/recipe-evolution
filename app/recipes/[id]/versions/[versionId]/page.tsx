import { notFound, redirect } from "next/navigation";
import { VersionDetailClient } from "@/components/recipes/version-detail/VersionDetailClient";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { loadCachedVersionDetailData } from "@/lib/versionDetailData";

type VersionDetailPageProps = {
  params: Promise<{ id: string; versionId: string }>;
};

export default async function VersionDetailPage({ params }: VersionDetailPageProps) {
  const { id, versionId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const data = await loadCachedVersionDetailData(user.id, id, versionId);

  if (!data) {
    notFound();
  }

  return <VersionDetailClient recipeId={id} versionId={versionId} initialData={data} />;
}
