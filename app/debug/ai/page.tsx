import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

type ProductEventRow = {
  id: string;
  event_name: string;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
};

export default async function AiDebugPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data, error } = await supabase
    .from("product_events")
    .select("id, event_name, metadata_json, created_at")
    .eq("owner_id", user.id)
    .eq("event_name", "chef_chat_repaired")
    .order("created_at", { ascending: false })
    .limit(50);

  const events = (data ?? []) as ProductEventRow[];

  return (
    <div className="mx-auto max-w-5xl page-shell">
      <div className="space-y-3">
        <p className="app-kicker">Debug</p>
        <h1 className="page-title">AI Repair Events</h1>
        <p className="text-[16px] leading-7 text-[color:var(--muted)]">
          These events are logged when the chef chat returns an incomplete answer and the server has to repair it before sending it back to the UI.
        </p>
      </div>

      <section className="saas-card p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Repairs logged" value={String(events.length)} />
          <StatCard
            label="Home hub repairs"
            value={String(events.filter((event) => event.metadata_json?.route === "home-hub").length)}
          />
          <StatCard
            label="Recipe page repairs"
            value={String(events.filter((event) => event.metadata_json?.route === "chef-chat").length)}
          />
          <StatCard
            label="Avg final length"
            value={
              events.length > 0
                ? String(
                    Math.round(
                      events.reduce((sum, event) => sum + Number(event.metadata_json?.final_reply_length ?? 0), 0) / events.length
                    )
                  )
                : "0"
            }
          />
        </div>
      </section>

      <section className="saas-card overflow-hidden">
        <div className="border-b border-[rgba(57,75,70,0.08)] px-5 py-4">
          <h2 className="text-[24px] font-semibold tracking-tight text-[color:var(--text)]">Recent repaired responses</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">Newest first. Showing up to 50 repair events.</p>
        </div>

        {error ? (
          <div className="px-5 py-5 text-sm text-red-600">Could not load repair events: {error.message}</div>
        ) : events.length === 0 ? (
          <div className="px-5 py-8 text-[16px] text-[color:var(--muted)]">No repair events logged yet.</div>
        ) : (
          <div className="divide-y divide-[rgba(57,75,70,0.08)]">
            {events.map((event) => {
              const route = String(event.metadata_json?.route ?? "-");
              const userMessageLength = Number(event.metadata_json?.user_message_length ?? 0);
              const initialReplyLength = Number(event.metadata_json?.initial_reply_length ?? 0);
              const finalReplyLength = Number(event.metadata_json?.final_reply_length ?? 0);
              const conversationTurns = Number(event.metadata_json?.conversation_turns ?? 0);

              return (
                <div key={event.id} className="px-5 py-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[17px] font-semibold text-[color:var(--text)]">{new Date(event.created_at).toLocaleString()}</p>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">Route: {route}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge label={`Turns ${conversationTurns}`} />
                      <Badge label={`User ${userMessageLength}`} />
                      <Badge label={`Initial ${initialReplyLength}`} />
                      <Badge label={`Final ${finalReplyLength}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] bg-[rgba(141,169,187,0.08)] p-4">
      <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">{label}</p>
      <p className="mt-2 text-[32px] font-semibold text-[color:var(--text)]">{value}</p>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return <span className="app-chip border border-[rgba(57,75,70,0.08)] bg-[rgba(141,169,187,0.08)]">{label}</span>;
}
