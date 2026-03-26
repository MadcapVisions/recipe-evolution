export type RecipeTelemetryStage =
  | "dish_family_selection"
  | "ingredient_planning"
  | "ingredient_plan_repair"
  | "step_generation"
  | "step_plan_repair"
  | "full_recipe_validation"
  | "full_recipe_repair"
  | "final_decision";

export type RecipeTelemetryStatus =
  | "success"
  | "warning"
  | "error"
  | "accepted"
  | "rejected"
  | "retry"
  | "fallback";

export type RecipeTelemetryIssue = {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
};

export type RecipeTelemetryEvent = {
  timestamp: string;
  requestId: string;
  stage: RecipeTelemetryStage;
  status: RecipeTelemetryStatus;
  dishFamily?: string | null;
  durationMs?: number | null;
  attemptNumber?: number | null;
  retryCount?: number | null;
  score?: number | null;
  issues?: RecipeTelemetryIssue[];
  metadata?: Record<string, unknown>;
};

export type RecipeTelemetrySession = {
  requestId: string;
  startedAt: string;
  events: RecipeTelemetryEvent[];
};

export type RecipeTelemetrySummary = {
  requestId: string;
  totalEvents: number;
  stagesSeen: RecipeTelemetryStage[];
  errorCount: number;
  warningCount: number;
  retryCount: number;
  accepted: boolean;
  finalStatus: RecipeTelemetryStatus | null;
  dishFamily: string | null;
  totalDurationMs: number | null;
  issueCountsByCode: Record<string, number>;
};

function nowIso(): string {
  return new Date().toISOString();
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export class RecipeTelemetry {
  private session: RecipeTelemetrySession;

  constructor(requestId: string) {
    this.session = {
      requestId,
      startedAt: nowIso(),
      events: [],
    };
  }

  log(params: {
    stage: RecipeTelemetryStage;
    status: RecipeTelemetryStatus;
    dishFamily?: string | null;
    durationMs?: number | null;
    attemptNumber?: number | null;
    retryCount?: number | null;
    score?: number | null;
    issues?: RecipeTelemetryIssue[];
    metadata?: Record<string, unknown>;
  }): void {
    this.session.events.push({
      timestamp: nowIso(),
      requestId: this.session.requestId,
      stage: params.stage,
      status: params.status,
      dishFamily: params.dishFamily ?? null,
      durationMs: params.durationMs ?? null,
      attemptNumber: params.attemptNumber ?? null,
      retryCount: params.retryCount ?? null,
      score: params.score ?? null,
      issues: params.issues ?? [],
      metadata: params.metadata ?? {},
    });
  }

  getSession(): RecipeTelemetrySession {
    return this.session;
  }

  getSummary(): RecipeTelemetrySummary {
    const events = this.session.events;
    const allIssues = events.flatMap((e) => e.issues ?? []);
    const issueCountsByCode: Record<string, number> = {};

    for (const issue of allIssues) {
      issueCountsByCode[issue.code] = (issueCountsByCode[issue.code] ?? 0) + 1;
    }

    const finalEvent = events.length ? events[events.length - 1] : null;
    const totalDurationMs = sum(
      events
        .map((e) => e.durationMs)
        .filter((v): v is number => typeof v === "number")
    );

    return {
      requestId: this.session.requestId,
      totalEvents: events.length,
      stagesSeen: unique(events.map((e) => e.stage)),
      errorCount: allIssues.filter((i) => i.severity === "error").length,
      warningCount: allIssues.filter((i) => i.severity === "warning").length,
      retryCount: events.filter((e) => e.status === "retry").length,
      accepted: finalEvent?.status === "accepted",
      finalStatus: finalEvent?.status ?? null,
      dishFamily:
        finalEvent?.dishFamily ??
        events.find((e) => e.dishFamily)?.dishFamily ??
        null,
      totalDurationMs: totalDurationMs || null,
      issueCountsByCode,
    };
  }

  toJson(): string {
    return JSON.stringify(
      {
        session: this.getSession(),
        summary: this.getSummary(),
      },
      null,
      2
    );
  }
}

/**
 * Wraps an async stage, measures wall time, and logs success or error automatically.
 * The caller can still log additional result details (score, issues) after awaiting.
 */
export async function withTelemetryTiming<T>(
  telemetry: RecipeTelemetry,
  params: {
    stage: RecipeTelemetryStage;
    statusOnSuccess?: RecipeTelemetryStatus;
    statusOnError?: RecipeTelemetryStatus;
    dishFamily?: string | null;
    attemptNumber?: number | null;
    retryCount?: number | null;
    metadata?: Record<string, unknown>;
  },
  fn: () => Promise<T>
): Promise<T> {
  const started = Date.now();

  try {
    const result = await fn();

    telemetry.log({
      stage: params.stage,
      status: params.statusOnSuccess ?? "success",
      dishFamily: params.dishFamily ?? null,
      durationMs: Date.now() - started,
      attemptNumber: params.attemptNumber ?? null,
      retryCount: params.retryCount ?? null,
      metadata: params.metadata ?? {},
    });

    return result;
  } catch (error) {
    telemetry.log({
      stage: params.stage,
      status: params.statusOnError ?? "error",
      dishFamily: params.dishFamily ?? null,
      durationMs: Date.now() - started,
      attemptNumber: params.attemptNumber ?? null,
      retryCount: params.retryCount ?? null,
      issues: [
        {
          code: "TELEMETRY_STAGE_EXCEPTION",
          severity: "error",
          message:
            error instanceof Error ? error.message : "Unknown stage failure",
        },
      ],
      metadata: params.metadata ?? {},
    });

    throw error;
  }
}
