"use client";

import Image from "next/image";
import { useState } from "react";
import { PhotoGallery } from "@/components/PhotoGallery";
import { PhotoUpload } from "@/components/PhotoUpload";
import { Button } from "@/components/Button";
import { ServingsControl } from "@/components/ServingsControl";
import { versionLabel, type IngredientItem, type RecipeRow, type StepItem, type VersionRow } from "@/components/recipes/version-detail/types";

export function VersionMainPanels({
  recipe,
  version,
  ingredients,
  displayServings,
  canAdjustServings,
  onSetTargetServings,
  steps,
  topPhotoUrl,
  userId,
  onShare,
  onViewVersionHistory,
  photosWithUrls,
  galleryLoading,
}: {
  recipe: RecipeRow;
  version: VersionRow;
  ingredients: IngredientItem[];
  displayServings: number;
  canAdjustServings: boolean;
  onSetTargetServings: (value: number) => void;
  steps: StepItem[];
  topPhotoUrl: string | null;
  userId: string | null;
  onShare: () => void;
  onViewVersionHistory: () => void;
  photosWithUrls: Array<{ id: string; signedUrl: string; storagePath: string }>;
  galleryLoading: boolean;
}) {
  return (
    <section className="space-y-5">
      <section className="app-panel overflow-hidden">
        {topPhotoUrl ? (
          <div className="h-56 overflow-hidden border-b border-[rgba(57,75,70,0.08)] sm:h-64 lg:h-80">
            <Image src={topPhotoUrl} alt={`${recipe.title} recipe`} width={1280} height={720} unoptimized className="h-full w-full object-cover object-center" />
          </div>
        ) : (
          <div className="h-56 bg-gradient-to-br from-[#dce7e3] to-[#eaf1f4] sm:h-64 lg:h-80" />
        )}

        <div className="space-y-4 p-4 sm:p-6 lg:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="app-kicker">Current version</p>
              <h1 className="mt-3 text-[24px] font-semibold leading-[1.02] tracking-tight text-[color:var(--text)] min-[380px]:text-[28px] sm:text-[42px]">{recipe.title}</h1>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-[rgba(79,125,115,0.12)] px-3 py-1.5 text-sm font-semibold text-[color:var(--primary)]">
                  {versionLabel(version)}
                </span>
                <span className="rounded-full bg-[rgba(201,123,66,0.1)] px-3 py-1.5 text-sm font-semibold text-[color:var(--text)]">
                  Saved {new Date(version.created_at).toLocaleDateString()}
                </span>
                <span className="rounded-full bg-[rgba(57,75,70,0.06)] px-3 py-1.5 text-sm font-semibold text-[color:var(--text)]">
                  Serves {typeof version.servings === "number" ? displayServings : "-"}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 lg:flex lg:flex-wrap">
              <Button href={`/recipes/${recipe.id}/versions/${version.id}/cook`} className="w-full justify-center lg:w-auto">
                Cook This Version
              </Button>
              <Button href={`/recipes/${recipe.id}/versions/${version.id}/grocery`} variant="secondary" className="w-full justify-center lg:w-auto">
                Shopping List
              </Button>
              <Button href={`/planner?version=${version.id}`} variant="secondary" className="w-full justify-center lg:w-auto">
                Add to Plan
              </Button>
              <Button href={`/recipes/${recipe.id}/versions/new`} variant="secondary" className="w-full justify-center lg:w-auto">
                Develop New Version
              </Button>
              <Button onClick={onShare} variant="secondary" className="w-full justify-center lg:w-auto">
                Share
              </Button>
              <Button onClick={onViewVersionHistory} variant="secondary" className="w-full justify-center lg:w-auto">
                View Version History
              </Button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_240px]">
            <div className="rounded-[24px] bg-[rgba(201,123,66,0.08)] p-4 sm:p-5">
              <p className="app-kicker">Change notes</p>
              <p className="mt-3 text-[15px] leading-7 text-[color:var(--muted)]">
                {version.change_summary?.trim().length ? version.change_summary : "No changes yet. This is the original recipe."}
              </p>
            </div>
            <div className="rounded-[24px] border border-[rgba(57,75,70,0.08)] bg-white/80 p-4 sm:p-5">
              <p className="app-kicker">Version frame</p>
              <div className="mt-3 space-y-3 text-sm text-[color:var(--text)]">
                <div>
                  <p className="text-[color:var(--muted)]">Recipe</p>
                  <p className="mt-1 font-semibold">{recipe.title}</p>
                </div>
                <div>
                  <p className="text-[color:var(--muted)]">Stage</p>
                  <p className="mt-1 font-semibold">{version.version_number === 1 ? "Foundational version" : `Iteration ${version.version_number}`}</p>
                </div>
                <div>
                  <p className="text-[color:var(--muted)]">Intent</p>
                  <p className="mt-1 font-semibold">{version.version_label?.trim() || "Original build"}</p>
                </div>
              </div>
            </div>
          </div>

          <ServingsControl
            label="Cook for"
            baseServings={canAdjustServings ? version.servings : null}
            targetServings={displayServings}
            onChange={onSetTargetServings}
          />
        </div>
      </section>

      <IngredientList ingredients={ingredients} />

      <section className="app-panel p-4 sm:p-6">
        <h2 className="text-[22px] font-semibold tracking-tight text-[color:var(--text)] sm:text-[30px]">Cooking Steps</h2>
        <div className="mt-4 flex flex-col gap-3">
          {steps.map((step, index) => (
            <div key={`${step.text}-${index}`} className="flex gap-3 rounded-[22px] bg-[rgba(141,169,187,0.06)] p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] text-[15px] font-semibold text-white">
                {index + 1}
              </div>
              <p className="text-[15px] leading-7 text-[color:var(--text)]">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="app-panel p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="app-kicker">Photos</p>
            <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-[color:var(--text)] sm:text-[30px]">Cookbook gallery</h2>
          </div>
          <div>{userId ? <PhotoUpload recipeId={recipe.id} userId={userId} versionId={version.id} compact /> : null}</div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {galleryLoading ? <p className="text-sm text-[color:var(--muted)]">Loading photos...</p> : null}
          <PhotoGallery recipeId={recipe.id} versionId={version.id} photos={photosWithUrls} />
        </div>
      </section>
    </section>
  );
}

function IngredientList({ ingredients }: { ingredients: IngredientItem[] }) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  function toggle(index: number) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <section className="app-panel p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[22px] font-semibold tracking-tight text-[color:var(--text)] sm:text-[30px]">Ingredients</h2>
        {checked.size > 0 ? (
          <button
            type="button"
            onClick={() => setChecked(new Set())}
            className="text-[13px] font-semibold text-[color:var(--muted)] hover:text-[color:var(--text)]"
          >
            Clear ({checked.size})
          </button>
        ) : null}
      </div>
      <ul className="mt-4 flex flex-col gap-3">
        {ingredients.map((ingredient, index) => {
          const isChecked = checked.has(index);
          return (
            <li key={`${ingredient.name}-${index}`}>
              <button
                type="button"
                onClick={() => toggle(index)}
                className={`flex w-full items-start gap-3 rounded-[20px] p-4 text-left text-[15px] leading-7 transition ${
                  isChecked
                    ? "bg-[rgba(142,168,141,0.15)] text-[color:var(--muted)] line-through"
                    : "bg-[rgba(141,169,187,0.06)] text-[color:var(--text)] hover:bg-[rgba(141,169,187,0.12)]"
                }`}
              >
                <span
                  className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                    isChecked
                      ? "border-[color:var(--primary)] bg-[color:var(--primary)]"
                      : "border-[rgba(57,75,70,0.2)] bg-white"
                  }`}
                >
                  {isChecked ? (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </span>
                <span>{ingredient.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
