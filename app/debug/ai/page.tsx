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
    .in("event_name", ["chef_chat_repaired", "ai_route_failed"])
    .order("created_at", { ascending: false })
    .limit(50);

  const events = (data ?? []) as ProductEventRow[];

  const repairedEvents = events.filter((event) => event.event_name === "chef_chat_repaired");
  const failedEvents = events.filter((event) => event.event_name === "ai_route_failed");

  return (
    <div className="mx-auto max-w-5xl page-shell">
      <div className="space-y-3">
        <p className="app-kicker">Debug</p>
        <h1 className="page-title">AI Repair Events</h1>
        <p className="text-[16px] leading-7 text-[color:var(--muted)]">
          This page shows both repaired chef responses and hard AI route failures.
        </p>
      </div>

      <section className="saas-card p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Repairs logged" value={String(repairedEvents.length)} />
          <StatCard label="Failures logged" value={String(failedEvents.length)} />
          <StatCard
            label="Home hub repairs"
            value={String(repairedEvents.filter((event) => event.metadata_json?.route === "home-hub").length)}
          />
          <StatCard
            label="Avg final length"
            value={
              repairedEvents.length > 0
                ? String(
                    Math.round(
                      repairedEvents.reduce((sum, event) => sum + Number(event.metadata_json?.final_reply_length ?? 0), 0) / repairedEvents.length
                    )
                  )
                : "0"
            }
          />
        </div>
      </section>

      <section className="saas-card overflow-hidden">
        <div className="border-b border-[rgba(57,75,70,0.08)] px-5 py-4">
          <h2 className="text-[24px] font-semibold tracking-tight text-[color:var(--text)]">Recent AI events</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">Newest first. Showing up to 50 repaired responses and failures.</p>
        </div>

        {error ? (
          <div className="px-5 py-5 text-sm text-red-600">Could not load repair events: {error.message}</div>
        ) : events.length === 0 ? (
          <div className="px-5 py-8 text-[16px] text-[color:var(--muted)]">No AI debug events logged yet.</div>
        ) : (
          <div className="divide-y divide-[rgba(57,75,70,0.08)]">
            {events.map((event) => {
              const route = String(event.metadata_json?.route ?? "-");
              const userMessageLength = Number(event.metadata_json?.user_message_length ?? 0);
              const initialReplyLength = Number(event.metadata_json?.initial_reply_length ?? 0);
              const finalReplyLength = Number(event.metadata_json?.final_reply_length ?? 0);
              const conversationTurns = Number(event.metadata_json?.conversation_turns ?? 0);
              const message = typeof event.metadata_json?.message === "string" ? event.metadata_json.message : null;
              const provider = typeof event.metadata_json?.provider === "string" ? event.metadata_json.provider : null;
              const finishReason =
                typeof event.metadata_json?.finish_reason === "string" ? event.metadata_json.finish_reason : null;
              const isFailure = event.event_name === "ai_route_failed";

              return (
                <div key={event.id} className="px-5 py-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[17px] font-semibold text-[color:var(--text)]">{new Date(event.created_at).toLocaleString()}</p>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">
                        {isFailure ? "Failure" : "Repair"} on route: {route}
                      </p>
                      {provider ? <p className="mt-1 text-sm text-[color:var(--muted)]">Provider: {provider}</p> : null}
                      {finishReason ? <p className="mt-1 text-sm text-[color:var(--muted)]">Finish reason: {finishReason}</p> : null}
                      {message ? <p className="mt-1 text-sm text-red-600">{message}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge label={isFailure ? "Failure" : "Repair"} />
                      {conversationTurns > 0 ? <Badge label={`Turns ${conversationTurns}`} /> : null}
                      {userMessageLength > 0 ? <Badge label={`User ${userMessageLength}`} /> : null}
                      {initialReplyLength > 0 ? <Badge label={`Initial ${initialReplyLength}`} /> : null}
                      {finalReplyLength > 0 ? <Badge label={`Final ${finalReplyLength}`} /> : null}
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
