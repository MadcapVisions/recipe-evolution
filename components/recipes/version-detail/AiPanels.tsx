"use client";

import { useState, type FocusEvent, type RefObject } from "react";
import type { ChefDirectionOption } from "@/lib/ai/chefOptions";
import type { ConversationMessage, SelectedAssistantDirection, SuggestedChange } from "@/components/recipes/version-detail/types";
import type { PrepPlan } from "@/lib/recipes/prepPlan";
import type { NutritionFacts } from "@/lib/ai/nutritionFacts";
import { analyzeRecipeTurn } from "@/lib/ai/recipeOrchestrator";

function compactOptionSummary(summary: string) {
  const firstSentence = summary.split(/[.!?]/)[0]?.trim() ?? summary.trim();
  return firstSentence.length > 88 ? `${firstSentence.slice(0, 85).trim()}...` : firstSentence;
}

function quickChip(active = false) {
  return active
    ? "app-chip app-chip-active justify-center"
    : "app-chip justify-center border border-[rgba(57,75,70,0.08)] bg-[rgba(141,169,187,0.08)] hover:bg-[rgba(141,169,187,0.14)]";
}

const QUICK_ACTIONS = [
  { label: "Improve Flavor", instruction: "Improve the flavor profile" },
  { label: "Make Vegetarian", instruction: "Make this recipe vegetarian" },
  { label: "Reduce Calories", instruction: "Reduce calories but keep flavor" },
  { label: "Make Faster", instruction: "Make this recipe faster to cook" },
  { label: "High Protein", instruction: "Make this recipe high protein" },
  { label: "Make it Spicy", instruction: "Make this recipe spicy" },
];

export function ChefAiPanel({
  recipeTitle,
  versionName,
  versionSavedAt,
  aiConversation,
  selectedDirection,
  customInstruction,
  suggestedChange,
  isAskingAi,
  isGeneratingVersion,
  aiError,
  onQuickAction,
  onRemixLeftovers,
  onInstructionChange,
  onAskSubmit,
  onSelectDirection,
  onClearDirection,
  onApplySuggestedChange,
  onBuildLatestRequest,
  onForkFromSuggestion,
  onComposerFocus,
  conversationEndRef,
}: {
  recipeTitle: string;
  versionName: string;
  versionSavedAt: string;
  aiConversation: ConversationMessage[];
  selectedDirection: SelectedAssistantDirection | null;
  customInstruction: string;
  suggestedChange: SuggestedChange | null;
  isAskingAi: boolean;
  isGeneratingVersion: boolean;
  aiError: string | null;
  onQuickAction: (instruction: string) => void;
  onRemixLeftovers: () => void;
  onInstructionChange: (value: string) => void;
  onAskSubmit: () => void;
  onSelectDirection: (messageId: string, option: ChefDirectionOption) => void;
  onClearDirection: () => void;
  onApplySuggestedChange: () => void;
  onBuildLatestRequest: () => void;
  onForkFromSuggestion: () => void;
  onComposerFocus?: () => void;
  conversationEndRef: RefObject<HTMLDivElement | null>;
}) {
  const [composerFocused, setComposerFocused] = useState(false);
  const shouldPrioritizeChat = composerFocused || aiConversation.length > 0 || Boolean(suggestedChange);
  const isRefining = selectedDirection != null;
  const latestAssistantMessageId = [...aiConversation]
    .reverse()
    .find((message) => message.role === "assistant" && (message.options?.length ?? 0) === 0)?.id;
  const latestUserMessage = [...aiConversation].reverse().find((message) => message.role === "user") ?? null;
  const latestTurnAnalysis = latestUserMessage
    ? analyzeRecipeTurn({
        userMessage: latestUserMessage.text,
        selectedDirectionLocked: selectedDirection !== null,
      })
    : null;
  const showBuildLatestRequest =
    !suggestedChange &&
    !isAskingAi &&
    latestUserMessage !== null &&
    latestTurnAnalysis?.canBuildLatestRequest === true;

  return (
    <section className="app-panel flex flex-col p-4 sm:p-5">
      <p className="app-kicker">Chef workshop</p>
      <h2 className="mt-2 font-display text-[24px] font-semibold tracking-tight text-[color:var(--text)] sm:text-[28px]">Ask the Chef</h2>
      <p className="mt-2 text-[15px] leading-7 text-[color:var(--muted)]">This workshop is attached to the recipe on the page. Every suggestion and saved change refers to the current version shown in the center column.</p>
      <div className="mt-4 rounded-[24px] border border-[rgba(74,106,96,0.12)] bg-[rgba(247,250,248,0.9)] p-4 shadow-[inset_3px_0_0_var(--primary)]">
        <p className="app-kicker text-[color:var(--primary)]">Working on now</p>
        <p className="mt-2 text-[18px] font-semibold leading-tight text-[color:var(--text)]">{recipeTitle}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--text)]">{versionName}</span>
          <span className="rounded-full bg-[rgba(79,125,115,0.12)] px-3 py-1.5 text-xs font-semibold text-[color:var(--primary)]">
            Saved {versionSavedAt}
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">Save-worthy chat results should become a new version of this recipe, not a separate draft.</p>
      </div>

      {!shouldPrioritizeChat ? (
        <div className="mt-5">
          <p className="app-kicker">Quick actions</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((item) => (
              <button key={item.label} type="button" onClick={() => onQuickAction(item.instruction)} disabled={isAskingAi || isGeneratingVersion} className={quickChip()}>
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onRemixLeftovers}
            disabled={isAskingAi || isGeneratingVersion}
            className="mt-3 w-full rounded-full border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.92)] px-4 py-3 text-[15px] font-semibold text-[color:var(--text)] transition hover:bg-white disabled:opacity-60"
          >
            Build a Leftover Remix
          </button>
        </div>
      ) : (
        <details className="mt-5 rounded-[22px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.72)] p-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-[color:var(--text)]">Quick actions</summary>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((item) => (
              <button key={item.label} type="button" onClick={() => onQuickAction(item.instruction)} disabled={isAskingAi || isGeneratingVersion} className={quickChip()}>
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onRemixLeftovers}
            disabled={isAskingAi || isGeneratingVersion}
            className="mt-3 w-full rounded-full border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.92)] px-4 py-3 text-[15px] font-semibold text-[color:var(--text)] transition hover:bg-white disabled:opacity-60"
          >
            Build a Leftover Remix
          </button>
        </details>
      )}

      {selectedDirection ? (
        <div className="mt-5 rounded-[24px] border border-[rgba(74,106,96,0.14)] bg-[rgba(247,250,248,0.92)] p-4 shadow-[inset_3px_0_0_var(--primary)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="app-kicker text-[color:var(--primary)]">Current direction</p>
              <p className="mt-2 text-[17px] font-semibold text-[color:var(--text)]">{selectedDirection.title}</p>
              <p className="mt-2 text-[14px] leading-6 text-[color:var(--muted)]">{selectedDirection.summary}</p>
              {selectedDirection.tags.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedDirection.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-[rgba(111,102,95,0.08)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--muted)]">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClearDirection}
              className="shrink-0 rounded-full border border-[rgba(57,75,70,0.12)] bg-white px-4 py-2 text-[12px] font-semibold text-[color:var(--text)] transition hover:bg-[rgba(74,106,96,0.08)]"
            >
              Change direction
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        <div className="mt-3 flex min-h-[280px] max-h-[58vh] flex-1 flex-col gap-3 overflow-y-auto rounded-[24px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.84)] p-4 sm:min-h-[360px] sm:max-h-[62vh] sm:rounded-[26px]">
          {aiConversation.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[92%] ${message.role === "assistant" ? "space-y-2" : ""}`}>
                <div
                  className={`rounded-[22px] px-4 py-3 text-[15px] leading-6 ${
                    message.kind === "direction_selected"
                      ? "border border-[rgba(74,106,96,0.12)] bg-[rgba(247,250,248,0.95)] text-[color:var(--text)] shadow-[inset_3px_0_0_var(--primary)]"
                      : message.role === "user"
                      ? "bg-[color:var(--primary)] text-white"
                      : "border border-[rgba(57,75,70,0.08)] bg-white text-[color:var(--text)]"
                  }`}
                >
                  {message.text}
                </div>
                {message.role === "assistant" && (message.options?.length ?? 0) > 0 ? (
                  selectedDirection?.messageId === message.id ? null : (
                    <div className="space-y-2">
                      <div className="space-y-2 sm:hidden">
                        {message.options?.map((option) => {
                          const recommended = message.recommendedOptionId === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => onSelectDirection(message.id, option)}
                              className="w-full rounded-[18px] border border-[rgba(57,75,70,0.08)] bg-white px-3 py-3 text-left transition hover:bg-[rgba(74,106,96,0.05)]"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-[14px] font-semibold text-[color:var(--text)]">{option.title}</p>
                                    {recommended ? (
                                      <span className="shrink-0 rounded-full bg-[rgba(74,106,96,0.1)] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[color:var(--primary)]">
                                        Best pick
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 text-[12px] leading-5 text-[color:var(--muted)]">{compactOptionSummary(option.summary)}</p>
                                  {option.tags.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {option.tags.slice(0, 2).map((tag) => (
                                        <span key={`${option.id}-${tag}`} className="rounded-full bg-[rgba(111,102,95,0.08)] px-2 py-1 text-[10px] font-medium text-[color:var(--muted)]">
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--primary)]">
                                  Choose
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <div className="hidden gap-2 sm:grid sm:grid-cols-2">
                        {message.options?.map((option) => {
                          const selected =
                            selectedDirection?.messageId === message.id && selectedDirection.optionId === option.id;
                          const recommended = message.recommendedOptionId === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => onSelectDirection(message.id, option)}
                              className={`rounded-[20px] border px-4 py-3 text-left transition ${
                                selected
                                  ? "border-[rgba(74,106,96,0.28)] bg-[rgba(247,250,248,0.95)] shadow-[inset_3px_0_0_var(--primary)]"
                                  : "border-[rgba(57,75,70,0.08)] bg-white hover:bg-[rgba(74,106,96,0.05)]"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-[14px] font-semibold text-[color:var(--text)]">{option.title}</p>
                                {recommended ? (
                                  <span className="shrink-0 rounded-full bg-[rgba(74,106,96,0.1)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--primary)]">
                                    Best pick
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-[13px] leading-6 text-[color:var(--muted)]">{compactOptionSummary(option.summary)}</p>
                              {option.tags.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {option.tags.slice(0, 3).map((tag) => (
                                    <span key={`${option.id}-${tag}`} className="rounded-full bg-[rgba(111,102,95,0.08)] px-2 py-1 text-[11px] font-medium text-[color:var(--muted)]">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                              <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-[color:var(--primary)]">
                                {selected ? "Selected direction" : "Choose this direction"}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )
                ) : null}
                {message.role === "assistant" && suggestedChange && !isAskingAi && message.id === latestAssistantMessageId ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={onApplySuggestedChange}
                      disabled={isGeneratingVersion || isAskingAi}
                      className="rounded-full bg-[color:var(--primary)] px-4 py-2.5 text-[14px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_18px_rgba(58,84,76,0.16)] hover:bg-[color:var(--primary-strong)] disabled:opacity-60"
                    >
                      {isGeneratingVersion ? "Applying chef changes..." : "Apply chef changes"}
                    </button>
                    <button
                      type="button"
                      onClick={onForkFromSuggestion}
                      disabled={isGeneratingVersion || isAskingAi}
                      className="rounded-full border border-[rgba(74,106,96,0.2)] bg-transparent px-4 py-2.5 text-[14px] font-medium text-[color:var(--muted)] transition hover:border-[rgba(74,106,96,0.4)] hover:text-[color:var(--text)] disabled:opacity-60"
                    >
                      Create Recipe
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {aiConversation.length === 0 && !isAskingAi ? (
            <div className="self-start rounded-[22px] border border-[rgba(57,75,70,0.08)] bg-white px-4 py-3 text-[15px] text-[color:var(--muted)]">
              Ask about flavor, technique, substitutions, timing, or how to improve this version...
            </div>
          ) : null}
          {isAskingAi ? (
            <div className="self-start rounded-[22px] border border-[rgba(57,75,70,0.08)] bg-white px-4 py-3 text-[15px] text-[color:var(--muted)]">
              Thinking...
            </div>
          ) : null}
          <div ref={conversationEndRef} />
        </div>
        {suggestedChange && !isAskingAi ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onApplySuggestedChange}
              disabled={isGeneratingVersion || isAskingAi}
              className="rounded-full bg-[color:var(--primary)] px-4 py-3 text-[15px] font-semibold text-white hover:bg-[color:var(--primary-strong)] disabled:opacity-60"
            >
              {isGeneratingVersion ? "Applying chef changes..." : "Apply chef changes"}
            </button>
            <button
              type="button"
              onClick={onForkFromSuggestion}
              disabled={isGeneratingVersion || isAskingAi}
              className="rounded-full border border-[rgba(74,106,96,0.2)] bg-transparent px-4 py-3 text-[15px] font-medium text-[color:var(--muted)] transition hover:border-[rgba(74,106,96,0.4)] hover:text-[color:var(--text)] disabled:opacity-60"
            >
              Create Recipe
            </button>
          </div>
        ) : null}
        {showBuildLatestRequest ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={onBuildLatestRequest}
              disabled={isGeneratingVersion || isAskingAi}
              className="w-full rounded-full bg-[color:var(--primary)] px-4 py-3 text-[15px] font-semibold text-white hover:bg-[color:var(--primary-strong)] disabled:opacity-60"
            >
              {isGeneratingVersion ? "Applying chef changes..." : "Add these fixes to recipe"}
            </button>
          </div>
        ) : null}
        {aiError ? <p className="mt-3 text-sm text-red-600">{aiError}</p> : null}
        <div className="mt-3 flex gap-2">
          <input
            id="custom-ai-instruction"
            type="text"
            value={customInstruction}
            onChange={(event) => onInstructionChange(event.target.value)}
            onFocus={() => {
              setComposerFocused(true);
              onComposerFocus?.();
            }}
            onBlur={(event: FocusEvent<HTMLInputElement>) => {
              if (!event.currentTarget.value.trim()) {
                setComposerFocused(false);
              }
            }}
            placeholder={isRefining ? "Refine this direction: flavor, technique, timing, substitutions..." : "Ask about flavor, technique, timing, substitutions..."}
            className="min-w-0 flex-1 rounded-full bg-white px-4 py-3 text-[15px] sm:px-5 sm:text-[16px]"
          />
          <button
            type="button"
            onClick={onAskSubmit}
            disabled={isAskingAi || isGeneratingVersion || customInstruction.trim().length === 0}
            className="shrink-0 rounded-full bg-[color:var(--primary)] px-4 py-3 text-[15px] font-semibold text-white hover:bg-[color:var(--primary-strong)] disabled:opacity-60 sm:px-5"
          >
            Send
          </button>
        </div>
      </div>

    </section>
  );
}

export function MetricsPanel({
  prepMinutes,
  cookMinutes,
  difficulty,
  servings,
}: {
  prepMinutes: number;
  cookMinutes: number;
  difficulty: string;
  servings: number;
}) {
  return (
    <section className="app-panel p-4 sm:p-5">
      <p className="app-kicker">Recipe metrics</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricCard label="Prep Time" value={`${prepMinutes} min`} tone="bg-[rgba(141,169,187,0.1)]" />
        <MetricCard label="Cook Time" value={`${cookMinutes} min`} tone="bg-[rgba(142,168,141,0.12)]" />
        <MetricCard label="Difficulty" value={difficulty} tone="bg-[rgba(82,124,116,0.08)]" />
        <MetricCard label="Servings" value={servings > 0 ? `${servings}` : "-"} tone="bg-[rgba(255,255,255,0.7)]" />
      </div>
    </section>
  );
}

const DV = {
  totalFat: 78,
  saturatedFat: 20,
  cholesterol: 300,
  sodium: 2300,
  totalCarbs: 275,
  dietaryFiber: 28,
  protein: 50,
};

function pct(value: number, daily: number) {
  return Math.round((value / daily) * 100);
}

function NutritionRow({
  label,
  value,
  unit,
  daily,
  indent = false,
  bold = false,
}: {
  label: string;
  value: number;
  unit: string;
  daily?: number;
  indent?: boolean;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between border-t border-[color:var(--border)] py-[3px] text-[13px] ${indent ? "pl-4" : ""}`}
    >
      <span className={bold ? "font-semibold text-[color:var(--text)]" : "text-[color:var(--text)]"}>
        {label}{" "}
        <span className={bold ? "font-normal" : ""}>
          {value}
          {unit}
        </span>
      </span>
      {daily != null ? (
        <span className="ml-2 shrink-0 text-[color:var(--muted)]">{pct(value, daily)}%</span>
      ) : null}
    </div>
  );
}

export function NutritionPanel({
  facts,
  loading,
  error,
  onRecalculate,
}: {
  facts: NutritionFacts | null;
  loading: boolean;
  error?: boolean;
  onRecalculate: () => void;
}) {
  return (
    <section className="app-panel p-4 sm:p-5">
      <p className="app-kicker">Nutrition Facts</p>

      {loading ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-[rgba(141,169,187,0.15)]" />
          ))}
        </div>
      ) : facts ? (
        <>
          <div className="mt-3 border-t-4 border-[color:var(--text)] pb-1 pt-1">
            <div className="flex items-baseline justify-between text-[12px] text-[color:var(--muted)]">
              <span>Amount Per Serving</span>
              <span>% Daily Value</span>
            </div>
          </div>

          <div className="border-t-2 border-[color:var(--text)]">
            <div className="flex items-baseline justify-between border-b border-[color:var(--border)] py-[3px]">
              <span className="text-[14px] font-bold text-[color:var(--text)]">
                Calories <span className="text-[20px]">{facts.calories}</span>
              </span>
            </div>

            <div className="pb-1 pt-1 text-right text-[11px] font-semibold text-[color:var(--text)]">% Daily Value*</div>

            <NutritionRow label="Total Fat" value={facts.totalFat} unit="g" daily={DV.totalFat} bold />
            <NutritionRow label="Saturated Fat" value={facts.saturatedFat} unit="g" daily={DV.saturatedFat} indent />
            <NutritionRow label="Cholesterol" value={facts.cholesterol} unit="mg" daily={DV.cholesterol} bold />
            <NutritionRow label="Sodium" value={facts.sodium} unit="mg" daily={DV.sodium} bold />
            <NutritionRow label="Total Carbohydrate" value={facts.totalCarbs} unit="g" daily={DV.totalCarbs} bold />
            <NutritionRow label="Dietary Fiber" value={facts.dietaryFiber} unit="g" daily={DV.dietaryFiber} indent />
            <NutritionRow label="Sugars" value={facts.sugars} unit="g" indent />
            <NutritionRow label="Protein" value={facts.protein} unit="g" daily={DV.protein} bold />
          </div>

          <p className="mt-2 text-[11px] text-[color:var(--muted)]">
            * Estimates based on a 2,000 calorie diet.
          </p>
        </>
      ) : (
        <div className="mt-4 text-center">
          <p className="text-[13px] text-[color:var(--muted)]">
            {error ? "Could not estimate nutrition. Try again." : "No nutrition data yet."}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onRecalculate}
        disabled={loading}
        className="mt-3 text-[13px] font-medium text-[color:var(--accent)] underline underline-offset-2 hover:opacity-75 disabled:opacity-40"
      >
        {facts ? "Recalculate Nutrition Facts" : "Calculate Nutrition Facts"}
      </button>
    </section>
  );
}

export function PrepPlanPanel({
  prepPlan,
  completedChecklistIds = [],
  onToggleChecklistItem,
}: {
  prepPlan: PrepPlan;
  completedChecklistIds?: string[];
  onToggleChecklistItem?: (itemId: string) => void;
}) {
  return (
    <section className="app-panel p-4 sm:p-5">
      <p className="app-kicker">Prep plan</p>
      <div className="mt-4 space-y-4">
        {prepPlan.checklist.length > 0 ? (
          <div>
            <p className="text-[14px] font-semibold text-[color:var(--text)]">Checklist</p>
            <ul className="mt-2 space-y-2">
              {prepPlan.checklist.map((item) => {
                const checked = completedChecklistIds.includes(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onToggleChecklistItem?.(item.id)}
                      className={`w-full rounded-[18px] px-3 py-2 text-left text-sm transition ${
                        checked ? "bg-[rgba(142,168,141,0.18)] text-[color:var(--muted)]" : "bg-[rgba(141,169,187,0.08)] text-[color:var(--text)]"
                      }`}
                    >
                      <span className="mr-2 font-semibold">{checked ? "Done" : "Tap"}</span>
                      {item.title}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        <PrepPlanGroup title="Start here" items={prepPlan.firstMoves} empty="No suggested first moves detected." />
        <PrepPlanGroup title="Before you start" items={prepPlan.prepTasks} empty="No prep tasks detected." />
        <PrepPlanGroup title="Make-ahead cues" items={prepPlan.makeAheadTasks} empty="No make-ahead cues detected." />
        <PrepPlanGroup title="Good cooking windows" items={prepPlan.cookingWindows} empty="No long waiting windows detected." />
        <PrepPlanHighlights highlights={prepPlan.stepHighlights} />
      </div>
    </section>
  );
}

function PrepPlanHighlights({
  highlights,
}: {
  highlights: PrepPlan["stepHighlights"];
}) {
  if (highlights.length === 0) {
    return <p className="text-sm text-[color:var(--muted)]">No ingredient-to-step callouts detected.</p>;
  }

  return (
    <div>
      <p className="text-[14px] font-semibold text-[color:var(--text)]">Ingredient callouts</p>
      <ul className="mt-2 space-y-2">
        {highlights.map((highlight) => (
          <li key={highlight.step} className="rounded-[18px] bg-[rgba(141,169,187,0.08)] px-3 py-2 text-sm text-[color:var(--text)]">
            <span className="font-medium">{highlight.ingredients.join(", ")}</span>: {highlight.step}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PrepPlanGroup({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  if (items.length === 0) {
    return (
      <div>
        <p className="text-[14px] font-semibold text-[color:var(--text)]">{title}</p>
        <p className="mt-2 text-sm text-[color:var(--muted)]">{empty}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[14px] font-semibold text-[color:var(--text)]">{title}</p>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item} className="rounded-[18px] bg-[rgba(141,169,187,0.08)] px-3 py-2 text-sm leading-6 text-[color:var(--text)]">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-[20px] p-4 text-center sm:rounded-[22px] ${tone}`}>
      <p className="text-[20px] font-semibold text-[color:var(--text)] sm:text-[26px]">{value}</p>
      <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">{label}</p>
    </div>
  );
}
