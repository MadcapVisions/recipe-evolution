import Image from "next/image";
import Link from "next/link";
import { RandomHeroTagline } from "@/components/home/RandomHeroTagline";

const benefitStrip = [
  "Cook from ingredients already in your kitchen",
  "Get meals matched to your taste, time, and goals",
  "Cut the nightly what-should-we-eat spiral",
];

const heroHighlights = [
  "Uses what is in your fridge",
  "Ready in 25 minutes",
  "High protein options",
];

const heroQuickProof = [
  { value: "3 taps", label: "from ingredients to dinner ideas" },
  { value: "25 min", label: "weeknight target" },
  { value: "Zero guesswork", label: "when dinner feels stalled" },
];

const steps = [
  {
    step: "01",
    title: "Add what you have",
    description: "Drop in ingredients, leftovers, cravings, or guardrails like time, protein goals, and dietary preferences.",
  },
  {
    step: "02",
    title: "Get meal ideas that fit",
    description: "AIcook turns your kitchen reality into recipes that feel tailored instead of generic or impossible.",
  },
  {
    step: "03",
    title: "Cook with confidence",
    description: "Follow a guided recipe, save the good ones, and build a smarter personal rotation over time.",
  },
];

const showcaseSections = [
  {
    kicker: "Pantry-aware",
    title: "Use what is already in your kitchen.",
    description:
      "Turn produce, leftovers, and half-finished staples into meals that feel intentional instead of improvised.",
    bullets: ["Reduce waste without eating boring clean-out meals", "Unlock combinations based on what you actually own"],
    imageSrc: "/assets/homepage_photos/full meal.jpg",
    imageAlt: "Temporary homepage photo showing a full plated meal",
  },
  {
    kicker: "Taste-matched",
    title: "Get meals that fit real life.",
    description:
      "Filter for time, effort, household preferences, and nutrition goals so dinner feels useful on a Tuesday, not just inspirational.",
    bullets: ["Smart suggestions for quick dinners, picky households, and macro goals", "Less browsing, more deciding"],
    imageSrc: "/assets/homepage_photos/tuna dish.jpg",
    imageAlt: "Temporary homepage photo showing a tuna dish",
  },
  {
    kicker: "Built to repeat",
    title: "Keep the winners on repeat.",
    description:
      "Save favorites, revisit the meals that work, and let your home cooking get better instead of starting from zero every night.",
    bullets: ["Build a personal bench of reliable go-to meals", "Turn one good dinner into a weekly habit"],
    imageSrc: "/assets/homepage_photos/dish_side_view.jpg",
    imageAlt: "Temporary homepage photo showing a plated dish from the side",
  },
];

const scenarios = [
  "Busy weeknights",
  "Fridge clean-out dinners",
  "High-protein goals",
  "Budget-conscious cooking",
  "Picky households",
  "Beginner-friendly meals",
];

const features = [
  {
    title: "Ingredient-first suggestions",
    description: "Start with what you have, not a blank search bar.",
  },
  {
    title: "Personalized meal filters",
    description: "Match recipes to prep time, mood, nutrition, and household constraints.",
  },
  {
    title: "Guided cooking flow",
    description: "Move from idea to finished dish without losing momentum in the kitchen.",
  },
  {
    title: "Favorites that get smarter",
    description: "Keep the meals you love and shape a rotation that reflects how you actually cook.",
  },
];

const testimonials = [
  {
    quote: "It ended the nightly what-are-we-making debate in our apartment.",
    name: "Jenna, Brooklyn",
  },
  {
    quote: "I finally use the ingredients I buy before they die in the fridge.",
    name: "Maya, Austin",
  },
  {
    quote: "The recipe ideas feel like they were made for my actual week, not some fantasy meal plan.",
    name: "Chris, Chicago",
  },
];

const stats = [
  { value: "25 min", label: "Average weeknight dinner target" },
  { value: "3 taps", label: "From ingredients to tailored meal ideas" },
  { value: "1 kitchen", label: "A smarter system built around your real habits" },
];

export default function HomePage() {
  return (
    <div className="landing-page mx-auto max-w-[1380px] space-y-8">
      <section className="landing-hero relative overflow-hidden">
        <div className="landing-grid absolute inset-0 opacity-60" />
        <div className="relative grid gap-8 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.02fr)_minmax(380px,0.82fr)] lg:gap-12 lg:p-10">
          <div className="flex h-full flex-col">
            <div className="flex flex-wrap items-center gap-3">
              <span className="landing-pill">Chef Utility, with appetite</span>
              <span className="landing-pill landing-pill-warm">Personalized meal ideas from your kitchen</span>
            </div>

            <div className="mt-8">
              <RandomHeroTagline />
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/sign-up" className="landing-btn landing-btn-primary">
                Start Cooking
              </Link>
              <Link href="#how-it-works" className="landing-btn landing-btn-secondary">
                See How It Works
              </Link>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {heroQuickProof.map((item) => (
                <div key={item.value} className="landing-proof-chip">
                  <p className="text-[17px] font-semibold leading-tight text-[color:var(--landing-ink)]">{item.value}</p>
                  <p className="mt-1 text-[13px] leading-5 text-[color:var(--landing-muted)]">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {benefitStrip.map((item) => (
                <div key={item} className="landing-chip-card">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="landing-photo-shell">
              <div className="landing-photo-hero">
                <Image
                  src="/assets/homepage_photos/homepage.jpg"
                  alt="Temporary homepage hero image"
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 42vw"
                />
              </div>

              <div className="landing-ui-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="app-kicker">Tonight in AIcook</p>
                    <p className="mt-2 text-[20px] font-semibold leading-tight text-[color:var(--landing-ink)] sm:text-[26px]">
                      Lemon basil chicken pasta
                    </p>
                  </div>
                  <span className="landing-score">95% match</span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="landing-ui-panel">
                    <p className="app-kicker">You have</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {["Chicken", "Pasta", "Spinach", "Garlic", "Lemon"].map((item) => (
                        <span key={item} className="landing-ui-tag">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="landing-ui-panel">
                    <p className="app-kicker">Why it fits</p>
                    <ul className="mt-3 space-y-2 text-[14px] leading-6 text-[color:var(--landing-ink)]">
                      <li>Weeknight-friendly steps</li>
                      <li>Uses what is already open</li>
                      <li>Bright, high-protein finish</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {heroHighlights.map((item) => (
                    <span key={item} className="landing-ui-badge">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="landing-section">
        <div className="max-w-3xl">
          <p className="app-kicker">How it works</p>
          <h2 className="mt-3 font-display text-[26px] font-semibold tracking-[-0.04em] text-[color:var(--landing-ink)] sm:text-[42px]">
            From fridge to dinner in 3 steps.
          </h2>
          <p className="mt-4 text-[16px] leading-7 text-[color:var(--landing-muted)] sm:text-[18px] sm:leading-8">
            The flow is built for real-life cooking: fewer tabs, fewer dead-end ideas, and faster decisions.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {steps.map((item, index) => (
            <article key={item.step} className="landing-step-card">
              <div className="flex items-center justify-between gap-4">
                <span className="landing-step-number">{item.step}</span>
                <span className="landing-step-line" />
              </div>
              <h3 className="mt-5 text-[20px] font-semibold leading-tight text-[color:var(--landing-ink)] sm:text-[28px]">{item.title}</h3>
              <p className="mt-3 text-[16px] leading-7 text-[color:var(--landing-muted)]">{item.description}</p>
              <div className="landing-step-image mt-6">
                <Image
                  src={
                    index === 0
                      ? "/assets/homepage_photos/salad.jpg"
                      : index === 1
                        ? "/assets/homepage_photos/meal photo.jpg"
                        : "/assets/homepage_photos/dish3.jpg"
                  }
                  alt={item.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 30vw"
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
          <div>
            <p className="app-kicker">Built for real-life cooking</p>
            <h2 className="mt-3 font-display text-[26px] font-semibold tracking-[-0.04em] text-[color:var(--landing-ink)] sm:text-[42px]">
              A smarter dinner workflow, not another recipe rabbit hole.
            </h2>
          </div>
          <div className="landing-note">
            <p className="text-[16px] leading-7 text-[color:var(--landing-ink)]">
              Product-led where it matters, editorial where it counts. The page should prove utility without losing appetite.
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-5">
          {showcaseSections.map((section, index) => (
            <article
              key={section.title}
              className={`landing-showcase ${index % 2 === 1 ? "landing-showcase-reverse" : ""}`}
            >
              <div className="space-y-4">
                <p className="app-kicker">{section.kicker}</p>
                <h3 className="font-display text-[22px] font-semibold tracking-[-0.04em] text-[color:var(--landing-ink)] sm:text-[38px]">
                  {section.title}
                </h3>
                <p className="text-[15px] leading-7 text-[color:var(--landing-muted)] sm:text-[17px] sm:leading-8">{section.description}</p>
                <ul className="space-y-3">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3 text-[16px] leading-7 text-[color:var(--landing-ink)]">
                      <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[color:var(--landing-accent)]" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="landing-showcase-image">
                <Image
                  src={section.imageSrc}
                  alt={section.imageAlt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 44vw"
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section overflow-hidden">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.68fr)]">
          <div>
            <p className="app-kicker">Why people keep using it</p>
            <h2 className="mt-3 font-display text-[26px] font-semibold tracking-[-0.04em] text-[color:var(--landing-ink)] sm:text-[42px]">
              Less waste. Less decision fatigue. More meals worth repeating.
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {features.map((feature) => (
                <article key={feature.title} className="landing-feature-card">
                  <h3 className="text-[18px] font-semibold leading-tight text-[color:var(--landing-ink)] sm:text-[22px]">{feature.title}</h3>
                  <p className="mt-3 text-[16px] leading-7 text-[color:var(--landing-muted)]">{feature.description}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="landing-aside-panel">
            <div className="landing-aside-image">
              <Image
                src="/assets/homepage_photos/3 vairous dishes.jpg"
                alt="Temporary homepage photo showing several dishes"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 30vw"
              />
            </div>
            <div className="mt-5 space-y-3">
              <p className="app-kicker">Made for the way people actually cook</p>
              <div className="flex flex-wrap gap-2">
                {scenarios.map((item) => (
                  <span key={item} className="landing-pill landing-pill-soft">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <div className="landing-proof">
            <p className="app-kicker">Proof points</p>
            <h2 className="mt-3 font-display text-[24px] font-semibold tracking-[-0.04em] text-[color:var(--landing-ink)] sm:text-[40px]">
              Clear value before the first scroll is over.
            </h2>
            <div className="mt-6 grid gap-3">
              {stats.map((item) => (
                <div key={item.label} className="landing-stat-card">
                  <div className="text-[24px] font-semibold text-[color:var(--landing-ink)] sm:text-[30px]">{item.value}</div>
                  <div className="text-[15px] leading-6 text-[color:var(--landing-muted)]">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="app-kicker">Why home cooks keep coming back</p>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {testimonials.map((item) => (
                <article key={item.name} className="landing-testimonial">
                  <p className="text-[16px] leading-7 text-[color:var(--landing-ink)] sm:text-[18px] sm:leading-8">”{item.quote}”</p>
                  <p className="mt-5 text-[13px] font-semibold uppercase tracking-[0.18em] text-[color:var(--landing-muted)]">
                    {item.name}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-cta">
        <div className="landing-cta-image">
          <Image
            src="/assets/homepage_photos/woman eating dinner.jpg"
            alt="Temporary homepage lifestyle photo of a woman eating dinner"
            fill
            className="object-cover"
            sizes="100vw"
          />
        </div>
        <div className="landing-cta-copy">
          <p className="app-kicker text-white/80">Ready when dinner gets complicated</p>
          <h2 className="mt-3 font-display text-[26px] font-semibold tracking-[-0.04em] text-white sm:text-[42px]">
            Open the fridge. We&apos;ll take it from there.
          </h2>
          <p className="mt-4 max-w-2xl text-[16px] leading-7 text-white/82 sm:text-[18px] sm:leading-8">
            AIcook helps you turn ingredients, cravings, and constraints into meals you will actually want to make tonight.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/sign-up" className="landing-btn landing-btn-cta">
              Start Cooking
            </Link>
            <Link href="/pricing" className="landing-btn landing-btn-ghost">
              See Plans
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
