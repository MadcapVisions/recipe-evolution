"use client";

import { useEffect, useState } from "react";

type ChefFixMode = "reliability" | "flavor" | "expert";

type ScorePayload = {
  total_score: number;
  score_band: string;
  summary: string;
  subscores: {
    flavor: number;
    technique: number;
    texture: number;
    harmony: number;
    clarity: number;
    risk: number;
    extras: number;
  };
  improvement_priorities: string[];
  risk_flags: string[];
  factors?: Array<{
    factorType: "positive_rule" | "missing_expected_rule" | "risk_flag" | "clarity_issue" | "chef_bonus";
    factorKey: string;
    impact: number;
    explanation: string;
    bucket: "flavor" | "technique" | "texture" | "harmony" | "clarity" | "risk" | "extras";
  }>;
};

type FixPayload = {
  current_score: number;
  projected_score: number;
  projected_delta: number;
  biggest_weakness: string | null;
  fixes: Array<{
    issueKey: string;
    title: string;
    category: string;
    rationale: string;
    estimatedImpact: number;
    targetAreas?: string[];
    targetReasons?: string[];
    actions: Array<{ type: string; content: string }>;
  }>;
};

type ComparePayload = {
  base_score: number;
  candidate_score: number;
  delta: number;
  improved_areas: string[];
  regressions: string[];
  improvement_drivers?: Array<{ factorKey: string; delta: number; explanation: string }>;
  regression_drivers?: Array<{ factorKey: string; delta: number; explanation: string }>;
};

type FixPreviewPayload = {
  selected_fix_keys: string[];
  preview: {
    changed_ingredients: Array<{ index: number; before: string; after: string }>;
    changed_steps: Array<{ index: number; before: string; after: string }>;
    notes_before: string | null;
    notes_after: string | null;
    ingredients: string[];
    steps: string[];
    notes: string | null;
    explanation: string | null;
  };
};

const CHEF_FIX_FEEDBACK_KEY = "chef-fix-feedback";

function topWhyItems(score: ScorePayload) {
  const factorItems = (score.factors ?? [])
    .filter((factor) => factor.impact < 0)
    .sort((a, b) => a.impact - b.impact)
    .slice(0, 3)
    .map((factor) => factor.explanation);

  if (factorItems.length > 0) {
    return factorItems;
  }

  return score.risk_flags.slice(0, 3);
}

export function ChefScorePanel({
  recipeId,
  versionId,
  compareBaseVersionId,
  compareBaseLabel,
}: {
  recipeId: string;
  versionId: string;
  compareBaseVersionId?: string | null;
  compareBaseLabel?: string | null;
}) {
  const [score, setScore] = useState<ScorePayload | null>(null);
  const [scoreLoading, setScoreLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ChefFixMode>("reliability");
  const [fixes, setFixes] = useState<FixPayload | null>(null);
  const [comparison, setComparison] = useState<ComparePayload | null>(null);
  const [preview, setPreview] = useState<FixPreviewPayload | null>(null);
  const [fixLoading, setFixLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [selectedFixKeys, setSelectedFixKeys] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setScoreLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/chef-score/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipe_version_id: versionId }),
        });
        const payload = (await response.json()) as ScorePayload & { message?: string; error?: boolean };
        if (!response.ok || payload.error) {
          throw new Error(payload.message || "Could not calculate Chef Score.");
        }
        if (!cancelled) {
          setScore(payload);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not calculate Chef Score.");
        }
      } finally {
        if (!cancelled) {
          setScoreLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [versionId]);

  useEffect(() => {
    let cancelled = false;
    if (!compareBaseVersionId || compareBaseVersionId === versionId) {
      setComparison(null);
      return;
    }

    const loadComparison = async () => {
      try {
        const response = await fetch("/api/chef-score/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base_version_id: compareBaseVersionId,
            candidate_version_id: versionId,
          }),
        });
        const payload = (await response.json()) as ComparePayload & { message?: string; error?: boolean };
        if (!response.ok || payload.error) {
          throw new Error(payload.message || "Could not compare Chef Scores.");
        }
        if (!cancelled) {
          setComparison(payload);
        }
      } catch {
        if (!cancelled) {
          setComparison(null);
        }
      }
    };

    void loadComparison();
    return () => {
      cancelled = true;
    };
  }, [compareBaseVersionId, versionId]);

  useEffect(() => {
    let cancelled = false;
    if (!fixes || selectedFixKeys.length === 0) {
      setPreview(null);
      return;
    }

    const loadPreview = async () => {
      setPreviewLoading(true);
      try {
        const response = await fetch("/api/chef-fix/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipe_version_id: versionId,
            selected_fix_keys: selectedFixKeys,
            mode,
          }),
        });
        const payload = (await response.json()) as FixPreviewPayload & { message?: string; error?: boolean };
        if (!response.ok || payload.error) {
          throw new Error(payload.message || "Could not preview fixes.");
        }
        if (!cancelled) {
          setPreview(payload);
        }
      } catch {
        if (!cancelled) {
          setPreview(null);
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    };

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [fixes, mode, selectedFixKeys, versionId]);

  async function generateFixes() {
    setFixLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/chef-fix/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe_version_id: versionId, mode }),
      });
      const payload = (await response.json()) as FixPayload & { message?: string; error?: boolean };
      if (!response.ok || payload.error) {
        throw new Error(payload.message || "Could not generate fixes.");
      }
      setFixes(payload);
      setSelectedFixKeys(payload.fixes.map((fix) => fix.issueKey));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not generate fixes.");
    } finally {
      setFixLoading(false);
    }
  }

  async function applySelectedFixes() {
    if (selectedFixKeys.length === 0) return;
    setApplyLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/chef-fix/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe_version_id: versionId,
          selected_fix_keys: selectedFixKeys,
          mode,
        }),
      });
      const payload = (await response.json()) as {
        new_recipe_version_id?: string;
        old_score?: number;
        new_score?: number;
        delta?: number;
        applied_fixes?: string[];
        improved_areas?: string[];
        regressions?: string[];
        message?: string;
        error?: boolean;
      };
      if (!response.ok || payload.error || !payload.new_recipe_version_id) {
        throw new Error(payload.message || "Could not apply fixes.");
      }
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          CHEF_FIX_FEEDBACK_KEY,
          JSON.stringify({
            recipeId,
            versionId: payload.new_recipe_version_id,
            oldScore: payload.old_score ?? null,
            newScore: payload.new_score ?? null,
            delta: payload.delta ?? null,
            appliedFixes: Array.isArray(payload.applied_fixes) ? payload.applied_fixes : [],
            improvedAreas: Array.isArray(payload.improved_areas) ? payload.improved_areas : [],
            regressions: Array.isArray(payload.regressions) ? payload.regressions : [],
          })
        );
      }
      window.location.assign(`/recipes/${recipeId}/versions/${payload.new_recipe_version_id}`);
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Could not apply fixes.");
    } finally {
      setApplyLoading(false);
    }
  }

  return (
    <section className="app-panel p-4 sm:p-5">
      <p className="app-kicker">Chef Score</p>
      {scoreLoading ? <p className="mt-3 text-sm text-[color:var(--muted)]">Scoring this version...</p> : null}
      {score ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-[20px] bg-[rgba(255,250,241,0.95)] p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[32px] font-semibold leading-none text-[color:var(--text)]">{score.total_score}</p>
                <p className="mt-1 text-sm text-[color:var(--muted)]">{score.score_band}</p>
              </div>
              <div className="text-right text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">Chef judgment</div>
            </div>
            <p className="mt-3 text-sm leading-6 text-[color:var(--text)]">{score.summary}</p>
          </div>

          <div className="space-y-2">
            {Object.entries(score.subscores).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded-[16px] bg-[rgba(141,169,187,0.06)] px-3 py-2 text-sm">
                <span className="capitalize text-[color:var(--muted)]">{key}</span>
                <span className="font-semibold text-[color:var(--text)]">{value}</span>
              </div>
            ))}
          </div>

          {score.improvement_priorities.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Top fixes</p>
              <div className="mt-2 space-y-2">
                {score.improvement_priorities.map((item) => (
                  <p key={item} className="rounded-[16px] bg-[rgba(74,106,96,0.07)] px-3 py-2 text-sm leading-6 text-[color:var(--text)]">
                    {item}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {topWhyItems(score).length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Why this score</p>
              <div className="mt-2 space-y-2">
                {topWhyItems(score).map((item) => (
                  <p key={item} className="rounded-[16px] bg-[rgba(57,75,70,0.06)] px-3 py-2 text-sm leading-6 text-[color:var(--text)]">
                    {item}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {comparison ? (
            <div className="rounded-[18px] border border-[rgba(57,75,70,0.08)] bg-white/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Version delta</p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--text)]">
                Compared with {compareBaseLabel ?? "the previous version"}, this version moved from{" "}
                <span className="font-semibold">{comparison.base_score}</span> to{" "}
                <span className="font-semibold">{comparison.candidate_score}</span>.
                <span className={`ml-2 font-semibold ${comparison.delta >= 0 ? "text-[color:var(--primary)]" : "text-red-600"}`}>
                  {comparison.delta >= 0 ? `+${comparison.delta}` : comparison.delta}
                </span>
              </p>
              {comparison.improved_areas.length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">Improved</p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--text)]">{comparison.improved_areas.join(", ")}</p>
                </div>
              ) : null}
              {comparison.improvement_drivers && comparison.improvement_drivers.length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">Why it improved</p>
                  <div className="mt-1 space-y-2">
                    {comparison.improvement_drivers.map((driver) => (
                      <p key={driver.factorKey} className="rounded-[14px] bg-[rgba(79,125,115,0.08)] px-3 py-2 text-sm leading-6 text-[color:var(--text)]">
                        {driver.explanation}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
              {comparison.regressions.length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">Regressions</p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--text)]">{comparison.regressions.join(", ")}</p>
                </div>
              ) : null}
              {comparison.regression_drivers && comparison.regression_drivers.length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">Why it regressed</p>
                  <div className="mt-1 space-y-2">
                    {comparison.regression_drivers.map((driver) => (
                      <p key={driver.factorKey} className="rounded-[14px] bg-[rgba(201,123,66,0.08)] px-3 py-2 text-sm leading-6 text-[color:var(--text)]">
                        {driver.explanation}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 space-y-3 border-t border-[rgba(57,75,70,0.08)] pt-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: "reliability", label: "Reliability" },
            { key: "flavor", label: "Flavor" },
            { key: "expert", label: "Expert" },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setMode(option.key as ChefFixMode)}
              className={`rounded-[16px] px-3 py-2 text-sm font-semibold ${
                mode === option.key ? "bg-[color:var(--primary)] text-white" : "bg-[rgba(141,169,187,0.08)] text-[color:var(--text)]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void generateFixes()}
          disabled={fixLoading}
          className="w-full rounded-full bg-[color:var(--primary)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {fixLoading ? "Finding fixes..." : "Chef Fix"}
        </button>
        {fixes ? (
          <div className="space-y-3">
            <div className="rounded-[18px] bg-[rgba(255,252,246,0.92)] p-3 text-sm text-[color:var(--text)]">
              Projected score: <span className="font-semibold">{fixes.projected_score}</span>
              <span className="ml-2 text-[color:var(--muted)]">+{fixes.projected_delta}</span>
            </div>
            {fixes.fixes.map((fix) => {
              const selected = selectedFixKeys.includes(fix.issueKey);
              return (
                <label key={fix.issueKey} className="block rounded-[18px] border border-[rgba(57,75,70,0.08)] bg-white/90 p-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) => {
                        setSelectedFixKeys((current) =>
                          event.target.checked ? [...current, fix.issueKey] : current.filter((key) => key !== fix.issueKey)
                        );
                      }}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-[color:var(--text)]">{fix.title}</p>
                        <span className="text-xs uppercase tracking-[0.14em] text-[color:var(--muted)]">+{fix.estimatedImpact}</span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">{fix.rationale}</p>
                      {fix.targetAreas && fix.targetAreas.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {fix.targetAreas.map((area) => (
                            <span
                              key={`${fix.issueKey}-${area}`}
                              className="rounded-full bg-[rgba(57,75,70,0.06)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text)]"
                            >
                              {area}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {fix.targetReasons && fix.targetReasons.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {fix.targetReasons.map((reason, index) => (
                            <p key={`${fix.issueKey}-reason-${index}`} className="rounded-[14px] bg-[rgba(74,106,96,0.06)] px-3 py-2 text-sm leading-6 text-[color:var(--text)]">
                              Targets: {reason}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      {fix.actions.map((action, index) => (
                        <p key={`${fix.issueKey}-${index}`} className="mt-2 rounded-[14px] bg-[rgba(141,169,187,0.06)] px-3 py-2 text-sm text-[color:var(--text)]">
                          {action.content}
                        </p>
                      ))}
                    </div>
                  </div>
                </label>
              );
            })}
            <div className="rounded-[18px] border border-[rgba(57,75,70,0.08)] bg-white/90 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Before / after preview</p>
              {previewLoading ? <p className="mt-2 text-sm text-[color:var(--muted)]">Preparing exact recipe changes...</p> : null}
              {!previewLoading && preview ? (
                <div className="mt-2 space-y-3">
                  {preview.preview.changed_steps.slice(0, 3).map((change) => (
                    <div key={`step-${change.index}`} className="rounded-[16px] bg-[rgba(141,169,187,0.05)] p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">Step {change.index + 1}</p>
                      {change.before ? <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">Before: {change.before}</p> : null}
                      <p className="mt-1 text-sm leading-6 text-[color:var(--text)]">After: {change.after}</p>
                    </div>
                  ))}
                  {preview.preview.notes_before !== preview.preview.notes_after ? (
                    <div className="rounded-[16px] bg-[rgba(74,106,96,0.05)] p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">Chef notes</p>
                      {preview.preview.notes_before ? <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">Before: {preview.preview.notes_before}</p> : null}
                      {preview.preview.notes_after ? <p className="mt-1 text-sm leading-6 text-[color:var(--text)]">After: {preview.preview.notes_after}</p> : null}
                    </div>
                  ) : null}
                  {preview.preview.changed_steps.length === 0 && preview.preview.notes_before === preview.preview.notes_after ? (
                    <p className="text-sm text-[color:var(--muted)]">No step-level preview available for this selection yet.</p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void applySelectedFixes()}
              disabled={applyLoading || selectedFixKeys.length === 0}
              className="w-full rounded-full border border-[rgba(57,75,70,0.14)] bg-white px-4 py-3 text-sm font-semibold text-[color:var(--text)] disabled:opacity-60"
            >
              {applyLoading ? "Applying fixes..." : "Apply selected fixes"}
            </button>
          </div>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
