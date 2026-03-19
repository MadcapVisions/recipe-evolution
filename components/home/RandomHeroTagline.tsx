"use client";

import { useState } from "react";

const TAGLINES = [
  { id: "dinner-decided", copy: "Dinner, Decided." },
  { id: "turn-what-you-have", copy: "Turn What You Have Into Something Great." },
  { id: "stop-guessing", copy: "Stop Guessing What To Cook." },
] as const;

export function RandomHeroTagline() {
  const [selection] = useState(() => TAGLINES[Math.floor(Math.random() * TAGLINES.length)] ?? TAGLINES[0]);

  return (
    <div className="space-y-4" data-tagline-id={selection.id}>
      <h1 className="max-w-[11ch] font-display text-[54px] font-semibold leading-[0.9] tracking-[-0.04em] text-[color:var(--landing-ink)] sm:text-[72px] lg:text-[92px]">
        {selection.copy}
      </h1>
      <p className="max-w-2xl text-[19px] leading-8 text-[color:var(--landing-muted)] sm:text-[21px]">
        AIcook turns the ingredients you already have into personalized meal ideas, step-by-step recipes, and dinner plans
        you will actually want to make.
      </p>
    </div>
  );
}
