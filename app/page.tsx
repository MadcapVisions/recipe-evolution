import Link from "next/link";

const painPoints = [
  {
    title: "Disposable outputs",
    description: "Most recipe tools help you generate something once, then leave you to lose the good version later.",
  },
  {
    title: "No memory of what improved",
    description: "When a dish finally gets better, there is rarely a clean record of what changed and why it worked.",
  },
  {
    title: "No bridge to the real kitchen",
    description: "Ideas are easy. Turning them into something you can cook, revisit, and plan around is the harder part.",
  },
];

const workflow = [
  {
    step: "01",
    title: "Start with a dish direction",
    description: "Bring a craving, ingredient, leftover, or constraint instead of trying to write the perfect prompt.",
  },
  {
    step: "02",
    title: "Refine it with Chef",
    description: "Pressure-test flavor, technique, effort, and substitutions until the dish feels worth saving.",
  },
  {
    step: "03",
    title: "Save the stronger version",
    description: "Keep the best iteration with change notes, so the recipe improves instead of disappearing into chat history.",
  },
  {
    step: "04",
    title: "Cook it again or plan it",
    description: "Use the saved version in your cookbook, grocery planning, and weeknight cooking without starting over.",
  },
];

const freeStarterItems = [
  "Import a recipe you already make",
  "Develop a stronger version with Chef",
  "Save version notes in your cookbook",
  "Use the saved dish in planning and cooking mode",
];

const productReasons = [
  "A cookbook with memory, not a pile of generated text",
  "Version-aware recipe development instead of one-shot outputs",
  "Taste-aware refinement that gets more useful over time",
  "A path from rough idea to saved dish to weekly plan",
];

const freeIncludes = [
  "Free starter shelf with recipe import, guided development, and saved versions",
  "No card required to create an account and start building",
  "Upgrade later only if Recipe Evolution becomes part of how you cook",
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-[1320px] space-y-8">
      <section className="app-panel overflow-hidden">
        <div className="grid gap-8 p-7 lg:grid-cols-[minmax(0,1.05fr)_430px] lg:p-10">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="app-kicker">Personal test kitchen</span>
              <span className="rounded-full border border-[rgba(74,106,96,0.14)] bg-[rgba(74,106,96,0.06)] px-3 py-1.5 text-sm font-semibold text-[color:var(--primary-strong)]">
                Start free
              </span>
              <span className="rounded-full border border-[rgba(181,123,77,0.12)] bg-[rgba(255,246,237,0.92)] px-3 py-1.5 text-sm font-semibold text-[color:var(--text)]">
                No card required
              </span>
            </div>

            <div className="space-y-4">
              <h1 className="max-w-[11ch] font-display text-[48px] font-semibold leading-[0.92] tracking-tight text-[color:var(--text)] sm:text-[68px]">
                Turn rough dinner ideas into dishes worth repeating.
              </h1>
              <p className="max-w-3xl text-[20px] leading-9 text-[color:var(--muted)]">
                Recipe Evolution helps ambitious home cooks refine a dish with Chef, save the stronger version, and build a cookbook shaped by what actually works in their kitchen.
              </p>
            </div>

            <div className="rounded-[28px] border border-[rgba(74,106,96,0.1)] bg-[rgba(250,248,242,0.94)] p-5 shadow-[inset_3px_0_0_var(--primary)]">
              <p className="app-kicker">Free starter offer</p>
              <p className="mt-2 text-[24px] font-semibold leading-tight text-[color:var(--text)]">
                Claim your free Starter Shelf and build the first recipe you actually want to keep.
              </p>
              <p className="mt-2 max-w-2xl text-[16px] leading-7 text-[color:var(--muted)]">
                Start with one imported recipe or rough dish idea, refine it with Chef, and save the version history inside your cookbook.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                href="/sign-up"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[color:var(--primary)] px-6 py-3 text-[16px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_20px_rgba(58,84,76,0.18)] transition hover:bg-[color:var(--primary-strong)]"
              >
                Claim Free Starter Shelf
              </Link>
              <Link
                href="/pricing"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-[rgba(57,75,70,0.12)] bg-[rgba(255,252,246,0.92)] px-6 py-3 text-[16px] font-semibold text-[color:var(--text)] shadow-[0_2px_8px_rgba(61,51,36,0.03)] transition hover:bg-white"
              >
                See Plans
              </Link>
            </div>

            <div className="grid gap-2 pt-2 sm:grid-cols-3">
              {freeIncludes.map((item) => (
                <div
                  key={item}
                  className="artifact-sheet px-4 py-3 text-[14px] font-medium leading-6 text-[color:var(--text)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="artifact-sheet p-5">
            <div className="rounded-[26px] border border-[rgba(57,75,70,0.08)] bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="app-kicker">Starter shelf</p>
                  <p className="mt-2 text-[30px] font-semibold leading-tight text-[color:var(--text)]">
                    Your first saved dish starts here.
                  </p>
                </div>
                <div className="rounded-full border border-[rgba(181,123,77,0.12)] bg-[rgba(255,246,237,0.94)] px-3 py-1.5 text-sm font-semibold text-[color:var(--text)]">
                  Free today
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-[22px] border border-[rgba(57,75,70,0.06)] bg-[rgba(255,246,237,0.86)] p-4">
                  <p className="app-kicker">Start</p>
                  <p className="mt-2 text-[16px] leading-7 text-[color:var(--text)]">
                    “I already make lemon chicken pasta, but I want it brighter, less heavy, and easier on a weeknight.”
                  </p>
                </div>
                <div className="rounded-[22px] border border-[rgba(57,75,70,0.06)] bg-[rgba(247,250,248,0.9)] p-4">
                  <p className="app-kicker">Chef refines</p>
                  <p className="mt-2 text-[16px] leading-7 text-[color:var(--text)]">
                    Adjust the sauce, simplify the method, and decide what deserves to become the saved version.
                  </p>
                </div>
                <div className="rounded-[22px] border border-[rgba(57,75,70,0.06)] bg-[rgba(250,248,242,0.94)] p-4">
                  <p className="app-kicker">You keep</p>
                  <p className="mt-2 text-[16px] leading-7 text-[color:var(--text)]">
                    A dish in your cookbook with version notes, a cleaner recipe, and something you can cook again next week.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-[22px] border border-[rgba(74,106,96,0.1)] bg-[rgba(74,106,96,0.05)] p-4">
                <p className="app-kicker">Included in the free starter</p>
                <ul className="mt-3 space-y-2">
                  {freeStarterItems.map((item) => (
                    <li key={item} className="flex gap-3 text-[15px] leading-7 text-[color:var(--text)]">
                      <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[color:var(--primary)]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="annotation-note mt-5 px-4 py-3">
                <p className="font-annotate text-[18px] leading-7">
                  Keep the version you would actually cook again next Tuesday.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="app-panel p-6 lg:p-8">
        <div className="max-w-3xl">
          <p className="app-kicker">The gap in the market</p>
          <h2 className="mt-2 font-display text-[42px] font-semibold tracking-tight text-[color:var(--text)]">
            Most recipe apps stop at generation. The real value is what you keep.
          </h2>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {painPoints.map((item) => (
            <article key={item.title} className="rounded-[26px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,252,246,0.9)] p-6">
              <p className="app-kicker">Problem</p>
              <h3 className="mt-3 font-display text-[30px] font-semibold tracking-tight text-[color:var(--text)]">{item.title}</h3>
              <p className="mt-3 text-[16px] leading-7 text-[color:var(--muted)]">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="app-panel p-6 lg:p-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_430px]">
          <div>
            <p className="app-kicker">How it works</p>
            <h2 className="mt-2 font-display text-[44px] font-semibold tracking-tight text-[color:var(--text)]">
              Develop the dish before you decide it belongs in your cookbook.
            </h2>
            <p className="mt-3 max-w-3xl text-[18px] leading-8 text-[color:var(--muted)]">
              Recipe Evolution is for cooks who want a better outcome than “generate and forget.” You use Chef to sharpen a dish, then keep the version that actually earns a place on your shelf.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {workflow.map((item) => (
                <article key={item.step} className="rounded-[26px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,252,246,0.92)] p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(181,123,77,0.1)] text-[17px] font-semibold text-[color:var(--accent)]">
                    {item.step}
                  </div>
                  <h3 className="mt-4 text-[22px] font-semibold tracking-tight text-[color:var(--text)]">{item.title}</h3>
                  <p className="mt-2 text-[16px] leading-7 text-[color:var(--muted)]">{item.description}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="artifact-sheet p-6 shadow-[inset_3px_0_0_var(--primary)]">
            <p className="app-kicker">Why people stick with it</p>
            <h3 className="mt-2 font-display text-[34px] font-semibold tracking-tight text-[color:var(--text)]">
              A cookbook with memory beats a recipe slot machine.
            </h3>
            <div className="mt-5 space-y-3">
              {productReasons.map((item) => (
                <div
                  key={item}
                  className="rounded-[20px] border border-[rgba(57,75,70,0.06)] bg-white/88 px-4 py-3 text-[15px] leading-7 text-[color:var(--text)]"
                >
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-[20px] border border-[rgba(57,75,70,0.08)] bg-[rgba(255,252,246,0.9)] p-4">
              <p className="app-kicker">Immediate next step</p>
              <p className="mt-2 text-[16px] leading-7 text-[color:var(--text)]">
                Create your account, claim the free Starter Shelf, and build one recipe you would actually want to cook again this week.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="app-panel overflow-hidden p-6 lg:p-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_380px] lg:items-center">
          <div>
            <p className="app-kicker">Free starter shelf</p>
            <h2 className="mt-2 font-display text-[46px] font-semibold tracking-tight text-[color:var(--text)]">
              Start free. Save the first recipe worth keeping.
            </h2>
            <p className="mt-3 max-w-3xl text-[18px] leading-8 text-[color:var(--muted)]">
              If the product clicks, you will feel it fast: one stronger recipe, one cleaner version history, and one cookbook entry that already feels more useful than another disposable chat output.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[color:var(--primary)] px-6 py-3 text-[16px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_20px_rgba(58,84,76,0.18)] transition hover:bg-[color:var(--primary-strong)]"
              >
                Get the Free Starter Shelf
              </Link>
              <Link
                href="/pricing"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-[rgba(57,75,70,0.12)] bg-[rgba(255,252,246,0.92)] px-6 py-3 text-[16px] font-semibold text-[color:var(--text)] shadow-[0_2px_8px_rgba(61,51,36,0.03)] transition hover:bg-white"
              >
                Compare Free and Pro
              </Link>
            </div>
          </div>

          <div className="artifact-sheet p-5">
            <p className="app-kicker">What happens after sign-up</p>
            <div className="recipe-cover-wrap mt-4 overflow-hidden rounded-[22px] border border-[rgba(57,75,70,0.08)]">
              <div className="editorial-frame cover-wash-saffron aspect-[16/9] w-full" />
            </div>
            <div className="mt-4 space-y-3">
              {[
                "Create your personal cookbook",
                "Import a recipe or start from a dish idea",
                "Refine the dish with Chef",
                "Save the stronger version and build from there",
              ].map((item, index) => (
                <div key={item} className="flex gap-3 rounded-[20px] border border-[rgba(57,75,70,0.06)] bg-[rgba(250,248,242,0.92)] px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(181,123,77,0.1)] text-sm font-semibold text-[color:var(--accent)]">
                    {index + 1}
                  </div>
                  <p className="text-[15px] leading-7 text-[color:var(--text)]">{item}</p>
                </div>
              ))}
            </div>
            <div className="annotation-note mt-4 px-4 py-3">
              <p className="font-annotate text-[17px] leading-7">Start with one dish. Keep the one that earns a place on the shelf.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
