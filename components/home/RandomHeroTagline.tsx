"use client";

import { useEffect, useState } from "react";

const TAGLINES = [
  { id: "talk-your-way", copy: "Talk your way to a better meal." },
  { id: "create-smarter", copy: "Create smarter meals with Max." },
  { id: "craving-to-recipe", copy: "From craving to recipe, with Max." },
] as const;

export function RandomHeroTagline() {
  const [selection, setSelection] = useState<(typeof TAGLINES)[number]>(TAGLINES[0]);

  useEffect(() => {
    setSelection(TAGLINES[Math.floor(Math.random() * TAGLINES.length)] ?? TAGLINES[0]);
  }, []);

  return (
    <div className="space-y-4" data-tagline-id={selection.id}>
      <h1 className="max-w-[11ch] font-display text-[34px] font-semibold leading-[0.9] tracking-[-0.04em] text-[color:var(--landing-ink)] sm:text-[54px] lg:text-[92px]">
        {selection.copy}
      </h1>
      <p className="max-w-2xl text-[16px] leading-7 text-[color:var(--landing-muted)] sm:text-[19px] sm:leading-8">
        Start with a craving, ingredient, or constraint.{" "}
        <span className="font-semibold text-[color:var(--landing-ink)]">Max</span>{" "}
        helps you shape the dish, build the recipe, plan your week, and generate the shopping list.
      </p>
    </div>
  );
}
