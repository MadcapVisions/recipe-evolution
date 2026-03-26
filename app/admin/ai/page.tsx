import { redirect } from "next/navigation";
import { AiTaskSettingsForm } from "@/components/admin/AiTaskSettingsForm";
import { canAccessAdmin } from "@/lib/auth/adminAccess";
import { listOpenRouterModels } from "@/lib/ai/openRouterModels";
import { listAiTaskSettings } from "@/lib/ai/taskSettings";
import { getFeatureFlag } from "@/lib/ai/featureFlags";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export default async function AdminAiPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (!canAccessAdmin(user.email)) {
    redirect("/dashboard");
  }

  const [settings, modelOptions, gracefulModeEnabled] = await Promise.all([
    listAiTaskSettings({ bypassCache: true }),
    listOpenRouterModels(),
    getFeatureFlag("graceful_mode", false),
  ]);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="app-kicker">AI settings</p>
        <h2 className="text-[28px] font-semibold tracking-tight text-[color:var(--text)]">Task-based model routing</h2>
        <p className="max-w-3xl text-[16px] leading-7 text-[color:var(--muted)]">
          Recipe Evolution now routes AI through OpenRouter. Use this page to choose which model powers each AI task without redeploying the app.
        </p>
      </div>

      <AiTaskSettingsForm initialSettings={settings} modelOptions={modelOptions} initialGracefulMode={gracefulModeEnabled} />
    </div>
  );
}
