import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

type ProductEventRow = {
  id: string;
  event_name: string;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
  owner_id: string;
};

export async function getAdminAiDebugEvents() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("product_events")
    .select("id, owner_id, event_name, metadata_json, created_at")
    .in("event_name", ["chef_chat_repaired", "ai_route_failed"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Could not load AI debug events: ${error.message}`);
  }

  const events = (data ?? []) as ProductEventRow[];
  const repairedEvents = events.filter((event) => event.event_name === "chef_chat_repaired");
  const failedEvents = events.filter((event) => event.event_name === "ai_route_failed");

  return {
    events,
    repairedEvents,
    failedEvents,
    stats: {
      repairsLogged: repairedEvents.length,
      failuresLogged: failedEvents.length,
      homeHubRepairs: repairedEvents.filter((event) => event.metadata_json?.route === "home-hub").length,
      averageFinalReplyLength:
        repairedEvents.length > 0
          ? Math.round(repairedEvents.reduce((sum, event) => sum + Number(event.metadata_json?.final_reply_length ?? 0), 0) / repairedEvents.length)
          : 0,
    },
  };
}
