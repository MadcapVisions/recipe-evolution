import Link from "next/link";

const freeFeatures = [
  "Chef guidance with a limited monthly usage cap",
  "Constraint-based dish directions and refinement",
  "Cookbook with favorites, hide, and archive controls",
  "Save recipes with version history",
  "Import recipes from pasted text",
  "Taste profile and personal cooking preferences",
  "Deterministic backup recipe engine when AI is unavailable",
];

const proFeatures = [
  "Higher Chef usage limits for regular cooking and planning",
  "Unlimited recipe versions, refinements, and remix flows",
  "Advanced recipe development actions like faster, spicier, or vegetarian",
  "Live cooking mode with step-by-step recipe flow",
  "Grocery list workflow and pantry-aware planning",
  "More personalized guidance from your taste profile and behavior",
  "Priority access to new planning, billing, and support tools",
];

const comparisonRows = [
  { label: "Guided recipe development", free: "Limited", pro: "Expanded" },
  { label: "Cookbook", free: "Core access", pro: "Full access" },
  { label: "Recipe versions", free: "Included", pro: "Unlimited" },
  { label: "Smart meal builder", free: "Included", pro: "Included" },
  { label: "Recipe import", free: "Included", pro: "Included" },
  { label: "Cooking mode", free: "Included", pro: "Included" },
  { label: "Taste-based personalization", free: "Included", pro: "Deeper personalization" },
  { label: "Fallback recipe engine", free: "Included", pro: "Included" },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-[1320px] space-y-8">
      <section className="app-panel overflow-hidden">
        <div className="grid gap-8 bg-[radial-gradient(circle_at_top_left,rgba(210,76,47,0.1),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(242,185,75,0.12),transparent_24%),linear-gradient(180deg,rgba(255,251,246,0.98)_0%,rgba(255,245,236,0.94)_100%)] p-5 sm:p-8 lg:grid-cols-[minmax(0,1.15fr)_360px] lg:p-10">
          <div className="space-y-5">
            <p className="app-kicker">Pricing</p>
            <h1 className="font-display text-[28px] font-semibold leading-[0.98] tracking-tight text-[color:var(--text)] sm:text-[46px]">
              Choose the plan that fits how seriously you develop recipes.
            </h1>
            <p className="max-w-3xl text-[16px] leading-7 text-[color:var(--muted)] sm:text-[19px] sm:leading-8">
              Start with a limited free tier, then upgrade when you want more guided refinement, deeper recipe evolution, and more room to build a cookbook around your real cooking habits.
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="app-chip border border-[rgba(57,75,70,0.08)] bg-white">Limited free tier</span>
              <span className="app-chip border border-[rgba(57,75,70,0.08)] bg-white">Taste-aware Chef guidance</span>
              <span className="app-chip border border-[rgba(57,75,70,0.08)] bg-white">Version-based workflow</span>
            </div>
          </div>

          <div className="rounded-[30px] border border-[rgba(142,84,60,0.1)] bg-[rgba(255,251,246,0.9)] p-5 shadow-[0_18px_40px_rgba(101,47,29,0.08)] backdrop-blur-sm">
            <p className="app-kicker">What you already get</p>
            <div className="mt-4 space-y-3">
              {[
                "Guided dish development",
                "Recipe import and version history",
                "Favorites, organization, and cooking mode",
                "Taste profile memory and personalization",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[22px] border border-[rgba(142,84,60,0.1)] bg-[rgba(255,255,255,0.92)] px-4 py-3 text-[15px] font-medium text-[color:var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="app-panel p-6 lg:p-8">
          <div className="space-y-3">
            <p className="app-kicker">Starter</p>
            <h2 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] sm:text-[38px]">Free</h2>
            <p className="text-[16px] leading-7 text-[color:var(--muted)]">
              A limited free tier for trying the workflow, saving recipes, and building the foundation of your cookbook without committing up front.
            </p>
          </div>

          <div className="mt-6 rounded-[24px] border border-[rgba(142,84,60,0.08)] bg-[rgba(210,76,47,0.06)] p-5">
            <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Best for</p>
            <p className="mt-2 text-[16px] font-semibold text-[color:var(--text)] sm:text-[18px]">Trying the workflow and building the first shelf of your cookbook</p>
          </div>

          <ul className="mt-6 space-y-3">
            {freeFeatures.map((feature) => (
              <li key={feature} className="flex gap-3 text-[15px] leading-7 text-[color:var(--text)] sm:text-[17px]">
                <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[color:var(--accent)]" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <Link
              href="/sign-up"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-[rgba(57,75,70,0.12)] bg-[rgba(255,252,246,0.96)] px-6 py-3 text-[16px] font-semibold text-[color:var(--text)] shadow-[0_14px_28px_rgba(76,50,24,0.1)] transition hover:bg-white"
            >
              Start free
            </Link>
          </div>
        </article>

        <article className="app-panel relative overflow-hidden p-6 lg:p-8">
          <div className="absolute right-6 top-6 rounded-full bg-[color:var(--primary)] px-4 py-2 text-[14px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_20px_rgba(182,63,41,0.2)]">
            Best value
          </div>

          <div className="space-y-3">
            <p className="app-kicker">Recipe Evolution Pro</p>
            <div className="flex flex-wrap items-end gap-3">
              <h2 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] sm:text-[38px]">$49.99/year</h2>
              <p className="pb-1 text-[15px] font-medium text-[color:var(--muted)] sm:text-[18px]">$4.17/month billed annually</p>
            </div>
            <p className="text-[16px] leading-7 text-[color:var(--muted)]">
              For cooks who want Chef available more often, deeper personalization, and more room to evolve recipes into repeatable standards.
            </p>
          </div>

          <div className="mt-6 rounded-[24px] border border-[rgba(142,84,60,0.08)] bg-[rgba(242,185,75,0.12)] p-5">
            <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Best for</p>
            <p className="mt-2 text-[16px] font-semibold text-[color:var(--text)] sm:text-[18px]">Frequent cooking, active recipe development, and long-term kitchen planning</p>
          </div>

          <ul className="mt-6 space-y-3">
            {proFeatures.map((feature) => (
              <li key={feature} className="flex gap-3 text-[15px] leading-7 text-[color:var(--text)] sm:text-[17px]">
                <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[color:var(--primary)]" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <Link
              href="/sign-up"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[color:var(--primary)] px-6 py-3 text-[16px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_20px_rgba(182,63,41,0.18)] transition hover:bg-[color:var(--primary-strong)]"
            >
              Choose Pro
            </Link>
          </div>
        </article>
      </section>

      <section className="app-panel p-6 lg:p-8">
        <div className="space-y-2">
          <p className="app-kicker">Feature comparison</p>
          <h2 className="text-[22px] font-semibold tracking-tight text-[color:var(--text)] sm:text-[36px]">What changes as you upgrade</h2>
        </div>

        <div className="mt-6 space-y-3 md:hidden">
          {comparisonRows.map((row) => (
            <article
              key={row.label}
              className="rounded-[24px] border border-[rgba(142,84,60,0.1)] bg-[rgba(255,253,249,0.9)] p-4"
            >
              <p className="text-[15px] font-semibold leading-7 text-[color:var(--text)] sm:text-[17px]">{row.label}</p>
              <div className="mt-3 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
                <div className="rounded-[18px] border border-[rgba(142,84,60,0.08)] bg-[rgba(210,76,47,0.05)] px-3 py-3">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Free</p>
                  <p className="mt-2 text-[15px] leading-6 text-[color:var(--text)]">{row.free}</p>
                </div>
                <div className="rounded-[18px] border border-[rgba(142,84,60,0.08)] bg-[rgba(242,185,75,0.12)] px-3 py-3">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Pro</p>
                  <p className="mt-2 text-[15px] font-semibold leading-6 text-[color:var(--primary)]">{row.pro}</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-6 hidden overflow-hidden rounded-[26px] border border-[rgba(142,84,60,0.1)] bg-[rgba(255,253,249,0.9)] md:block">
          <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(140px,0.7fr)_minmax(140px,0.7fr)] border-b border-[rgba(142,84,60,0.1)] bg-[rgba(210,76,47,0.06)] px-5 py-4 text-[15px] font-semibold text-[color:var(--text)]">
            <div>Capability</div>
            <div>Free</div>
            <div>Pro</div>
          </div>
          {comparisonRows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[minmax(0,1.3fr)_minmax(140px,0.7fr)_minmax(140px,0.7fr)] border-b border-[rgba(142,84,60,0.1)] px-5 py-4 text-[15px] leading-7 text-[color:var(--text)] last:border-b-0"
            >
              <div className="font-medium">{row.label}</div>
              <div className="text-[color:var(--muted)]">{row.free}</div>
              <div className="font-semibold text-[color:var(--primary)]">{row.pro}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="app-panel p-5 text-center sm:p-8">
        <p className="app-kicker">Start now</p>
        <h2 className="mt-3 text-[24px] font-semibold tracking-tight text-[color:var(--text)] sm:text-[42px]">Start free, upgrade when recipe development becomes part of how you cook.</h2>
        <p className="mx-auto mt-4 max-w-3xl text-[16px] leading-7 text-[color:var(--muted)] sm:text-[18px] sm:leading-8">
          The free tier gets you into the workflow. Pro is there when you want more guidance, more recipe evolution, and a stronger personal cooking system.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/sign-up"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[color:var(--primary)] px-6 py-3 text-[16px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_20px_rgba(182,63,41,0.18)] transition hover:bg-[color:var(--primary-strong)]"
          >
            Create account
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-[rgba(57,75,70,0.12)] bg-[rgba(255,252,246,0.96)] px-6 py-3 text-[16px] font-semibold text-[color:var(--text)] shadow-[0_14px_28px_rgba(76,50,24,0.1)] transition hover:bg-white"
          >
            See how it works
          </Link>
        </div>
      </section>
    </div>
  );
}
