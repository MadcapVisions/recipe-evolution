"use client";

import { getIdeaIcon, getIdeaTags, getIconTone } from "@/components/home/ideaUtils";
import type { RecipeIdea } from "@/components/home/types";

type RecipeIdeasPanelProps = {
  ideas: RecipeIdea[];
  generatingRecipe: boolean;
  selectedIdeaTitle: string | null;
  loading: boolean;
  maxIdeaCount: number;
  onSelectIdea: (idea: RecipeIdea) => void;
  onGenerateMoreIdeas: () => void;
};

export function RecipeIdeasPanel({
  ideas,
  generatingRecipe,
  selectedIdeaTitle,
  loading,
  maxIdeaCount,
  onSelectIdea,
  onGenerateMoreIdeas,
}: RecipeIdeasPanelProps) {
  if (ideas.length === 0) {
    return null;
  }

  const compactDescription = (description: string) => {
    const normalized = description.trim().replace(/\s+/g, " ");
    if (normalized.length <= 165) {
      return normalized;
    }
    const truncated = normalized.slice(0, 162).trimEnd();
    return `${truncated}...`;
  };

  return (
    <section className="app-panel p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="app-kicker">Directions to explore</p>
          <h2 className="mt-2 font-display text-[36px] font-semibold tracking-tight text-[color:var(--text)]">Recipe ideas worth developing</h2>
        </div>
      </div>
      {generatingRecipe ? (
        <div className="mb-5 mt-5 rounded-[22px] border border-[rgba(111,135,103,0.18)] bg-[rgba(111,135,103,0.1)] p-4 text-center text-[color:#35513a]">
          <p className="font-semibold">Building a full recipe from this direction</p>
          <p className="text-sm">Please wait</p>
          {selectedIdeaTitle ? <p className="mt-1 text-xs text-[color:#35513a]">Selected: {selectedIdeaTitle}</p> : null}
        </div>
      ) : null}
      <div className="mt-5 space-y-4">
        {ideas.map((idea, index) => (
          <button
            key={idea.title}
            type="button"
            onClick={() => onSelectIdea(idea)}
            disabled={loading}
            className="flex cursor-pointer items-start gap-3 rounded-[24px] border border-[rgba(79,54,33,0.08)] bg-[rgba(255,252,246,0.86)] p-4 text-left transition hover:-translate-y-px hover:shadow-[0_14px_30px_rgba(76,50,24,0.08)] disabled:cursor-not-allowed disabled:opacity-60 sm:gap-4 sm:p-5"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg ${getIconTone(idea)} sm:h-12 sm:w-12 sm:text-xl`}
              aria-hidden="true"
            >
              {getIdeaIcon(idea, index)}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-[18px] font-semibold text-[color:var(--text)]">{idea.title}</p>
              <p className="text-[15px] leading-6 text-[color:var(--muted)] sm:text-[16px] sm:leading-7">
                <span className="sm:hidden">{compactDescription(idea.description)}</span>
                <span className="hidden sm:inline">{idea.description}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {getIdeaTags(idea)
                  .slice(0, 2)
                  .map((tag) => (
                  <span
                    key={`${idea.title}-${tag}`}
                    className="rounded-full bg-[rgba(111,102,95,0.08)] px-2.5 py-1 text-xs font-medium text-[color:var(--muted)]"
                  >
                    {tag}
                  </span>
                  ))}
              </div>
            </div>
          </button>
        ))}
      </div>
      {ideas.length < maxIdeaCount ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={onGenerateMoreIdeas}
            disabled={loading}
            className="ui-btn ui-btn-light disabled:cursor-not-allowed disabled:opacity-60"
          >
            Show Another Direction
          </button>
        </div>
      ) : null}
    </section>
  );
}
