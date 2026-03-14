import { notFound } from "next/navigation";
import { LiveSessionClient } from "@/components/cook/LiveSessionClient";
import { readCanonicalSteps } from "@/lib/recipes/canonicalRecipe";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

type LiveSessionPageProps = {
  params: Promise<{ share_slug: string }>;
};

export default async function LiveSessionPage({ params }: LiveSessionPageProps) {
  const { share_slug } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: cookSession, error: sessionError } = await supabase
    .from("cook_sessions")
    .select("id, version_id, owner_id, share_slug, current_step_index, is_active")
    .eq("share_slug", share_slug)
    .maybeSingle();

  if (sessionError || !cookSession) {
    notFound();
  }

  const { data: version, error: versionError } = await supabase
    .from("recipe_versions")
    .select("id, steps_json")
    .eq("id", cookSession.version_id)
    .maybeSingle();

  if (versionError || !version) {
    notFound();
  }

  return (
    <LiveSessionClient
      sessionId={cookSession.id}
      shareSlug={cookSession.share_slug}
      isOwner={user?.id === cookSession.owner_id}
      initialStepIndex={cookSession.current_step_index}
      initialIsActive={cookSession.is_active}
      steps={readCanonicalSteps(version.steps_json)}
    />
  );
}
