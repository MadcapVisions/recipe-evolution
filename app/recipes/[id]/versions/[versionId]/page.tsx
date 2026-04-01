import { notFound, redirect } from "next/navigation";
import { VersionDetailClient } from "@/components/recipes/version-detail/VersionDetailClient";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { loadCachedVersionDetailData } from "@/lib/versionDetailData";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/ai/featureFlags";

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

  const [data, postcookFeedbackEnabled, existingFeedback] = await Promise.all([
    loadCachedVersionDetailData(user.id, id, versionId),
    getFeatureFlag(FEATURE_FLAG_KEYS.POSTCOOK_FEEDBACK_V1, false),
    supabase
      .from("recipe_postcook_feedback")
      .select("id")
      .eq("user_id", user.id)
      .eq("recipe_version_id", versionId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (!data) {
    notFound();
  }

  const hasPostCookFeedback = !!existingFeedback.data;

  return (
    <VersionDetailClient
      recipeId={id}
      versionId={versionId}
      initialData={data}
      postcookFeedbackEnabled={postcookFeedbackEnabled}
      hasPostCookFeedback={hasPostCookFeedback}
    />
  );
}
