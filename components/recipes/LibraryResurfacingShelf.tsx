// components/recipes/LibraryResurfacingShelf.tsx
"use client";

import Link from "next/link";
import type { ResurfacingData, ResurfacingSuggestion } from "@/lib/recipes/resurfacingData";

const OUTCOME_BADGE: Record<string, string> = {
  great: "Loved it",
  good_with_changes: "Good with tweaks",
  disappointing: "Needs work",
  failed: "Needs rethinking",
};

function ShelfItem({ item }: { item: ResurfacingSuggestion }) {
  const badge = OUTCOME_BADGE[item.outcome] ?? item.outcome;
  const href = `/recipes/${item.recipeId}/versions/${item.versionId}`;
  return (
    <Link
      href={href}
      className="flex min-w-[180px] max-w-[220px] flex-shrink-0 flex-col gap-1.5 rounded-[16px] border border-[rgba(79,54,33,0.1)] bg-white p-3.5 transition hover:shadow-sm"
    >
      <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-[color:var(--text)]">
        {item.title}
      </p>
      <span className="self-start rounded-full bg-[rgba(201,123,66,0.1)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--primary)]">
        {badge}
      </span>
    </Link>
  );
}

export function LibraryResurfacingShelf({ data }: { data: ResurfacingData }) {
  const hasWorth = data.worthRepeating.length > 0;
  const hasNeeds = data.needsImprovement.length > 0;

  if (!hasWorth && !hasNeeds) return null;

  return (
    <div className="space-y-4">
      {hasWorth && (
        <div>
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
            Worth making again
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {data.worthRepeating.map((item) => (
              <ShelfItem key={`${item.recipeId}-${item.versionId}`} item={item} />
            ))}
          </div>
        </div>
      )}
      {hasNeeds && (
        <div>
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted)]">
            Could use another pass
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {data.needsImprovement.map((item) => (
              <ShelfItem key={`${item.recipeId}-${item.versionId}`} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
