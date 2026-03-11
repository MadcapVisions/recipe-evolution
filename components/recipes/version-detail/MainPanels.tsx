"use client";

import Image from "next/image";
import { PhotoGallery } from "@/components/PhotoGallery";
import { PhotoUpload } from "@/components/PhotoUpload";
import { Button } from "@/components/Button";
import { versionLabel, type IngredientItem, type RecipeRow, type StepItem, type VersionRow } from "@/components/recipes/version-detail/types";

export function VersionMainPanels({
  recipe,
  version,
  ingredients,
  steps,
  topPhotoUrl,
  userId,
  onShare,
  photosWithUrls,
}: {
  recipe: RecipeRow;
  version: VersionRow;
  ingredients: IngredientItem[];
  steps: StepItem[];
  topPhotoUrl: string | null;
  userId: string | null;
  onShare: () => void;
  photosWithUrls: Array<{ id: string; signedUrl: string; storagePath: string }>;
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
              <h1 className="mt-3 text-[42px] font-semibold leading-[1.02] tracking-tight text-[color:var(--text)]">{recipe.title}</h1>
              <p className="mt-3 text-[16px] text-[color:var(--muted)]">{versionLabel(version)}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button href={`/recipes/${recipe.id}/versions/${version.id}/cook`}>Start Cooking</Button>
              <Button href={`/recipes/${recipe.id}/versions/new`} variant="secondary">
                Edit
              </Button>
              <Button onClick={onShare} variant="secondary">
                Share
              </Button>
              <Button href={`/recipes/${recipe.id}`} variant="secondary">
                More
              </Button>
            </div>
          </div>

          <div className="rounded-[26px] bg-[rgba(141,169,187,0.08)] p-5">
            <p className="app-kicker">What changed</p>
            <p className="mt-3 text-[16px] leading-8 text-[color:var(--muted)]">
              {version.change_summary?.trim().length ? version.change_summary : "No changes yet. This is the original recipe."}
            </p>
          </div>
        </div>
      </section>

      <section className="app-panel p-6">
        <h2 className="text-[30px] font-semibold tracking-tight text-[color:var(--text)]">Ingredients</h2>
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
        <h2 className="text-[30px] font-semibold tracking-tight text-[color:var(--text)]">Cooking Steps</h2>
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
            <h2 className="mt-2 text-[30px] font-semibold tracking-tight text-[color:var(--text)]">Cookbook gallery</h2>
          </div>
          <div>{userId ? <PhotoUpload userId={userId} versionId={version.id} compact /> : null}</div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <PhotoGallery photos={photosWithUrls} />
        </div>
      </section>
    </section>
  );
}
