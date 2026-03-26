import "server-only";

import { AsyncLocalStorage } from "async_hooks";
import type { AiUsageMetrics } from "./usageMetrics";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

type UsageContext = {
  userId: string;
  route: string;
};

const store = new AsyncLocalStorage<UsageContext>();

/**
 * Call once per request (after auth) to associate all downstream AI calls
 * with the current user and route. Uses AsyncLocalStorage so it flows through
 * any lib function without needing to thread the context explicitly.
 */
export function initAiUsageContext(ctx: UsageContext): void {
  store.enterWith(ctx);
}

/**
 * Called inside callAIWithMeta after each successful AI response.
 * Fire-and-forget — does not block the response path.
 */
export async function logCallUsage(model: string | undefined, usage: AiUsageMetrics): Promise<void> {
  const ctx = store.getStore();
  if (!ctx) return;

  const admin = createSupabaseAdminClient() as unknown as {
    from: (table: string) => {
      insert: (values: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
  const { error } = await admin.from("ai_usage_log").insert({
    user_id: ctx.userId,
    route: ctx.route,
    model: model ?? null,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cost_usd: usage.estimated_cost_usd,
  });

  if (error) {
    console.warn("Could not persist AI usage log:", error.message);
  }
}
