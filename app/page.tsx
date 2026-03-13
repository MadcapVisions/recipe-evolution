import Link from "next/link";

const features = [
  {
    title: "Generate Recipes",
    description: "Turn ingredients or cravings into full recipes.",
  },
  {
    title: "Improve Recipes",
    description: "Upgrade any recipe with AI suggestions.",
  },
  {
    title: "Cook Smarter",
    description: "Use AI like a sous chef while cooking.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-[1320px] space-y-8">
      <section className="app-panel overflow-hidden">
        <div className="grid gap-8 bg-[linear-gradient(135deg,rgba(141,169,187,0.14)_0%,rgba(142,168,141,0.12)_45%,rgba(255,255,255,0.4)_100%)] p-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] lg:p-10">
          <div className="space-y-5">
            <p className="app-kicker">Recipe Evolution</p>
            <h1 className="font-display text-[48px] font-semibold leading-[0.98] tracking-tight text-[color:var(--text)] sm:text-[62px]">
              AI Sous Chef for Home Cooking
            </h1>
            <p className="max-w-2xl text-[20px] leading-9 text-[color:var(--muted)]">
              Turn ingredients into amazing meals with AI.
            </p>
            <div className="pt-2">
              <Link
                href="/dashboard"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--primary)_0%,var(--accent)_100%)] px-6 py-3 text-[16px] font-semibold text-white shadow-[0_18px_30px_rgba(82,124,116,0.18)] transition hover:brightness-[1.03]"
              >
                Start Cooking
              </Link>
            </div>
          </div>

          <div className="rounded-[30px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.82)] p-5 shadow-[0_18px_40px_rgba(52,70,63,0.08)] backdrop-blur-sm">
            <div className="rounded-[26px] border border-[rgba(57,75,70,0.08)] bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="app-kicker">Sample workflow</p>
                  <p className="mt-2 text-[24px] font-semibold text-[color:var(--text)]">Plan dinner in minutes.</p>
                </div>
                <div className="rounded-full bg-[linear-gradient(135deg,rgba(223,247,235,0.95)_0%,rgba(245,252,248,0.98)_100%)] px-3 py-1.5 text-sm font-semibold text-emerald-950 shadow-[0_10px_24px_rgba(46,125,94,0.1)]">
                  AI Chef Ready
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <div className="rounded-[22px] bg-[rgba(141,169,187,0.08)] p-4 text-[15px] leading-7 text-[color:var(--text)]">
                  “I have chicken, lemon, garlic, and pasta. What should I make?”
                </div>
                <div className="rounded-[22px] bg-[rgba(142,168,141,0.08)] p-4 text-[15px] leading-7 text-[color:var(--text)]">
                  Chef AI suggests a bright, weeknight-friendly creamy lemon chicken pasta and can adjust it for protein, time, or spice.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {features.map((feature, index) => (
          <article key={feature.title} className="app-panel p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(141,169,187,0.1)] text-[18px] font-semibold text-[color:var(--primary)]">
              {index + 1}
            </div>
            <h2 className="mt-5 text-[28px] font-semibold tracking-tight text-[color:var(--text)]">{feature.title}</h2>
            <p className="mt-3 text-[16px] leading-7 text-[color:var(--muted)]">{feature.description}</p>
          </article>
        ))}
      </section>

      <section className="app-panel p-6 lg:p-8">
        <div className="mb-5">
          <p className="app-kicker">Dashboard preview</p>
          <h2 className="mt-2 text-[38px] font-semibold tracking-tight text-[color:var(--text)]">See the kitchen hub.</h2>
        </div>

        <div className="overflow-hidden rounded-[30px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.84)] shadow-[0_18px_40px_rgba(52,70,63,0.08)]">
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.45fr)_320px]">
            <div className="rounded-[28px] border border-[rgba(57,75,70,0.08)] bg-[linear-gradient(135deg,rgba(141,169,187,0.16)_0%,rgba(142,168,141,0.14)_50%,rgba(255,255,255,0.8)_100%)] p-6">
              <p className="app-kicker">Dashboard hero</p>
              <h3 className="mt-3 text-[40px] font-semibold leading-[1.02] tracking-tight text-[color:var(--text)]">What do you want to cook today?</h3>
              <p className="mt-3 max-w-xl text-[17px] leading-8 text-[color:var(--muted)]">
                Describe the dish, ingredients, or constraint. Then refine it with Chef AI before turning it into a recipe.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {["30-minute high-protein dinner", "Something fresh with chicken", "Easy comfort food"].map((chip) => (
                  <span key={chip} className="app-chip border border-[rgba(57,75,70,0.08)] bg-white">
                    {chip}
                  </span>
                ))}
              </div>
              <div className="mt-6 rounded-[26px] border border-[rgba(57,75,70,0.08)] bg-white p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="app-kicker">Chef conversation</p>
                    <p className="mt-2 text-[18px] font-semibold text-[color:var(--text)]">First action: tell Chef what you want.</p>
                  </div>
                </div>
                <div className="mt-4 rounded-[22px] bg-[rgba(141,169,187,0.08)] p-4 text-[15px] leading-7 text-[color:var(--muted)]">
                  Ask for substitutions, technique advice, or ingredient combinations before you commit.
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-[rgba(57,75,70,0.08)] bg-white p-5">
              <p className="app-kicker">Meal builder</p>
              <h3 className="mt-3 text-[28px] font-semibold tracking-tight text-[color:var(--text)]">Build from a few decisions.</h3>
              <div className="mt-5 space-y-4">
                <div>
                  <p className="mb-2 text-[15px] font-semibold text-[color:var(--text)]">Protein</p>
                  <div className="flex flex-wrap gap-2">
                    {["Chicken", "Fish", "Tofu"].map((chip) => (
                      <span key={chip} className="app-chip border border-[rgba(57,75,70,0.08)] bg-[rgba(141,169,187,0.08)]">
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[15px] font-semibold text-[color:var(--text)]">Cook Time</p>
                  <div className="flex flex-wrap gap-2">
                    {["15 min", "30 min", "45 min"].map((chip) => (
                      <span key={chip} className="app-chip border border-[rgba(57,75,70,0.08)] bg-[rgba(141,169,187,0.08)]">
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-full bg-[linear-gradient(135deg,var(--primary)_0%,var(--accent)_100%)] px-4 py-3 text-center text-[16px] font-semibold text-white">
                  Generate Recipes
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="app-panel p-8 text-center">
        <p className="app-kicker">Get started</p>
        <h2 className="mt-3 text-[42px] font-semibold tracking-tight text-[color:var(--text)]">Ready to cook?</h2>
        <div className="mt-5">
          <Link
            href="/dashboard"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--primary)_0%,var(--accent)_100%)] px-6 py-3 text-[16px] font-semibold text-white shadow-[0_18px_30px_rgba(82,124,116,0.18)] transition hover:brightness-[1.03]"
          >
            Start Cooking
          </Link>
        </div>
      </section>
    </div>
  );
}
