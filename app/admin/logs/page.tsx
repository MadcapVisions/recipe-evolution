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

        <div className="grid gap-4 md:grid-cols-4">
          <AiStatCard label="Recipe attempts" value={String(aiDebug.stats.recentGenerationAttempts)} />
          <AiStatCard label="Attempt failures" value={String(aiDebug.stats.recentGenerationFailures)} />
          <AiStatCard label="Avg stage ms" value={String(aiDebug.stats.averageGenerationStageMs)} />
          <AiStatCard label="Recent cost" value={`$${aiDebug.stats.recentGenerationCostUsd.toFixed(4)}`} />
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

        <div className="space-y-3">
          <div>
            <h3 className="text-[20px] font-semibold tracking-tight text-[color:var(--text)]">Recent recipe generation attempts</h3>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              These are the new structured home-hub generation attempts with verifier outcomes, retry counts, stage timings, and estimated cost.
            </p>
          </div>

          {aiDebug.generationAttempts.length === 0 ? (
            <div className="rounded-[22px] border border-[rgba(57,52,43,0.06)] bg-[rgba(255,252,246,0.86)] px-4 py-5 text-sm text-[color:var(--muted)]">
              No recipe generation attempts logged yet.
            </div>
          ) : (
            aiDebug.generationAttempts.map((attempt) => {
              const firstReason =
                Array.isArray(attempt.verification_json?.reasons) && attempt.verification_json?.reasons.length > 0
                  ? attempt.verification_json.reasons[0]
                  : null;
              const retryStrategy = typeof attempt.verification_json?.retry_strategy === "string"
                ? attempt.verification_json.retry_strategy
                : null;
              const totalCost = (attempt.stage_metrics_json ?? []).reduce(
                (sum, stage) => sum + (typeof stage.estimated_cost_usd === "number" ? stage.estimated_cost_usd : 0),
                0
              );
              const generateStage = (attempt.stage_metrics_json ?? []).find((stage) => stage.stage_name === "recipe_generate");
              const generateTokens =
                typeof generateStage?.input_tokens === "number" || typeof generateStage?.output_tokens === "number"
                  ? `${generateStage?.input_tokens ?? 0}/${generateStage?.output_tokens ?? 0}`
                  : null;

              return (
                <div key={attempt.id} className="rounded-[22px] border border-[rgba(57,52,43,0.06)] bg-[rgba(255,252,246,0.86)] px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <p className="text-[17px] font-semibold text-[color:var(--text)]">{new Date(attempt.created_at).toLocaleString()}</p>
                      <p className="text-sm text-[color:var(--muted)]">
                        {attempt.scope} · outcome: {attempt.outcome.replaceAll("_", " ")} · attempt {attempt.attempt_number}
                      </p>
                      <p className="text-sm text-[color:var(--muted)]">
                        {attempt.provider ?? "unknown provider"} {attempt.model ? `· ${attempt.model}` : ""}
                      </p>
                      {firstReason ? <p className="text-sm text-red-600">{firstReason}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <AiBadge label={attempt.outcome.replaceAll("_", " ")} />
                      {retryStrategy ? <AiBadge label={`Retry ${retryStrategy}`} /> : null}
                      {generateTokens ? <AiBadge label={`Tokens ${generateTokens}`} /> : null}
                      {totalCost > 0 ? <AiBadge label={`Cost $${totalCost.toFixed(4)}`} /> : null}
                      <AiBadge label={`Stages ${(attempt.stage_metrics_json ?? []).length}`} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
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
