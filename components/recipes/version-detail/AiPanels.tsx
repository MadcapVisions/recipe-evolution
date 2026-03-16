"use client";

import type { RefObject } from "react";
import type { ConversationMessage, SuggestedChange } from "@/components/recipes/version-detail/types";
import type { PrepPlan } from "@/lib/recipes/prepPlan";

function quickChip(active = false) {
  return active
    ? "app-chip app-chip-active justify-center"
    : "app-chip justify-center border border-[rgba(57,75,70,0.08)] bg-[rgba(141,169,187,0.08)] hover:bg-[rgba(141,169,187,0.14)]";
}

export function ChefAiPanel({
  aiConversation,
  customInstruction,
  suggestedChange,
  isAskingAi,
  isGeneratingVersion,
  aiError,
  onQuickAction,
  onRemixLeftovers,
  onInstructionChange,
  onAskSubmit,
  onApplySuggestedChange,
  conversationEndRef,
}: {
  aiConversation: ConversationMessage[];
  customInstruction: string;
  suggestedChange: SuggestedChange | null;
  isAskingAi: boolean;
  isGeneratingVersion: boolean;
  aiError: string | null;
  onQuickAction: (instruction: string) => void;
  onRemixLeftovers: () => void;
  onInstructionChange: (value: string) => void;
  onAskSubmit: () => void;
  onApplySuggestedChange: () => void;
  conversationEndRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <section className="app-panel p-4 sm:p-5">
      <p className="app-kicker">Chef workshop</p>
      <h2 className="mt-2 font-display text-[24px] font-semibold tracking-tight text-[color:var(--text)] sm:text-[28px]">Refine this version with intent.</h2>
      <p className="mt-2 text-[15px] leading-7 text-[color:var(--muted)]">Use Chef to pressure-test the dish, explore targeted moves, and save the iteration that deserves to stick.</p>

      <div className="mt-5">
        <p className="app-kicker">Development moves</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            { label: "Improve Flavor", instruction: "Improve the flavor profile" },
            { label: "Make Vegetarian", instruction: "Make this recipe vegetarian" },
            { label: "Reduce Calories", instruction: "Reduce calories but keep flavor" },
            { label: "Make Faster", instruction: "Make this recipe faster to cook" },
            { label: "High Protein", instruction: "Make this recipe high protein" },
            { label: "Make it Spicy", instruction: "Make this recipe spicy" },
          ].map((item) => (
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

      <div className="mt-5">
        <p className="text-[16px] font-semibold text-[color:var(--text)]">Ask the Chef</p>
        <p className="mt-1 text-sm text-[color:var(--muted)]">Treat chat like a test kitchen bench: get guidance first, then save the change only if it improves the dish.</p>
        <div className="mt-3 flex min-h-[140px] max-h-[240px] flex-col gap-3 overflow-y-auto rounded-[24px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.84)] p-4 sm:min-h-[240px] sm:max-h-[340px] sm:rounded-[26px]">
          {aiConversation.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[88%] rounded-[22px] px-4 py-3 text-[15px] leading-6 ${
                  message.role === "user"
                    ? "bg-[color:var(--primary)] text-white"
                    : "border border-[rgba(57,75,70,0.08)] bg-white text-[color:var(--text)]"
                }`}
              >
                {message.text}
              </div>
            </div>
          ))}
          {aiConversation.length === 0 && !isAskingAi ? (
            <div className="self-start rounded-[22px] border border-[rgba(57,75,70,0.08)] bg-white px-4 py-3 text-[15px] text-[color:var(--muted)]">
              Ask the chef anything about this version...
            </div>
          ) : null}
          {isAskingAi ? (
            <div className="self-start rounded-[22px] border border-[rgba(57,75,70,0.08)] bg-white px-4 py-3 text-[15px] text-[color:var(--muted)]">
              Thinking...
            </div>
          ) : null}
          {suggestedChange && !isAskingAi ? (
            <div className="self-start max-w-[92%] rounded-[24px] border border-[rgba(74,106,96,0.14)] bg-[rgba(250,248,242,0.94)] px-4 py-4 shadow-[inset_3px_0_0_var(--primary)]">
              <p className="app-kicker text-[color:var(--primary)]">Ready to save</p>
              <p className="mt-2 text-[15px] leading-7 text-[color:var(--text)]">
                {suggestedChange.explanation?.trim() || "AI suggested a concrete recipe modification you can apply."}
              </p>
              <button
                type="button"
                onClick={onApplySuggestedChange}
                disabled={isGeneratingVersion || isAskingAi}
                className="mt-4 w-full rounded-full bg-[color:var(--primary)] px-4 py-3 text-[15px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_18px_rgba(58,84,76,0.16)] hover:bg-[color:var(--primary-strong)] disabled:opacity-60"
              >
                Save as New Version
              </button>
            </div>
          ) : null}
          <div ref={conversationEndRef} />
        </div>
        <div className="mt-3 flex gap-2">
          <input
            id="custom-ai-instruction"
            type="text"
            value={customInstruction}
            onChange={(event) => onInstructionChange(event.target.value)}
            placeholder="Ask about flavor, technique, speed, substitutions..."
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

export function NutritionPanel({
  nutrition,
  totalMinutes,
}: {
  nutrition: { calories: number; protein: number; fat: number; carbs: number };
  totalMinutes: number;
}) {
  return (
    <section className="app-panel p-4 sm:p-5">
      <p className="app-kicker">Nutrition</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricCard label="Calories" value={`${nutrition.calories}`} tone="bg-[rgba(255,255,255,0.7)]" />
        <MetricCard label="Protein" value={`${nutrition.protein}g`} tone="bg-[rgba(141,169,187,0.1)]" />
        <MetricCard label="Fat" value={`${nutrition.fat}g`} tone="bg-[rgba(255,255,255,0.7)]" />
        <MetricCard label="Carbs" value={`${nutrition.carbs}g`} tone="bg-[rgba(141,169,187,0.1)]" />
      </div>
      <div className="mt-3 rounded-[20px] bg-[rgba(82,124,116,0.08)] p-4 text-center">
        <p className="app-kicker">Total time</p>
        <p className="mt-2 text-[24px] font-semibold text-[color:var(--text)] sm:text-[28px]">{totalMinutes} min</p>
      </div>
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
