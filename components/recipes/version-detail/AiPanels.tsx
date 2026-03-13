"use client";

import type { RefObject } from "react";
import type { ConversationMessage, SuggestedChange } from "@/components/recipes/version-detail/types";

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
    <section className="app-panel p-5">
      <p className="app-kicker">Chef AI</p>
      <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-[color:var(--text)]">Refine this version.</h2>
      <p className="mt-2 text-[16px] leading-7 text-[color:var(--muted)]">Ask questions, explore changes, or turn a suggestion into a new version.</p>

      <div className="mt-5">
        <p className="app-kicker">Quick improvements</p>
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
          Remix Leftovers
        </button>
      </div>

      <div className="mt-5">
        <p className="text-[16px] font-semibold text-[color:var(--text)]">Ask the Chef</p>
        <p className="mt-1 text-sm text-[color:var(--muted)]">Chat is for guidance first. Apply a suggestion only if it looks right.</p>
        <div className="mt-3 flex min-h-[240px] max-h-[340px] flex-col gap-3 overflow-y-auto rounded-[26px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.84)] p-4">
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
              Ask the chef anything about this recipe...
            </div>
          ) : null}
          {isAskingAi ? (
            <div className="self-start rounded-[22px] border border-[rgba(57,75,70,0.08)] bg-white px-4 py-3 text-[15px] text-[color:var(--muted)]">
              Thinking...
            </div>
          ) : null}
          {suggestedChange && !isAskingAi ? (
            <div className="self-start max-w-[92%] rounded-[24px] border border-[rgba(82,124,116,0.14)] bg-[rgba(82,124,116,0.08)] px-4 py-4">
              <p className="app-kicker text-[color:var(--primary)]">Suggested change</p>
              <p className="mt-2 text-[15px] leading-7 text-[color:var(--text)]">
                {suggestedChange.explanation?.trim() || "AI suggested a concrete recipe modification you can apply."}
              </p>
              <button
                type="button"
                onClick={onApplySuggestedChange}
                disabled={isGeneratingVersion || isAskingAi}
                className="mt-4 w-full rounded-full bg-[linear-gradient(135deg,var(--primary)_0%,var(--accent)_100%)] px-4 py-3 text-[15px] font-semibold text-white disabled:opacity-60"
              >
                Apply Change and Create Version
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
            placeholder="Ask the chef anything about this recipe..."
            className="flex-1 rounded-full bg-white px-5 py-3 text-[16px]"
          />
          <button
            type="button"
            onClick={onAskSubmit}
            disabled={isAskingAi || isGeneratingVersion || customInstruction.trim().length === 0}
            className="rounded-full bg-[color:var(--primary)] px-5 py-3 text-[15px] font-semibold text-white hover:bg-[color:var(--primary-strong)] disabled:opacity-60"
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
    <section className="app-panel p-5">
      <p className="app-kicker">Recipe metrics</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricCard label="Prep Time" value={`${prepMinutes} min`} tone="bg-[rgba(141,169,187,0.1)]" />
        <MetricCard label="Cook Time" value={`${cookMinutes} min`} tone="bg-[rgba(142,168,141,0.12)]" />
        <MetricCard label="Difficulty" value={difficulty} tone="bg-[rgba(82,124,116,0.08)]" />
        <MetricCard label="Servings" value={`${servings}`} tone="bg-[rgba(255,255,255,0.7)]" />
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
    <section className="app-panel p-5">
      <p className="app-kicker">Nutrition</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricCard label="Calories" value={`${nutrition.calories}`} tone="bg-[rgba(255,255,255,0.7)]" />
        <MetricCard label="Protein" value={`${nutrition.protein}g`} tone="bg-[rgba(141,169,187,0.1)]" />
        <MetricCard label="Fat" value={`${nutrition.fat}g`} tone="bg-[rgba(255,255,255,0.7)]" />
        <MetricCard label="Carbs" value={`${nutrition.carbs}g`} tone="bg-[rgba(141,169,187,0.1)]" />
      </div>
      <div className="mt-3 rounded-[22px] bg-[rgba(82,124,116,0.08)] p-4 text-center">
        <p className="app-kicker">Total time</p>
        <p className="mt-2 text-[28px] font-semibold text-[color:var(--text)]">{totalMinutes} min</p>
      </div>
    </section>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-[22px] p-4 text-center ${tone}`}>
      <p className="text-[26px] font-semibold text-[color:var(--text)]">{value}</p>
      <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">{label}</p>
    </div>
  );
}
