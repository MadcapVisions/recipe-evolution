"use client";

import Image from "next/image";
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
  photosWithUrls: Array<{ id: string; signedUrl: string; storagePath: string }>;
  galleryLoading: boolean;
}) {
  return (
    <section className="space-y-5">
      <section className="app-panel overflow-hidden">
        {topPhotoUrl ? (
          <div className="h-64 overflow-hidden border-b border-[rgba(57,75,70,0.08)] lg:h-80">
            <Image src={topPhotoUrl} alt={`${recipe.title} recipe`} width={1280} height={720} unoptimized className="h-full w-full object-cover object-center" />
          </div>
        ) : (
          <div className="h-64 bg-gradient-to-br from-[#dce7e3] to-[#eaf1f4] lg:h-80" />
        )}

        <div className="space-y-5 p-6 lg:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="app-kicker">Recipe detail</p>
              <h1 className="mt-3 text-[32px] font-semibold leading-[1.02] tracking-tight text-[color:var(--text)] sm:text-[42px]">{recipe.title}</h1>
              <p className="mt-3 text-[16px] text-[color:var(--muted)]">{versionLabel(version)}</p>
              <p className="mt-1 text-[16px] text-[color:var(--muted)]">
                Serves {typeof version.servings === "number" ? displayServings : "-"}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
              <Button href={`/recipes/${recipe.id}/versions/${version.id}/cook`}>Start Cooking</Button>
              <Button href={`/recipes/${recipe.id}/versions/${version.id}/grocery`} variant="secondary">
                Shopping List
              </Button>
              <Button href={`/planner?version=${version.id}`} variant="secondary">
                Add to Plan
              </Button>
              <Button href={`/recipes/${recipe.id}/versions/new`} variant="secondary">
                Create New Version
              </Button>
              <Button onClick={onShare} variant="secondary">
                Share
              </Button>
              <Button href={`/recipes/${recipe.id}`} variant="secondary">
                View Recipe History
              </Button>
            </div>
          </div>

          <div className="rounded-[26px] bg-[rgba(141,169,187,0.08)] p-5">
            <p className="app-kicker">What changed</p>
            <p className="mt-3 text-[16px] leading-8 text-[color:var(--muted)]">
              {version.change_summary?.trim().length ? version.change_summary : "No changes yet. This is the original recipe."}
            </p>
          </div>

          <ServingsControl
            label="Cook for"
            baseServings={canAdjustServings ? version.servings : null}
            targetServings={displayServings}
            onChange={onSetTargetServings}
          />
        </div>
      </section>

      <section className="app-panel p-6">
        <h2 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] sm:text-[30px]">Ingredients</h2>
        <ul className="mt-5 flex flex-col gap-3">
          {ingredients.map((ingredient, index) => (
            <li key={`${ingredient.name}-${index}`} className="flex items-start gap-4 rounded-[22px] bg-[rgba(141,169,187,0.06)] p-4 text-[16px] leading-7 text-[color:var(--text)]">
              <input type="checkbox" className="mt-1.5 h-5 w-5 rounded-full" />
              <span>{ingredient.name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="app-panel p-6">
        <h2 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] sm:text-[30px]">Cooking Steps</h2>
        <div className="mt-5 flex flex-col gap-4">
          {steps.map((step, index) => (
            <div key={`${step.text}-${index}`} className="flex gap-4 rounded-[24px] bg-[rgba(141,169,187,0.06)] p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] text-[16px] font-semibold text-white">
                {index + 1}
              </div>
              <p className="text-[16px] leading-8 text-[color:var(--text)]">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="app-panel p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="app-kicker">Photos</p>
            <h2 className="mt-2 text-[26px] font-semibold tracking-tight text-[color:var(--text)] sm:text-[30px]">Cookbook gallery</h2>
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
