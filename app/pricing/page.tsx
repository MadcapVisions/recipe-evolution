import Link from "next/link";

const freeFeatures = [
  "AI Chef guidance with a limited monthly usage cap",
  "Smart meal builder and guided recipe directions",
  "Recipe library with favorites, hide, and archive controls",
  "Create and save recipe versions",
  "Import recipes from pasted text",
  "Taste profile and personal cooking preferences",
  "Deterministic backup recipe engine when AI is unavailable",
];

const proFeatures = [
  "Higher AI generation limits for daily cooking and planning",
  "Unlimited recipe versions, refinements, and remix flows",
  "Advanced recipe improvement actions like faster, spicier, or vegetarian",
  "Live cooking mode with step-by-step recipe flow",
  "Grocery list workflow and pantry-aware planning",
  "More personalized AI guidance from your taste profile and behavior",
  "Priority access to new planning, billing, and support tools",
];

const comparisonRows = [
  { label: "AI recipe generation", free: "Limited", pro: "Expanded" },
  { label: "Recipe library", free: "Core access", pro: "Full access" },
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
        <div className="grid gap-8 bg-[linear-gradient(135deg,rgba(141,169,187,0.14)_0%,rgba(142,168,141,0.12)_45%,rgba(255,255,255,0.45)_100%)] p-8 lg:grid-cols-[minmax(0,1.15fr)_360px] lg:p-10">
          <div className="space-y-5">
            <p className="app-kicker">Pricing</p>
            <h1 className="font-display text-[46px] font-semibold leading-[0.98] tracking-tight text-[color:var(--text)] sm:text-[60px]">
              Choose the plan that fits your kitchen.
            </h1>
            <p className="max-w-3xl text-[19px] leading-8 text-[color:var(--muted)]">
              Start with a limited free tier, then upgrade when you want more AI guidance, more recipe evolution, and more room to plan around your real cooking habits.
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="app-chip border border-[rgba(57,75,70,0.08)] bg-white">Limited free tier</span>
              <span className="app-chip border border-[rgba(57,75,70,0.08)] bg-white">Personalized AI chef</span>
              <span className="app-chip border border-[rgba(57,75,70,0.08)] bg-white">Built-in fallback engine</span>
            </div>
          </div>

          <div className="rounded-[30px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.82)] p-5 shadow-[0_18px_40px_rgba(52,70,63,0.08)] backdrop-blur-sm">
            <p className="app-kicker">What you already get</p>
            <div className="mt-4 space-y-3">
              {[
                "Guided AI recipe brainstorming",
                "Recipe import and version history",
                "Favorites, organization, and cooking mode",
                "Taste profile memory and personalization",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[22px] border border-[rgba(57,75,70,0.08)] bg-white px-4 py-3 text-[15px] font-medium text-[color:var(--text)]"
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
            <h2 className="text-[38px] font-semibold tracking-tight text-[color:var(--text)]">Free</h2>
            <p className="text-[16px] leading-7 text-[color:var(--muted)]">
              A limited free tier for trying the AI chef, building recipes, and organizing your kitchen without committing up front.
            </p>
          </div>

          <div className="mt-6 rounded-[24px] bg-[rgba(141,169,187,0.08)] p-5">
            <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Best for</p>
            <p className="mt-2 text-[18px] font-semibold text-[color:var(--text)]">Trying the workflow and building a personal recipe base</p>
          </div>

          <ul className="mt-6 space-y-3">
            {freeFeatures.map((feature) => (
              <li key={feature} className="flex gap-3 text-[17px] leading-7 text-[color:var(--text)]">
                <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[color:var(--secondary)]" />
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
          <div className="absolute right-6 top-6 rounded-full bg-[linear-gradient(135deg,var(--primary)_0%,var(--accent)_100%)] px-4 py-2 text-[14px] font-semibold text-white shadow-[0_16px_28px_rgba(82,124,116,0.22)]">
            Best value
          </div>

          <div className="space-y-3">
            <p className="app-kicker">Recipe Evolution Pro</p>
            <div className="flex flex-wrap items-end gap-3">
              <h2 className="text-[38px] font-semibold tracking-tight text-[color:var(--text)]">$49.99/year</h2>
              <p className="pb-1 text-[18px] font-medium text-[color:var(--muted)]">$4.17/month billed annually</p>
            </div>
            <p className="text-[16px] leading-7 text-[color:var(--muted)]">
              For cooks who want the AI chef available more often, deeper personalization, and more room to evolve recipes over time.
            </p>
          </div>

          <div className="mt-6 rounded-[24px] bg-[rgba(142,168,141,0.1)] p-5">
            <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Best for</p>
            <p className="mt-2 text-[18px] font-semibold text-[color:var(--text)]">Frequent cooking, more AI usage, and long-term kitchen planning</p>
          </div>

          <ul className="mt-6 space-y-3">
            {proFeatures.map((feature) => (
              <li key={feature} className="flex gap-3 text-[17px] leading-7 text-[color:var(--text)]">
                <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[color:var(--primary)]" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <Link
              href="/sign-up"
              className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--primary)_0%,var(--accent)_100%)] px-6 py-3 text-[16px] font-semibold text-white shadow-[0_18px_30px_rgba(82,124,116,0.18)] transition hover:brightness-[1.03]"
            >
              Choose Pro
            </Link>
          </div>
        </article>
      </section>

      <section className="app-panel p-6 lg:p-8">
        <div className="space-y-2">
          <p className="app-kicker">Feature comparison</p>
          <h2 className="text-[36px] font-semibold tracking-tight text-[color:var(--text)]">What changes as you upgrade</h2>
        </div>

        <div className="mt-6 overflow-hidden rounded-[26px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,253,249,0.86)]">
          <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(140px,0.7fr)_minmax(140px,0.7fr)] border-b border-[rgba(57,75,70,0.08)] bg-[rgba(141,169,187,0.08)] px-5 py-4 text-[15px] font-semibold text-[color:var(--text)]">
            <div>Capability</div>
            <div>Free</div>
            <div>Pro</div>
          </div>
          {comparisonRows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[minmax(0,1.3fr)_minmax(140px,0.7fr)_minmax(140px,0.7fr)] border-b border-[rgba(57,75,70,0.08)] px-5 py-4 text-[15px] leading-7 text-[color:var(--text)] last:border-b-0"
            >
              <div className="font-medium">{row.label}</div>
              <div className="text-[color:var(--muted)]">{row.free}</div>
              <div className="font-semibold text-[color:var(--primary)]">{row.pro}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="app-panel p-8 text-center">
        <p className="app-kicker">Start now</p>
        <h2 className="mt-3 text-[42px] font-semibold tracking-tight text-[color:var(--text)]">Start free, upgrade when the kitchen becomes a habit.</h2>
        <p className="mx-auto mt-4 max-w-3xl text-[18px] leading-8 text-[color:var(--muted)]">
          The free tier gets you into the workflow. Pro is there when you want more AI capacity, more recipe evolution, and a more personalized cooking companion.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/sign-up"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--primary)_0%,var(--accent)_100%)] px-6 py-3 text-[16px] font-semibold text-white shadow-[0_18px_30px_rgba(82,124,116,0.18)] transition hover:brightness-[1.03]"
          >
            Create account
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-[rgba(57,75,70,0.12)] bg-[rgba(255,252,246,0.96)] px-6 py-3 text-[16px] font-semibold text-[color:var(--text)] shadow-[0_14px_28px_rgba(76,50,24,0.1)] transition hover:bg-white"
          >
            Explore the app
          </Link>
        </div>
      </section>
    </div>
  );
}
