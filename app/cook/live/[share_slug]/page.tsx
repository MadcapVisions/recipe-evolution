import { notFound } from "next/navigation";
import { LiveSessionClient } from "@/components/cook/LiveSessionClient";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

type LiveSessionPageProps = {
  params: Promise<{ share_slug: string }>;
};

type StepItem = {
  text: string;
  timer_seconds?: number;
};

const normalizeSteps = (value: unknown): StepItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null;
      }
      const maybeText = (item as Record<string, unknown>).text;
      const maybeTimer = (item as Record<string, unknown>).timer_seconds;
      if (typeof maybeText !== "string" || maybeText.trim().length === 0) {
        return null;
      }
      const parsed: StepItem = { text: maybeText };
      if (typeof maybeTimer === "number") {
        parsed.timer_seconds = maybeTimer;
      }
      return parsed;
    })
    .filter((item): item is StepItem => item !== null);
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
      steps={normalizeSteps(version.steps_json)}
    />
  );
}
