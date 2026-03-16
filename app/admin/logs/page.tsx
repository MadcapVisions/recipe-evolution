import { getAdminDashboardData } from "@/lib/admin/adminData";
import { getAdminAiDebugEvents } from "@/lib/admin/aiDebugData";

export default async function AdminLogsPage() {
  const [data, aiDebug] = await Promise.all([getAdminDashboardData(), getAdminAiDebugEvents()]);

  return (
    <div className="space-y-6">
      <section className="saas-card space-y-5 p-5">
        <div>
          <p className="app-kicker">Logs</p>
          <h2 className="text-[28px] font-semibold tracking-tight text-[color:var(--text)]">Recent operational events</h2>
          <p className="mt-2 max-w-3xl text-[16px] leading-7 text-[color:var(--muted)]">
            This stream combines recipe creation, version creation, AI prompt activity, and AI setting updates to give you a practical operational view.
          </p>
        </div>

        <div className="space-y-3">
          {data.recentLogs.map((entry) => (
            <div key={entry.id} className="rounded-[22px] border border-[rgba(57,52,43,0.06)] bg-[rgba(255,252,246,0.86)] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[15px] font-semibold text-[color:var(--text)]">{entry.title}</p>
                <span className="rounded-full bg-[rgba(141,169,187,0.12)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">
                  {entry.kind.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{entry.detail}</p>
              <p className="mt-2 text-xs text-[color:var(--muted)]">
                {entry.actor} · {new Date(entry.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="ai-debug" className="saas-card space-y-5 p-5">
        <div>
          <p className="app-kicker">AI diagnostics</p>
          <h2 className="text-[28px] font-semibold tracking-tight text-[color:var(--text)]">Repair and failure events</h2>
          <p className="mt-2 max-w-3xl text-[16px] leading-7 text-[color:var(--muted)]">
            This is the old debug error-log view, now integrated into admin. It shows repaired Chef responses and hard AI route failures across the system.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <AiStatCard label="Repairs logged" value={String(aiDebug.stats.repairsLogged)} />
          <AiStatCard label="Failures logged" value={String(aiDebug.stats.failuresLogged)} />
          <AiStatCard label="Home hub repairs" value={String(aiDebug.stats.homeHubRepairs)} />
          <AiStatCard label="Avg final length" value={String(aiDebug.stats.averageFinalReplyLength)} />
        </div>

        {aiDebug.events.length === 0 ? (
          <div className="rounded-[22px] border border-[rgba(57,52,43,0.06)] bg-[rgba(255,252,246,0.86)] px-4 py-5 text-sm text-[color:var(--muted)]">
            No AI debug events logged yet.
          </div>
        ) : (
          <div className="space-y-3">
            {aiDebug.events.map((event) => {
              const route = String(event.metadata_json?.route ?? "-");
              const userMessageLength = Number(event.metadata_json?.user_message_length ?? 0);
              const initialReplyLength = Number(event.metadata_json?.initial_reply_length ?? 0);
              const finalReplyLength = Number(event.metadata_json?.final_reply_length ?? 0);
              const conversationTurns = Number(event.metadata_json?.conversation_turns ?? 0);
              const message = typeof event.metadata_json?.message === "string" ? event.metadata_json.message : null;
              const provider = typeof event.metadata_json?.provider === "string" ? event.metadata_json.provider : null;
              const finishReason = typeof event.metadata_json?.finish_reason === "string" ? event.metadata_json.finish_reason : null;
              const isFailure = event.event_name === "ai_route_failed";

              return (
                <div key={event.id} className="rounded-[22px] border border-[rgba(57,52,43,0.06)] bg-[rgba(255,252,246,0.86)] px-4 py-4">
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
                      <AiBadge label={isFailure ? "Failure" : "Repair"} />
                      {conversationTurns > 0 ? <AiBadge label={`Turns ${conversationTurns}`} /> : null}
                      {userMessageLength > 0 ? <AiBadge label={`User ${userMessageLength}`} /> : null}
                      {initialReplyLength > 0 ? <AiBadge label={`Initial ${initialReplyLength}`} /> : null}
                      {finalReplyLength > 0 ? <AiBadge label={`Final ${finalReplyLength}`} /> : null}
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

function AiStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] bg-[rgba(141,169,187,0.08)] p-4">
      <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">{label}</p>
      <p className="mt-2 text-[32px] font-semibold text-[color:var(--text)]">{value}</p>
    </div>
  );
}

function AiBadge({ label }: { label: string }) {
  return <span className="app-chip border border-[rgba(57,75,70,0.08)] bg-[rgba(141,169,187,0.08)]">{label}</span>;
}
