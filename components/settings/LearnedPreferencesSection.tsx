// components/settings/LearnedPreferencesSection.tsx
import { ResetLearnedPreferencesButton } from "@/components/settings/ResetLearnedPreferencesButton";
import type { LearnedSignals } from "@/lib/ai/learnedSignals";

const DIRECTION_ICON: Record<string, string> = {
  positive: "↑",
  negative: "↓",
};

export function LearnedPreferencesSection({ signals }: { signals: LearnedSignals }) {
  const hasPatterns = signals.patterns.length > 0;

  return (
    <div className="saas-card space-y-5 p-5">
      <div className="space-y-1">
        <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
          Learned from cooking
        </p>
        <p className="text-[15px] leading-7 text-[color:var(--text)]">
          {hasPatterns
            ? "Chef has picked up on these patterns from your post-cook feedback. They quietly shape suggestions."
            : "No patterns learned yet. Submit post-cook feedback after your next cook to start building your taste model."}
        </p>
      </div>

      {hasPatterns && (
        <ul className="space-y-2">
          {signals.patterns.map((pattern) => (
            <li
              key={pattern.key}
              className="flex items-center gap-2 rounded-[16px] border border-[rgba(79,54,33,0.08)] bg-[rgba(250,248,242,0.92)] px-4 py-3"
            >
              <span className="text-[16px] font-semibold text-[color:var(--primary)]">
                {DIRECTION_ICON[pattern.direction] ?? "·"}
              </span>
              <span className="text-[14px] font-medium text-[color:var(--text)]">{pattern.label}</span>
              <span className="ml-auto rounded-full bg-[rgba(111,102,95,0.08)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
                {pattern.confidence}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-[rgba(79,54,33,0.07)] pt-4">
        <p className="mb-3 text-[13px] text-[color:var(--muted)]">
          Clearing learned preferences does not affect your kitchen profile above.
        </p>
        <ResetLearnedPreferencesButton />
      </div>
    </div>
  );
}
