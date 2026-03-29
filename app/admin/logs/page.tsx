import { getAdminDashboardData } from "@/lib/admin/adminData";
import { getAdminAiDebugEvents, type IngredientResolutionChainEntry } from "@/lib/admin/aiDebugData";

type AdminLogsPageProps = {
  searchParams?: Promise<{
    ciaFlow?: string | string[];
    ciaDecision?: string | string[];
    ciaFailureKind?: string | string[];
    ciaModel?: string | string[];
  }>;
};

function firstSearchParam(value: string | string[] | undefined) {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function AdminLogsPage({ searchParams }: AdminLogsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const ciaFilters = {
    flow: firstSearchParam(resolvedSearchParams?.ciaFlow),
    decision: firstSearchParam(resolvedSearchParams?.ciaDecision),
    failureKind: firstSearchParam(resolvedSearchParams?.ciaFailureKind),
    model: firstSearchParam(resolvedSearchParams?.ciaModel),
  };
  const [data, aiDebug] = await Promise.all([getAdminDashboardData(), getAdminAiDebugEvents(ciaFilters)]);
  const recentSuccessfulAttempts = aiDebug.generationAttempts.filter((attempt) => attempt.outcome === "passed").slice(0, 5);

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
          <AiStatCard label="CIA runs" value={String(aiDebug.stats.ciaRunsLogged)} severity="low" />
          <AiStatCard label="CIA sanitized" value={String(aiDebug.stats.ciaSanitizedLogged)} severity="low" />
          <AiStatCard label="CIA recovered" value={String(aiDebug.stats.ciaRecoveredLogged)} severity="low" />
          <AiStatCard label="CIA avg confidence" value={aiDebug.stats.averageCiaConfidence.toFixed(2)} severity="low" />
        </div>

        <ErrorGroup
          title="CIA adjudications"
          description="Failure packets reviewed by CIA. This is the fastest way to verify whether a bad constraint came from real user intent, lock-time state, or junk extraction."
          severity="low"
          count={aiDebug.stats.ciaRunsLogged}
          extra={`${aiDebug.stats.ciaSanitizedLogged} sanitized · ${aiDebug.stats.ciaRecoveredLogged} recovered structured imports`}
          empty="No CIA adjudications logged."
        >
          <div className="grid gap-3 rounded-[18px] bg-[rgba(57,52,43,0.04)] p-3 md:grid-cols-2 xl:grid-cols-4">
            <FilterBlock
              label="Flow"
              param="ciaFlow"
              active={aiDebug.ciaFilters.applied.flow}
              options={aiDebug.ciaFilters.options.flows}
              search={ciaFilters}
            />
            <FilterBlock
              label="Decision"
              param="ciaDecision"
              active={aiDebug.ciaFilters.applied.decision}
              options={aiDebug.ciaFilters.options.decisions}
              search={ciaFilters}
            />
            <FilterBlock
              label="Failure kind"
              param="ciaFailureKind"
              active={aiDebug.ciaFilters.applied.failureKind}
              options={aiDebug.ciaFilters.options.failureKinds}
              search={ciaFilters}
            />
            <FilterBlock
              label="Model"
              param="ciaModel"
              active={aiDebug.ciaFilters.applied.model}
              options={aiDebug.ciaFilters.options.models}
              search={ciaFilters}
            />
          </div>
          {aiDebug.ciaFilters.topDroppedConstraints.length > 0 ? (
            <p className="text-xs leading-5 text-[color:var(--muted)]">
              Top dropped constraints:{" "}
              {aiDebug.ciaFilters.topDroppedConstraints.map((item) => `${item.label} (${item.count})`).join(" · ")}
            </p>
          ) : null}
          {aiDebug.ciaAdjudications.map((entry) => {
            const packet = entry.packet_json ?? null;
            const result = entry.result_json ?? null;
            const reasons = Array.isArray(packet?.reasons) ? packet.reasons.filter((value): value is string => typeof value === "string") : [];
            const provenanceSummary = summarizeConstraintProvenance(packet);
            return (
              <ErrorRow key={entry.id} timestamp={entry.created_at} severity="low">
                <p className="text-sm font-medium text-[color:var(--text)]">
                  {entry.flow} · {entry.decision.replaceAll("_", " ")}
                </p>
                <p className="text-sm text-[color:var(--muted)]">
                  {entry.adjudicator_source}
                  {entry.model ? ` · ${entry.model}` : ""}
                  {entry.failure_stage ? ` · stage: ${entry.failure_stage}` : ""}
                  {entry.failure_kind ? ` · kind: ${entry.failure_kind}` : ""}
                </p>
                {reasons.length > 0 ? (
                  <p className="mt-1 text-sm text-[color:var(--muted)]">{reasons[0]}</p>
                ) : null}
                {provenanceSummary ? (
                  <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">Constraint provenance: {provenanceSummary}</p>
                ) : null}
                {result && typeof result === "object" && !Array.isArray(result) && (result.escalated === true || result.modelUsed) ? (
                  <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">
                    CIA run: {result.modelUsed ? String(result.modelUsed) : "unknown model"}
                    {result.escalated === true ? ` · escalated (${String(result.escalationReason ?? "fallback_second_opinion")})` : ""}
                  </p>
                ) : null}
                <details className="mt-2 rounded-[16px] bg-[rgba(57,52,43,0.04)] px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold text-[color:var(--text)]">
                    Full CIA packet
                  </summary>
                  <div className="mt-2 space-y-2">
                    <pre className="overflow-x-auto rounded-[12px] bg-white/70 p-3 text-xs leading-5 text-[color:var(--muted)]">
                      {JSON.stringify(packet, null, 2)}
                    </pre>
                    <pre className="overflow-x-auto rounded-[12px] bg-white/70 p-3 text-xs leading-5 text-[color:var(--muted)]">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </div>
                </details>
              </ErrorRow>
            );
          })}
        </ErrorGroup>

        <ErrorGroup
          title="Recent successful runs"
          description="Most recent recipe generations that passed verification. Use this to confirm which model and attempt count are succeeding in production."
          severity="low"
          count={recentSuccessfulAttempts.length}
          empty="No successful generation attempts logged recently."
        >
          {recentSuccessfulAttempts.map((attempt) => {
            const normalizedSummary = summarizeNormalizedRecipe(attempt.normalized_recipe_json);
            const generationPath = extractGenerationPath(attempt.generator_payload_json, attempt.verification_json?.failure_context ?? null);
            const generationDetails = extractGenerationDetails(
              attempt.generator_payload_json,
              attempt.verification_json?.failure_context ?? null
            );
            const totalCost = (attempt.stage_metrics_json ?? []).reduce(
              (sum, stage) => sum + (typeof stage.estimated_cost_usd === "number" ? stage.estimated_cost_usd : 0),
              0
            );
            const promptRefinement = extractPromptRefinement(attempt.generator_payload_json);
            const refinementSummary = extractRefinementSummary(attempt.generator_payload_json);
            const distilledIngredients = summarizeDistilledIngredients(attempt.cooking_brief_json);
            const briefProvenance = summarizeBriefProvenance(attempt.cooking_brief_json);
            const distilledIntents = summarizeDistilledIntents(attempt.generator_payload_json);
            const resolutionChain = attempt.ingredient_resolution_chain ?? [];
            return (
              <ErrorRow key={attempt.id} timestamp={attempt.created_at} severity="low">
                <p className="text-sm font-medium text-[color:var(--text)]">
                  {attempt.scope} · passed · attempt {attempt.attempt_number}
                </p>
                <p className="text-sm text-[color:var(--muted)]">
                  {attempt.provider ?? "unknown"}{attempt.model ? ` · ${attempt.model}` : ""}
                  {generationPath ? ` · path: ${generationPath}` : ""}
                  {totalCost > 0 ? ` · $${totalCost.toFixed(4)}` : ""}
                </p>
                {normalizedSummary ? (
                  <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">Normalized: {normalizedSummary}</p>
                ) : null}
                {generationDetails && (generationDetails.repairedSections.length > 0 || generationDetails.monolithicFallbackUsed) ? (
                  <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">
                    {generationDetails.repairedSections.length > 0
                      ? `Repairs: ${generationDetails.repairedSections.join(", ")}`
                      : "Repairs: none"}
                    {generationDetails.monolithicFallbackUsed ? " · monolithic fallback used" : ""}
                  </p>
                ) : null}
                {promptRefinement ? (
                  <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">Refinement: {promptRefinement}</p>
                ) : null}
                {refinementSummary ? (
                  <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">Refinement summary: {refinementSummary}</p>
                ) : null}
                {distilledIntents ? (
                  <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">Distilled intents: {distilledIntents}</p>
                ) : null}
                {distilledIngredients ? (
                  <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">Brief ingredients: {distilledIngredients}</p>
                ) : null}
                {briefProvenance ? (
                  <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">Extraction provenance: {briefProvenance}</p>
                ) : null}
                {resolutionChain.length > 0 ? (
                  <IngredientResolutionChain entries={resolutionChain} />
                ) : null}
              </ErrorRow>
            );
          })}
        </ErrorGroup>

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
              const failureStage = typeof attempt.verification_json?.failure_stage === "string"
                ? attempt.verification_json.failure_stage
                : null;
              const failureContext = attempt.verification_json?.failure_context ?? null;
              const generationPath = extractGenerationPath(attempt.generator_payload_json, failureContext);
              const generationDetails = extractGenerationDetails(attempt.generator_payload_json, failureContext);
              const rawPreview = summarizeRawModelOutput(attempt.raw_model_output_json);
              const rawText = extractRawModelText(attempt.raw_model_output_json);
              const finishReason = extractFinishReason(attempt.raw_model_output_json);
              const normalizedSummary = summarizeNormalizedRecipe(attempt.normalized_recipe_json);
              const promptRefinement = extractPromptRefinement(attempt.generator_payload_json);
              const refinementSummary = extractRefinementSummary(attempt.generator_payload_json);
              const distilledIngredients = summarizeDistilledIngredients(attempt.cooking_brief_json);
              const briefProvenance = summarizeBriefProvenance(attempt.cooking_brief_json);
              const distilledIntents = summarizeDistilledIntents(attempt.generator_payload_json);
              const resolutionChain = attempt.ingredient_resolution_chain ?? [];
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
                    {generationPath ? ` · path: ${generationPath}` : ""}
                    {failureStage ? ` · stage: ${failureStage}` : ""}
                    {retryStrategy ? ` · retry: ${retryStrategy}` : ""}
                    {finishReason ? ` · finish: ${finishReason}` : ""}
                    {totalCost > 0 ? ` · $${totalCost.toFixed(4)}` : ""}
                  </p>
                  {firstReason ? <p className="mt-1 text-sm text-amber-600">{firstReason}</p> : null}
                  {rawPreview ? (
                    <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">
                      Raw preview: <span className="font-mono">{rawPreview}</span>
                    </p>
                  ) : null}
                  {normalizedSummary ? (
                    <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">
                      Normalized: {normalizedSummary}
                    </p>
                  ) : null}
                  {generationDetails && (generationDetails.repairedSections.length > 0 || generationDetails.monolithicFallbackUsed) ? (
                    <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">
                      {generationDetails.repairedSections.length > 0
                        ? `Repairs: ${generationDetails.repairedSections.join(", ")}`
                        : "Repairs: none"}
                      {generationDetails.monolithicFallbackUsed ? " · monolithic fallback used" : ""}
                    </p>
                  ) : null}
                  {promptRefinement ? (
                    <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">Refinement: {promptRefinement}</p>
                  ) : null}
                  {refinementSummary ? (
                    <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">Refinement summary: {refinementSummary}</p>
                  ) : null}
                  {distilledIntents ? (
                    <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">Distilled intents: {distilledIntents}</p>
                  ) : null}
                  {distilledIngredients ? (
                    <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">Brief ingredients: {distilledIngredients}</p>
                  ) : null}
                  {briefProvenance ? (
                    <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">Extraction provenance: {briefProvenance}</p>
                  ) : null}
                  {resolutionChain.length > 0 ? (
                    <IngredientResolutionChain entries={resolutionChain} />
                  ) : null}
                  <details className="mt-2 rounded-[16px] bg-[rgba(57,52,43,0.04)] px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold text-[color:var(--text)]">
                      Full debug payload
                    </summary>
                    <div className="mt-2 space-y-2">
                      {rawText ? (
                        <pre className="overflow-x-auto rounded-[12px] bg-white/70 p-3 text-xs leading-5 text-[color:var(--muted)]">
                          {rawText}
                        </pre>
                      ) : null}
                      {attempt.raw_model_output_json && !rawText ? (
                        <pre className="overflow-x-auto rounded-[12px] bg-white/70 p-3 text-xs leading-5 text-[color:var(--muted)]">
                          {JSON.stringify(attempt.raw_model_output_json, null, 2)}
                        </pre>
                      ) : null}
                      {attempt.normalized_recipe_json ? (
                        <pre className="overflow-x-auto rounded-[12px] bg-white/70 p-3 text-xs leading-5 text-[color:var(--muted)]">
                          {JSON.stringify(attempt.normalized_recipe_json, null, 2)}
                        </pre>
                      ) : null}
                      {attempt.generator_payload_json ? (
                        <pre className="overflow-x-auto rounded-[12px] bg-white/70 p-3 text-xs leading-5 text-[color:var(--muted)]">
                          {JSON.stringify(attempt.generator_payload_json, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  </details>
                  {failureContext && Object.keys(failureContext).length > 0 ? (
                    <pre className="mt-2 overflow-x-auto rounded-[16px] bg-[rgba(57,52,43,0.04)] p-3 text-xs leading-5 text-[color:var(--muted)]">
                      {JSON.stringify(failureContext, null, 2)}
                    </pre>
                  ) : null}
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

function FilterBlock({
  label,
  param,
  active,
  options,
  search,
}: {
  label: string;
  param: "ciaFlow" | "ciaDecision" | "ciaFailureKind" | "ciaModel";
  active: string | null;
  options: string[];
  search: {
    flow: string | null;
    decision: string | null;
    failureKind: string | null;
    model: string | null;
  };
}) {
  const allHref = buildFilterHref(search, param, null);
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">{label}</p>
      <div className="flex flex-wrap gap-2">
        <a href={allHref} className={buildFilterClass(active === null)}>
          all
        </a>
        {options.slice(0, 8).map((option) => (
          <a key={option} href={buildFilterHref(search, param, option)} className={buildFilterClass(active === option)}>
            {option}
          </a>
        ))}
      </div>
    </div>
  );
}

function buildFilterHref(
  search: { flow: string | null; decision: string | null; failureKind: string | null; model: string | null },
  param: "ciaFlow" | "ciaDecision" | "ciaFailureKind" | "ciaModel",
  value: string | null
) {
  const next = new URLSearchParams();
  const entries: Array<[string, string | null]> = [
    ["ciaFlow", search.flow],
    ["ciaDecision", search.decision],
    ["ciaFailureKind", search.failureKind],
    ["ciaModel", search.model],
  ];
  for (const [key, currentValue] of entries) {
    const finalValue = key === param ? value : currentValue;
    if (finalValue) {
      next.set(key, finalValue);
    }
  }
  const query = next.toString();
  return query.length > 0 ? `/admin/logs?${query}` : "/admin/logs";
}

function buildFilterClass(active: boolean) {
  return [
    "rounded-full px-2.5 py-1 text-xs font-medium transition",
    active
      ? "bg-[rgba(74,106,96,0.14)] text-[color:var(--text)]"
      : "bg-white/70 text-[color:var(--muted)] hover:bg-white",
  ].join(" ");
}

function summarizeRawModelOutput(value: unknown) {
  const rawText = extractRawModelText(value);
  if (!rawText) {
    return null;
  }

  return rawText.replace(/\s+/g, " ").trim().slice(0, 220);
}

function extractRawModelText(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  if (typeof raw.text === "string" && raw.text.trim().length > 0) {
    return raw.text;
  }
  if (typeof raw.raw_text === "string" && raw.raw_text.trim().length > 0) {
    return raw.raw_text;
  }

  return JSON.stringify(value);
}

function extractFinishReason(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  return typeof raw.finishReason === "string" && raw.finishReason.trim().length > 0 ? raw.finishReason : null;
}

function extractGenerationPath(
  generatorPayload: Record<string, unknown> | null | undefined,
  failureContext: Record<string, unknown> | null | undefined
): string | null {
  const direct = generatorPayload?.generation_path;
  if (typeof direct === "string" && direct.trim().length > 0) {
    return direct;
  }

  const fromFailureContext = failureContext?.generation_path;
  if (typeof fromFailureContext === "string" && fromFailureContext.trim().length > 0) {
    return fromFailureContext;
  }

  return null;
}

function extractGenerationDetails(
  generatorPayload: Record<string, unknown> | null | undefined,
  failureContext?: Record<string, unknown> | null | undefined
) {
  const raw = generatorPayload?.generation_details
    ?? (failureContext && typeof failureContext === "object" ? failureContext.generation_details : null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const details = raw as Record<string, unknown>;
  const repairedSections = Array.isArray(details.repaired_sections)
    ? details.repaired_sections.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];

  return {
    sectionedAttempted: details.sectioned_attempted === true,
    monolithicFallbackUsed: details.monolithic_fallback_used === true,
    repairedSections,
  };
}

function extractPromptRefinement(generatorPayload: Record<string, unknown> | null | undefined): string | null {
  const prompt = generatorPayload?.prompt;
  return typeof prompt === "string" && prompt.trim().length > 0 ? prompt.trim() : null;
}

function summarizeDistilledIngredients(
  cookingBrief:
    | {
        ingredients?: {
          required?: string[] | null;
          preferred?: string[] | null;
          forbidden?: string[] | null;
          provenance?: {
            required?: Array<Record<string, unknown>> | null;
            preferred?: Array<Record<string, unknown>> | null;
            forbidden?: Array<Record<string, unknown>> | null;
          } | null;
        } | null;
      }
    | null
) {
  const required = Array.isArray(cookingBrief?.ingredients?.required) ? cookingBrief?.ingredients?.required.filter(Boolean) : [];
  const forbidden = Array.isArray(cookingBrief?.ingredients?.forbidden) ? cookingBrief?.ingredients?.forbidden.filter(Boolean) : [];
  const preferred = Array.isArray(cookingBrief?.ingredients?.preferred) ? cookingBrief?.ingredients?.preferred.filter(Boolean) : [];

  const parts = [
    required.length > 0 ? `required ${required.join(", ")}` : null,
    preferred.length > 0 ? `preferred ${preferred.join(", ")}` : null,
    forbidden.length > 0 ? `forbidden ${forbidden.join(", ")}` : null,
  ].filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(" · ") : null;
}

function summarizeBriefProvenance(
  cookingBrief:
    | {
        ingredients?: {
          provenance?: {
            required?: Array<Record<string, unknown>> | null;
            preferred?: Array<Record<string, unknown>> | null;
            forbidden?: Array<Record<string, unknown>> | null;
          } | null;
        } | null;
      }
    | null
) {
  const provenance = cookingBrief?.ingredients?.provenance;
  const required = Array.isArray(provenance?.required) ? provenance.required.length : 0;
  const preferred = Array.isArray(provenance?.preferred) ? provenance.preferred.length : 0;
  const forbidden = Array.isArray(provenance?.forbidden) ? provenance.forbidden.length : 0;

  if (required === 0 && preferred === 0 && forbidden === 0) {
    return null;
  }

  const parts = [
    required > 0 ? `${required} required` : null,
    preferred > 0 ? `${preferred} preferred` : null,
    forbidden > 0 ? `${forbidden} forbidden` : null,
  ].filter((value): value is string => Boolean(value));

  return parts.join(" · ");
}

function summarizeDistilledIntents(generatorPayload: Record<string, unknown> | null | undefined) {
  const raw = generatorPayload?.distilled_intents;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const intents = raw as Record<string, unknown>;
  const additions = summarizeIntentBucket(intents.ingredient_additions);
  const preferences = summarizeIntentBucket(intents.ingredient_preferences);
  const removals = summarizeIntentBucket(intents.ingredient_removals);
  const parts = [
    additions.length > 0 ? `add ${additions.join(", ")}` : null,
    preferences.length > 0 ? `prefer ${preferences.join(", ")}` : null,
    removals.length > 0 ? `remove ${removals.join(", ")}` : null,
  ].filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(" · ") : null;
}

function summarizeConstraintProvenance(packet: Record<string, unknown> | null | undefined) {
  const constraintProvenance =
    packet && typeof packet === "object" && !Array.isArray(packet)
      ? (packet.constraintProvenance as Record<string, unknown> | undefined)
      : undefined;
  const ingredientProvenance =
    constraintProvenance && typeof constraintProvenance === "object"
      ? (constraintProvenance.ingredientProvenance as Record<string, unknown> | undefined)
      : undefined;
  const requiredEntries = Array.isArray(ingredientProvenance?.required) ? ingredientProvenance.required : [];
  const preferredEntries = Array.isArray(ingredientProvenance?.preferred) ? ingredientProvenance.preferred : [];
  const forbiddenEntries = Array.isArray(ingredientProvenance?.forbidden) ? ingredientProvenance.forbidden : [];
  const required = requiredEntries.length;
  const preferred = preferredEntries.length;
  const forbidden = forbiddenEntries.length;

  if (required === 0 && preferred === 0 && forbidden === 0) {
    return null;
  }

  const parts = [
    required > 0 ? `${required} required` : null,
    preferred > 0 ? `${preferred} preferred` : null,
    forbidden > 0 ? `${forbidden} forbidden` : null,
    summarizeSpanCoverage(requiredEntries) ? `spans ${summarizeSpanCoverage(requiredEntries)}` : null,
  ].filter((value): value is string => Boolean(value));

  return parts.join(" · ");
}

function summarizeSpanCoverage(entries: unknown[]) {
  const coverage = entries.filter((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return false;
    }
    const provenance = entry as Record<string, unknown>;
    return typeof provenance.sourceStart === "number" && typeof provenance.sourceEnd === "number";
  }).length;

  return coverage > 0 ? `${coverage}/${entries.length}` : null;
}

function extractRefinementSummary(generatorPayload: Record<string, unknown> | null | undefined) {
  const raw = generatorPayload?.refinement_summary;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const summary = raw as Record<string, unknown>;
  const confidence = typeof summary.confidence === "number" ? summary.confidence : null;
  const ambiguityReason =
    typeof summary.ambiguity_reason === "string" && summary.ambiguity_reason.trim().length > 0
      ? summary.ambiguity_reason.trim()
      : null;
  const ambiguousNotes = Array.isArray(summary.ambiguous_notes)
    ? summary.ambiguous_notes.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];

  const parts = [
    confidence !== null ? `confidence ${confidence.toFixed(2)}` : null,
    ambiguityReason ? ambiguityReason : null,
    ambiguousNotes.length > 0 ? `notes ${ambiguousNotes.join(" | ")}` : null,
  ].filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(" · ") : null;
}

function IngredientResolutionChain({ entries }: { entries: IngredientResolutionChainEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <details className="mt-2 rounded-[16px] bg-[rgba(57,52,43,0.04)] px-3 py-2">
      <summary className="cursor-pointer text-xs font-semibold text-[color:var(--text)]">
        Ingredient resolution chain ({entries.length})
      </summary>
      <div className="mt-2 space-y-1">
        {entries.map((entry, i) => {
          const methodColor =
            entry.resolution_method === "unresolved"
              ? "text-amber-600"
              : entry.resolution_method === "family_inference"
              ? "text-blue-600"
              : "text-emerald-600";
          const appliedColor =
            entry.applied_as === "note_only"
              ? "text-amber-600"
              : entry.applied_as === "soft_preference"
              ? "text-blue-600"
              : "text-emerald-700";
          return (
            <div key={i} className="rounded-[10px] bg-white/60 px-3 py-1.5 text-xs leading-5">
              <span className="font-semibold text-[color:var(--text)]">{entry.slot}</span>
              {" · "}
              <span className="font-mono text-[color:var(--text)]">&ldquo;{entry.raw_phrase}&rdquo;</span>
              {entry.display_label && entry.display_label !== entry.raw_phrase ? (
                <> → <span className="font-mono text-emerald-700">{entry.display_label}</span></>
              ) : null}
              {entry.canonical_key ? (
                <> · <span className="font-mono text-[color:var(--muted)]">{entry.canonical_key}</span></>
              ) : null}
              {entry.family_key ? (
                <> · <span className="text-[color:var(--muted)]">fam:{entry.family_key}</span></>
              ) : null}
              {" · "}
              <span className={methodColor}>{entry.resolution_method}</span>
              {" · "}
              <span className="text-[color:var(--muted)]">{entry.confidence.toFixed(2)}</span>
              {" · "}
              <span className={appliedColor}>{entry.applied_as.replace(/_/g, " ")}</span>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function summarizeIntentBucket(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }
      const intent = item as Record<string, unknown>;
      if (typeof intent.label === "string" && intent.label.trim().length > 0) {
        return intent.label.trim();
      }
      if (typeof intent.canonical_key === "string" && intent.canonical_key.trim().length > 0) {
        return intent.canonical_key.trim().replaceAll("_", " ");
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));
}

function summarizeNormalizedRecipe(
  value: { title?: string | null; ingredients?: Array<unknown> | null; steps?: Array<unknown> | null } | null
) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const title = typeof value.title === "string" && value.title.trim().length > 0 ? value.title.trim() : null;
  const ingredientCount = Array.isArray(value.ingredients) ? value.ingredients.length : 0;
  const stepCount = Array.isArray(value.steps) ? value.steps.length : 0;

  if (!title && ingredientCount === 0 && stepCount === 0) {
    return null;
  }

  const parts = [
    title ? `title "${title}"` : null,
    ingredientCount > 0 ? `${ingredientCount} ingredients` : null,
    stepCount > 0 ? `${stepCount} steps` : null,
  ].filter((part): part is string => part !== null);

  return parts.join(" · ");
}
