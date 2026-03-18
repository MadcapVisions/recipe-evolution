"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import type { AiTaskKey, AiTaskSettingRecord } from "@/lib/ai/taskSettings";
import type { OpenRouterModelOption } from "@/lib/ai/openRouterModels";

type AiTaskSettingsFormProps = {
  initialSettings: AiTaskSettingRecord[];
  modelOptions: OpenRouterModelOption[];
};

type EditableTaskSetting = AiTaskSettingRecord;

type RecommendationTone = "green" | "yellow" | "red" | null;

type TaskRecommendation = {
  prefix: string;
  note: string;
  matches: (modelId: string) => boolean;
};

// Use startsWith for flexible model ID matching (OpenRouter may append version suffixes)
function matchesAny(id: string, prefixes: string[]): boolean {
  const normalized = id.toLowerCase();
  return prefixes.some((p) => normalized === p || normalized.startsWith(p + "-") || normalized.startsWith(p + ":") || normalized.startsWith(p + "/"));
}

const TASK_RECOMMENDATIONS: Record<AiTaskKey, TaskRecommendation[]> = {
  chef_chat: [
    {
      // Benchmark: all 3 top models scored 7/10. Gemini 2.5 Flash is 3x faster (1.9s vs 5.7s)
      // at same cost — ideal for chat responsiveness. GPT-4o mini and DeepSeek also solid.
      prefix: "🟢",
      note: "best value — fast & reliable for chat",
      matches: (id) => matchesAny(id, ["openai/gpt-4o-mini", "google/gemini-2.5-flash", "deepseek/deepseek-chat", "google/gemini-2.0-flash"]),
    },
    {
      prefix: "🟡",
      note: "more expensive, marginal gain for chat",
      matches: (id) => matchesAny(id, ["anthropic/claude-3.5-haiku"]),
    },
    {
      prefix: "🔴",
      note: "premium and expensive",
      matches: (id) => matchesAny(id, ["anthropic/claude-3.5-sonnet"]),
    },
  ],
  home_ideas: [
    {
      // Benchmark: all 3 scored 10/10. GPT-4o mini cheapest, Gemini fastest.
      prefix: "🟢",
      note: "best value — all scored 10/10 in benchmark",
      matches: (id) => matchesAny(id, ["openai/gpt-4o-mini", "google/gemini-2.5-flash", "deepseek/deepseek-chat", "google/gemini-2.0-flash"]),
    },
    {
      prefix: "🟡",
      note: "more expensive, no quality gain here",
      matches: (id) => matchesAny(id, ["anthropic/claude-3.5-haiku"]),
    },
    {
      prefix: "🔴",
      note: "premium and expensive",
      matches: (id) => matchesAny(id, ["anthropic/claude-3.5-sonnet"]),
    },
  ],
  home_recipe: [
    {
      // Benchmark: all 3 scored 10/10. GPT-4o mini cheapest ($0.51/1k).
      // Gemini 2.5 Flash 3x faster and same quality. DeepSeek slowest (19s).
      prefix: "🟢",
      note: "best value — all scored 10/10 in benchmark",
      matches: (id) => matchesAny(id, ["openai/gpt-4o-mini", "google/gemini-2.5-flash", "deepseek/deepseek-chat"]),
    },
    {
      prefix: "🟡",
      note: "higher cost, comparable quality",
      matches: (id) => matchesAny(id, ["anthropic/claude-3.5-haiku", "google/gemini-2.0-flash"]),
    },
    {
      prefix: "🔴",
      note: "premium and expensive",
      matches: (id) => matchesAny(id, ["anthropic/claude-3.5-sonnet"]),
    },
  ],
  recipe_improvement: [
    {
      // Benchmark: GPT-4o mini 10/10, DeepSeek V3 10/10. Gemini 2.5 Flash FAILED (JSON parse).
      // Do not use Gemini 2.5 Flash for this task.
      prefix: "🟢",
      note: "best value — 10/10 in benchmark",
      matches: (id) => matchesAny(id, ["openai/gpt-4o-mini", "deepseek/deepseek-chat", "deepseek/deepseek-r1-distill-qwen-32b"]),
    },
    {
      // Gemini 2.5 Flash failed JSON on recipe improvement — avoid as primary
      prefix: "🟡",
      note: "use as fallback only — Gemini failed JSON here",
      matches: (id) => matchesAny(id, ["google/gemini-2.5-flash", "anthropic/claude-3.5-haiku", "deepseek/deepseek-r1-0528"]),
    },
    {
      prefix: "🔴",
      note: "premium and expensive",
      matches: (id) => matchesAny(id, ["anthropic/claude-3.5-sonnet"]),
    },
  ],
  recipe_structure: [
    {
      // Benchmark: all 3 scored 10/10. GPT-4o mini cheapest, Gemini 2.5 Flash fastest (4s vs 7s).
      prefix: "🟢",
      note: "best value — all scored 10/10 in benchmark",
      matches: (id) => matchesAny(id, ["openai/gpt-4o-mini", "google/gemini-2.5-flash", "deepseek/deepseek-chat", "google/gemini-2.0-flash"]),
    },
    {
      prefix: "🟡",
      note: "worth it for stricter JSON reliability",
      matches: (id) => matchesAny(id, ["deepseek/deepseek-r1-distill-qwen-32b", "anthropic/claude-3.5-haiku"]),
    },
    {
      prefix: "🔴",
      note: "premium and expensive",
      matches: (id) => matchesAny(id, ["anthropic/claude-3.5-sonnet"]),
    },
  ],
};

function getRecommendation(taskKey: AiTaskKey, modelId: string) {
  const recommendations = TASK_RECOMMENDATIONS[taskKey];
  return recommendations.find((item) => item.matches(modelId)) ?? null;
}

function getExpensiveTone(option: OpenRouterModelOption): RecommendationTone {
  if ((option.promptPricePerMillion ?? 0) >= 1 || (option.completionPricePerMillion ?? 0) >= 10) {
    return "red";
  }
  return null;
}

function withDisplayLabel(taskKey: AiTaskKey, option: OpenRouterModelOption) {
  const recommendation = getRecommendation(taskKey, option.id);
  if (recommendation) {
    return {
      ...option,
      displayLabel: `${recommendation.prefix} ${option.label} · ${recommendation.note}`,
      recommendationPrefix: recommendation.prefix,
      sortRank: recommendation.prefix === "🟢" ? 1 : recommendation.prefix === "🟡" ? 2 : 3,
    };
  }

  const expensiveTone = getExpensiveTone(option);
  if (expensiveTone === "red") {
    return {
      ...option,
      displayLabel: `🔴 ${option.label} · premium / expensive`,
      recommendationPrefix: "🔴",
      sortRank: 99,
    };
  }

  return {
    ...option,
    displayLabel: option.label,
    recommendationPrefix: null,
    sortRank: 999,
  };
}

function selectOptions(taskKey: AiTaskKey, currentValue: string | null, modelOptions: OpenRouterModelOption[]) {
  const deduped = new Map<string, OpenRouterModelOption>();
  for (const option of modelOptions) {
    deduped.set(option.id, option);
  }

  const decoratedOptions = Array.from(deduped.values()).map((option) => withDisplayLabel(taskKey, option));
  const recommendedOptions = decoratedOptions
    .filter((option) => option.recommendationPrefix === "🟢" || option.recommendationPrefix === "🟡" || option.recommendationPrefix === "🔴")
    .sort((a, b) => {
      const rankA = a.sortRank;
      const rankB = b.sortRank;
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return a.id.localeCompare(b.id);
    });
  const currentOption = currentValue ? deduped.get(currentValue) ?? null : null;

  return {
    currentOption: currentOption ? withDisplayLabel(taskKey, currentOption) : null,
    recommendedOptions,
    allOptions: decoratedOptions.sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export function AiTaskSettingsForm({ initialSettings, modelOptions }: AiTaskSettingsFormProps) {
  const [settings, setSettings] = useState<EditableTaskSetting[]>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { tone: "success" | "error"; text: string }>>({});

  const updateSetting = <K extends keyof EditableTaskSetting>(taskKey: string, key: K, value: EditableTaskSetting[K]) => {
    setSettings((current) =>
      current.map((item) => (item.taskKey === taskKey ? { ...item, [key]: value } : item))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/ai-task-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          settings: settings.map((item) => ({
            taskKey: item.taskKey,
            primaryModel: item.primaryModel,
            fallbackModel: item.fallbackModel,
            temperature: item.temperature,
            maxTokens: item.maxTokens,
            enabled: item.enabled,
          })),
        }),
      });

      const payload = (await response.json()) as {
        error?: boolean;
        message?: string;
        settings?: AiTaskSettingRecord[];
      };

      if (!response.ok || payload.error || !payload.settings) {
        throw new Error(payload.message ?? "Failed to save AI task settings.");
      }

      setSettings(payload.settings);
      setMessage("AI task settings updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save AI task settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleModelTest = async (taskKey: AiTaskKey, slot: "primary" | "fallback", model: string | null) => {
    const trimmedModel = model?.trim() ?? "";
    if (!trimmedModel) {
      setTestResults((current) => ({
        ...current,
        [`${taskKey}:${slot}`]: { tone: "error", text: "Choose a model first." },
      }));
      return;
    }

    const stateKey = `${taskKey}:${slot}`;
    setTestingKey(stateKey);
    setTestResults((current) => ({
      ...current,
      [stateKey]: { tone: "success", text: "Testing model..." },
    }));

    try {
      const response = await fetch("/api/admin/ai-model-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskKey, model: trimmedModel }),
      });

      const payload = (await response.json()) as {
        error?: boolean;
        message?: string;
        latencyMs?: number;
        preview?: string;
        model?: string;
      };

      if (!response.ok || payload.error) {
        throw new Error(payload.message ?? "Model test failed.");
      }

      setTestResults((current) => ({
        ...current,
        [stateKey]: {
          tone: "success",
          text: `Passed in ${payload.latencyMs ?? 0}ms${payload.preview ? `: ${payload.preview}` : ""}`,
        },
      }));
    } catch (testError) {
      setTestResults((current) => ({
        ...current,
        [stateKey]: {
          tone: "error",
          text: testError instanceof Error ? testError.message : "Model test failed.",
        },
      }));
    } finally {
      setTestingKey((current) => (current === stateKey ? null : current));
    }
  };

  return (
    <section className="saas-card space-y-6 p-5">
      <div className="settings-highlight p-4">
        <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">OpenRouter task routing</p>
        <p className="mt-2 text-[18px] font-semibold text-[color:var(--text)]">Choose the model used for each AI step.</p>
        <p className="mt-1 text-[15px] leading-6 text-[color:var(--muted)]">
          Each task resolves to a primary OpenRouter model, an optional fallback, and its own token and temperature defaults.
        </p>
      </div>

      <div className="space-y-4">
        {settings.map((setting) => (
          <section key={setting.taskKey} className="settings-section space-y-4 p-4">
            <div className="space-y-1">
              <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">{setting.label}</p>
              <p className="text-[15px] leading-6 text-[color:var(--muted)]">{setting.description}</p>
              <p className="text-[13px] text-[color:var(--muted)]">🟢 cheapest recommended, 🟡 more expensive but worth it, 🔴 premium / expensive</p>
            </div>

            {(() => {
              const primaryOptions = selectOptions(setting.taskKey, setting.primaryModel, modelOptions);
              const fallbackOptions = selectOptions(setting.taskKey, setting.fallbackModel, modelOptions);

              return (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[15px] font-medium text-[color:var(--text)]" htmlFor={`${setting.taskKey}-primary-select`}>
                        Primary Model
                      </label>
                      <select
                        id={`${setting.taskKey}-primary-select`}
                        value={setting.primaryModel}
                        onChange={(event) => updateSetting(setting.taskKey, "primaryModel", event.target.value)}
                        className="settings-field min-h-12 w-full"
                      >
                        {primaryOptions.currentOption && !primaryOptions.recommendedOptions.some((item) => item.id === primaryOptions.currentOption?.id) ? (
                          <option value={primaryOptions.currentOption.id}>{primaryOptions.currentOption.displayLabel}</option>
                        ) : null}
                        <optgroup label="Recommended price/performance">
                          {primaryOptions.recommendedOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.displayLabel}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="All OpenRouter models">
                          {primaryOptions.allOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.displayLabel}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[13px] font-medium text-[color:var(--muted)]" htmlFor={`${setting.taskKey}-primary`}>
                        Primary Model ID
                      </label>
                      <input
                        id={`${setting.taskKey}-primary`}
                        value={setting.primaryModel}
                        onChange={(event) => updateSetting(setting.taskKey, "primaryModel", event.target.value)}
                        className="settings-field min-h-12 w-full"
                        placeholder="openai/gpt-4o-mini"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="secondary"
                        onClick={() => void handleModelTest(setting.taskKey, "primary", setting.primaryModel)}
                        disabled={testingKey === `${setting.taskKey}:primary`}
                      >
                        {testingKey === `${setting.taskKey}:primary` ? "Testing..." : "Test Primary"}
                      </Button>
                      {testResults[`${setting.taskKey}:primary`] ? (
                        <p className={testResults[`${setting.taskKey}:primary`].tone === "error" ? "text-sm text-red-700" : "text-sm text-green-700"}>
                          {testResults[`${setting.taskKey}:primary`].text}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[15px] font-medium text-[color:var(--text)]" htmlFor={`${setting.taskKey}-fallback-select`}>
                        Fallback Model
                      </label>
                      <select
                        id={`${setting.taskKey}-fallback-select`}
                        value={setting.fallbackModel ?? ""}
                        onChange={(event) => updateSetting(setting.taskKey, "fallbackModel", event.target.value || null)}
                        className="settings-field min-h-12 w-full"
                      >
                        <option value="">No fallback</option>
                        {fallbackOptions.currentOption && !fallbackOptions.recommendedOptions.some((item) => item.id === fallbackOptions.currentOption?.id) ? (
                          <option value={fallbackOptions.currentOption.id}>{fallbackOptions.currentOption.displayLabel}</option>
                        ) : null}
                        <optgroup label="Recommended price/performance">
                          {fallbackOptions.recommendedOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.displayLabel}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="All OpenRouter models">
                          {fallbackOptions.allOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.displayLabel}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[13px] font-medium text-[color:var(--muted)]" htmlFor={`${setting.taskKey}-fallback`}>
                        Fallback Model ID
                      </label>
                      <input
                        id={`${setting.taskKey}-fallback`}
                        value={setting.fallbackModel ?? ""}
                        onChange={(event) => updateSetting(setting.taskKey, "fallbackModel", event.target.value || null)}
                        className="settings-field min-h-12 w-full"
                        placeholder="deepseek/deepseek-chat"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="secondary"
                        onClick={() => void handleModelTest(setting.taskKey, "fallback", setting.fallbackModel)}
                        disabled={testingKey === `${setting.taskKey}:fallback` || !setting.fallbackModel}
                      >
                        {testingKey === `${setting.taskKey}:fallback` ? "Testing..." : "Test Fallback"}
                      </Button>
                      {testResults[`${setting.taskKey}:fallback`] ? (
                        <p className={testResults[`${setting.taskKey}:fallback`].tone === "error" ? "text-sm text-red-700" : "text-sm text-green-700"}>
                          {testResults[`${setting.taskKey}:fallback`].text}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,160px)_minmax(0,160px)_auto]">
              <div className="space-y-1">
                <label className="text-[15px] font-medium text-[color:var(--text)]" htmlFor={`${setting.taskKey}-temperature`}>
                  Temperature
                </label>
                <input
                  id={`${setting.taskKey}-temperature`}
                  type="number"
                  min="0"
                  max="2"
                  step="0.05"
                  value={String(setting.temperature)}
                  onChange={(event) => updateSetting(setting.taskKey, "temperature", Number(event.target.value))}
                  className="settings-field min-h-12 w-full"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[15px] font-medium text-[color:var(--text)]" htmlFor={`${setting.taskKey}-maxTokens`}>
                  Max Tokens
                </label>
                <input
                  id={`${setting.taskKey}-maxTokens`}
                  type="number"
                  min="1"
                  step="1"
                  value={String(setting.maxTokens)}
                  onChange={(event) => updateSetting(setting.taskKey, "maxTokens", Number(event.target.value))}
                  className="settings-field min-h-12 w-full"
                />
              </div>
              <label className="mt-6 inline-flex min-h-12 items-center gap-3 text-[15px] font-medium text-[color:var(--text)]">
                <input
                  type="checkbox"
                  checked={setting.enabled}
                  onChange={(event) => updateSetting(setting.taskKey, "enabled", event.target.checked)}
                />
                Enabled
              </label>
            </div>

            <p className="text-[13px] text-[color:var(--muted)]">
              Last updated {setting.updatedAt ? new Date(setting.updatedAt).toLocaleString() : "from defaults"}.
            </p>
          </section>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save AI Settings"}
        </Button>
        <p className="text-sm text-[color:var(--muted)]">Recommended models are ranked per task. The full OpenRouter catalog is alphabetical so it stays easy to scan.</p>
        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </div>
    </section>
  );
}
