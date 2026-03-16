import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccessAdmin } from "@/lib/auth/adminAccess";
import { invalidateAiTaskSettingsCache, listAiTaskSettings } from "@/lib/ai/taskSettings";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

const taskSettingSchema = z.object({
  taskKey: z.enum(["chef_chat", "home_ideas", "home_recipe", "recipe_improvement", "recipe_structure"]),
  primaryModel: z.string().trim().min(1).max(200),
  fallbackModel: z.string().trim().max(200).nullable().optional(),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().min(1).max(4000),
  enabled: z.boolean(),
});

const updateAiTaskSettingsSchema = z.object({
  settings: z.array(taskSettingSchema).min(1),
});

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: true, message: "Authentication required." }, { status: 401 });
  }

  if (!canAccessAdmin(user.email)) {
    return NextResponse.json({ error: true, message: "Admin access required." }, { status: 403 });
  }

  let body;
  try {
    body = updateAiTaskSettingsSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: true, message: "Invalid AI task settings payload." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const rows = body.settings.map((item) => ({
    task_key: item.taskKey,
    primary_model: item.primaryModel,
    fallback_model: item.fallbackModel?.trim() ? item.fallbackModel.trim() : null,
    temperature: item.temperature,
    max_tokens: item.maxTokens,
    enabled: item.enabled,
    updated_by: user.id,
  }));

  const { error } = await (admin.from("ai_task_settings") as any).upsert(rows, { onConflict: "task_key" });
  if (error) {
    return NextResponse.json({ error: true, message: error.message }, { status: 500 });
  }

  invalidateAiTaskSettingsCache();
  const settings = await listAiTaskSettings({ bypassCache: true });

  return NextResponse.json({ settings });
}
