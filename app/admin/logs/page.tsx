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

      <section id="ai-debug" className="saas-card space-y-8 p-5">
        <div>
          <p className="app-kicker">AI diagnostics</p>
          <h2 className="text-[28px] font-semibold tracking-tight text-[color:var(--text)]">Error log</h2>
          <p className="mt-2 max-w-3xl text-[16px] leading-7 text-[color:var(--muted)]">
            Errors grouped by type. High counts in any category indicate a pattern worth investigating. Isolated one-offs are expected.
          </p>
        </div>

        {/* Summary stat row */}
        <div className="grid gap-4 md:grid-cols-4">
          <AiStatCard label="Route failures" value={String(aiDebug.stats.failuresLogged)} severity="high" />
          <AiStatCard label="Topic blocks" value={String(aiDebug.stats.blockedLogged)} severity="medium" />
          <AiStatCard label="Chat repairs" value={String(aiDebug.stats.repairsLogged)} severity="low" />
          <AiStatCard label="Generation failures" value={String(aiDebug.stats.recentGenerationFailures)} severity="medium" />
        </div>

        {/* Route failures — highest severity */}
        <ErrorGroup
          title="Route failures"
          description="Hard errors that returned a 500 to the user. These need investigation."
          severity="high"
          count={aiDebug.failedEvents.length}
          empty="No route failures logged."
        >
          {aiDebug.failedEvents.map((event) => {
            const route = String(event.metadata_json?.route ?? "-");
            const message = typeof event.metadata_json?.message === "string" ? event.metadata_json.message : null;
            const provider = typeof event.metadata_json?.provider === "string" ? event.metadata_json.provider : null;
            return (
              <ErrorRow key={event.id} timestamp={event.created_at} severity="high">
                <p className="text-sm font-medium text-[color:var(--text)]">Route: {route}</p>
                {provider ? <p className="text-sm text-[color:var(--muted)]">Provider: {provider}</p> : null}
                {message ? <p className="mt-1 text-sm text-red-600">{message}</p> : null}
              </ErrorRow>
            );
          })}
        </ErrorGroup>

        {/* Topic guard blocks — medium severity */}
        <ErrorGroup
          title="Topic guard blocks"
          description="Requests blocked for being off-topic. High frequency may mean the guard is too aggressive or users are confused about what the AI does."
          severity="medium"
          count={aiDebug.blockedEvents.length}
          empty="No topic guard blocks logged."
        >
          {aiDebug.blockedEvents.map((event) => {
            const route = String(event.metadata_json?.route ?? "-");
            const reason = typeof event.metadata_json?.reason === "string" ? event.metadata_json.reason : null;
            const userMessageLength = Number(event.metadata_json?.user_message_length ?? 0);
            return (
              <ErrorRow key={event.id} timestamp={event.created_at} severity="medium">
                <p className="text-sm font-medium text-[color:var(--text)]">Route: {route}</p>
                {reason ? <p className="mt-1 text-sm text-amber-600">{reason}</p> : null}
                {userMessageLength > 0 ? <p className="text-sm text-[color:var(--muted)]">User message: {userMessageLength} chars</p> : null}
              </ErrorRow>
            );
          })}
        </ErrorGroup>

        {/* Generation attempt failures — medium severity */}
        <ErrorGroup
          title="Generation attempt failures"
          description="Recipe generation attempts that did not pass verification. Some retries are expected — a high ratio of failures to attempts is the concern."
          severity="medium"
          count={aiDebug.stats.recentGenerationFailures}
          extra={`${aiDebug.stats.recentGenerationAttempts} total attempts · avg stage ${aiDebug.stats.averageGenerationStageMs}ms · est. cost $${aiDebug.stats.recentGenerationCostUsd.toFixed(4)}`}
          empty="No generation failures logged."
        >
          {aiDebug.generationAttempts
            .filter((attempt) => attempt.outcome !== "passed")
            .map((attempt) => {
              const firstReason =
                Array.isArray(attempt.verification_json?.reasons) && attempt.verification_json.reasons.length > 0
                  ? attempt.verification_json.reasons[0]
                  : null;
              const retryStrategy = typeof attempt.verification_json?.retry_strategy === "string"
                ? attempt.verification_json.retry_strategy
                : null;
              const totalCost = (attempt.stage_metrics_json ?? []).reduce(
                (sum, stage) => sum + (typeof stage.estimated_cost_usd === "number" ? stage.estimated_cost_usd : 0),
                0
              );
              return (
                <ErrorRow key={attempt.id} timestamp={attempt.created_at} severity="medium">
                  <p className="text-sm font-medium text-[color:var(--text)]">
                    {attempt.scope} · {attempt.outcome.replaceAll("_", " ")} · attempt {attempt.attempt_number}
                  </p>
                  <p className="text-sm text-[color:var(--muted)]">
                    {attempt.provider ?? "unknown"}{attempt.model ? ` · ${attempt.model}` : ""}
                    {retryStrategy ? ` · retry: ${retryStrategy}` : ""}
                    {totalCost > 0 ? ` · $${totalCost.toFixed(4)}` : ""}
                  </p>
                  {firstReason ? <p className="mt-1 text-sm text-amber-600">{firstReason}</p> : null}
                </ErrorRow>
              );
            })}
        </ErrorGroup>

        {/* Chat repairs — low severity */}
        <ErrorGroup
          title="Chat repairs"
          description="Chef responses that were caught and rewritten before reaching the user. These are recoveries, not failures — but patterns here can reveal prompt issues."
          severity="low"
          count={aiDebug.repairedEvents.length}
          extra={`${aiDebug.stats.homeHubRepairs} home hub · avg final length ${aiDebug.stats.averageFinalReplyLength} chars`}
          empty="No chat repairs logged."
        >
          {aiDebug.repairedEvents.map((event) => {
            const route = String(event.metadata_json?.route ?? "-");
            const userMessageLength = Number(event.metadata_json?.user_message_length ?? 0);
            const initialReplyLength = Number(event.metadata_json?.initial_reply_length ?? 0);
            const finalReplyLength = Number(event.metadata_json?.final_reply_length ?? 0);
            const conversationTurns = Number(event.metadata_json?.conversation_turns ?? 0);
            return (
              <ErrorRow key={event.id} timestamp={event.created_at} severity="low">
                <p className="text-sm font-medium text-[color:var(--text)]">Route: {route}</p>
                <p className="text-sm text-[color:var(--muted)]">
                  {conversationTurns > 0 ? `${conversationTurns} turns · ` : ""}
                  {userMessageLength > 0 ? `user ${userMessageLength} · ` : ""}
                  {initialReplyLength > 0 ? `initial ${initialReplyLength} → ` : ""}
                  {finalReplyLength > 0 ? `final ${finalReplyLength}` : ""}
                </p>
              </ErrorRow>
            );
          })}
        </ErrorGroup>
      </section>
    </div>
  );
}

function AiStatCard({ label, value, severity }: { label: string; value: string; severity: "high" | "medium" | "low" }) {
  const bg = severity === "high"
    ? "bg-[rgba(220,38,38,0.06)]"
    : severity === "medium"
    ? "bg-[rgba(217,119,6,0.06)]"
    : "bg-[rgba(141,169,187,0.08)]";
  const valueColor = severity === "high" && Number(value) > 0
    ? "text-red-600"
    : severity === "medium" && Number(value) > 0
    ? "text-amber-600"
    : "text-[color:var(--text)]";
  return (
    <div className={`rounded-[24px] p-4 ${bg}`}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">{label}</p>
      <p className={`mt-2 text-[32px] font-semibold ${valueColor}`}>{value}</p>
    </div>
  );
}

function ErrorGroup({
  title,
  description,
  severity,
  count,
  extra,
  empty,
  children,
}: {
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  count: number;
  extra?: string;
  empty: string;
  children: React.ReactNode;
}) {
  const borderColor = severity === "high"
    ? "border-red-200"
    : severity === "medium"
    ? "border-amber-200"
    : "border-[rgba(141,169,187,0.25)]";
  const badgeBg = severity === "high"
    ? "bg-red-100 text-red-700"
    : severity === "medium"
    ? "bg-amber-100 text-amber-700"
    : "bg-[rgba(141,169,187,0.15)] text-[color:var(--muted)]";

  return (
    <div className={`rounded-[22px] border ${borderColor} p-4 space-y-3`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[18px] font-semibold text-[color:var(--text)]">{title}</h3>
            <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${badgeBg}`}>{count}</span>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-[color:var(--muted)]">{description}</p>
          {extra ? <p className="mt-1 text-xs text-[color:var(--muted)]">{extra}</p> : null}
        </div>
      </div>
      {count === 0 ? (
        <p className="rounded-[16px] bg-[rgba(255,252,246,0.86)] px-4 py-3 text-sm text-[color:var(--muted)]">{empty}</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}

function ErrorRow({
  timestamp,
  severity,
  children,
}: {
  timestamp: string;
  severity: "high" | "medium" | "low";
  children: React.ReactNode;
}) {
  const leftBar = severity === "high"
    ? "border-l-red-400"
    : severity === "medium"
    ? "border-l-amber-400"
    : "border-l-[rgba(141,169,187,0.5)]";

  return (
    <div className={`rounded-r-[16px] border-l-2 ${leftBar} bg-[rgba(255,252,246,0.86)] px-4 py-3`}>
      {children}
      <p className="mt-1 text-xs text-[color:var(--muted)]">{new Date(timestamp).toLocaleString()}</p>
    </div>
  );
}
