import Image from "next/image";
import Link from "next/link";

const heroHighlights = [
  "25 min but polished",
  "Creamy, bright, and flexible",
  "Add to your weekly plan",
];

const heroFeatureProof = [
  {
    title: "Shape the meal first",
    subtitle: "Refine the dish before committing to a recipe",
  },
  {
    title: "Build real recipes",
    subtitle: "From your exact direction, not generic ideas",
  },
  {
    title: "Plan and shop instantly",
    subtitle: "Turn meals into weekly plans and grocery lists",
  },
];

const entryModes = [
  {
    title: "Start with a craving",
    description: "Something cozy, spicy, fast, or a little elevated.",
  },
  {
    title: "Start with ingredients",
    description: "Chicken, spinach, lemons, leftover rice, half a carton of cream.",
  },
  {
    title: "Start with constraints",
    description: "High protein, vegetarian, kid-friendly, no cilantro, under 30 minutes.",
  },
];

const steps = [
  {
    step: "01",
    title: "Tell Max what you want",
    description: "Start with a dish idea, craving, ingredient, or constraint.",
  },
  {
    step: "02",
    title: "Shape the meal together",
    description: "Refine flavor, ingredients, effort, and timing until it feels right.",
  },
  {
    step: "03",
    title: "Turn it into a plan",
    description: "Save the recipe, add it to your week, and generate the grocery list.",
  },
];

const showcaseSections = [
  {
    kicker: "More personalized than browsing",
    title: "Start with what you actually want.",
    description:
      "Not a blank search bar or a generic suggestion engine. Bring a craving, an ingredient, or a constraint — Max meets you there.",
    bullets: [
      "Describe a mood, dish idea, or leftover ingredient",
      "Chef shapes the meal with you before it becomes a recipe",
    ],
    imageSrc: "/assets/homepage_photos/full meal.jpg",
    imageAlt: "Temporary homepage photo showing a full plated meal",
  },
  {
    kicker: "More flexible than fixed recipes",
    title: "Adjust flavor, timing, and goals before you commit.",
    description:
      "Max helps you refine ingredient choices, timing, technique, and dietary goals through conversation — not after the fact.",
    bullets: [
      "Change the flavor profile, swap an ingredient, or tighten the timing",
      "No locked-in recipe to fight against",
    ],
    imageSrc: "/assets/homepage_photos/tuna dish.jpg",
    imageAlt: "Temporary homepage photo showing a tuna dish",
  },
  {
    kicker: "More useful than inspiration alone",
    title: "Turn ideas into real recipes, plans, and lists.",
    description:
      "Once the dish feels right, MealMax doesn't stop at inspiration. Save it as a recipe, plan it into your week, and generate the full grocery list.",
    bullets: [
      "Save every version to your personal cookbook",
      "One tap from recipe to meal plan to grocery list",
    ],
    imageSrc: "/assets/homepage_photos/dish_side_view.jpg",
    imageAlt: "Temporary homepage photo showing a plated dish from the side",
  },
];

const scenarios = [
  "Weeknight cravings",
  "Ingredient-led ideas",
  "High-protein goals",
  "Vegetarian meals",
  "Picky households",
  "Beginner-friendly",
  "Under 30 minutes",
  "Budget-conscious",
];

const features = [
  {
    title: "Elevated by default",
    description: "Max helps turn rough ideas into meals that feel intentional, balanced, and worth making.",
  },
  {
    title: "Built around real life",
    description: "Refine for time, dietary needs, available ingredients, and household preferences.",
  },
  {
    title: "Ready to use",
    description: "When the dish feels right, save it as a recipe, plan it into your week, and generate your list.",
  },
  {
    title: "Smarter over time",
    description: "Max learns your taste preferences and refines suggestions the more you cook.",
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
  { value: "Conversational", label: "shape the dish before it becomes a recipe" },
  { value: "Full stack", label: "recipe, meal plan, and grocery list in one flow" },
  { value: "Personalized", label: "built around your taste, time, and goals" },
];

const maxOutputMeals = [
  { name: "Lemon Basil Chicken Pasta", time: "25 min", tags: ["High protein", "Weeknight"] },
  { name: "Smoky Black Bean Tacos", time: "20 min", tags: ["Vegetarian", "Quick"] },
  { name: "Ginger Sesame Salmon Bowl", time: "30 min", tags: ["High protein", "Gluten-free"] },
];

const maxOutputWeekPlan = [
  { day: "Mon", meal: "Lemon Basil Chicken" },
  { day: "Tue", meal: "Black Bean Tacos" },
  { day: "Wed", meal: "Salmon Bowl" },
  { day: "Thu", meal: "Leftover night" },
  { day: "Fri", meal: "Open slot" },
];

const maxOutputGrocery = [
  "Chicken thighs · 1.5 lb",
  "Fresh basil · 1 bunch",
  "Pasta · 12 oz",
  "Lemons · 3",
  "Black beans · 2 cans",
  "Corn tortillas · 1 pack",
  "Salmon fillets · 2",
  "Sesame oil · small bottle",
];

export default function HomePage() {
  return (
    <div className="landing-page mx-auto max-w-[1380px] space-y-8">
      <section className="landing-hero relative overflow-hidden">
        <div className="landing-grid absolute inset-0 opacity-60" />
        <div className="relative grid gap-8 p-5 sm:p-7 lg:grid-cols-[minmax(0,0.88fr)_minmax(460px,1.12fr)] lg:items-center lg:gap-12 lg:p-10">
          <div className="landing-hero-copy flex h-full flex-col">
            <div className="flex flex-wrap items-center gap-3">
              <span className="landing-pill landing-pill-warm">AI meal creation, planning, and shopping</span>
            </div>

            <div className="mt-8">
              <div className="space-y-4">
                <h1 className="max-w-[11ch] font-display text-[34px] font-semibold leading-[0.92] tracking-[-0.045em] text-[color:var(--landing-ink)] sm:text-[54px] lg:text-[84px]">
                  Shape dinner with taste, not guesswork.
                </h1>
                <p className="max-w-[35rem] text-[16px] leading-7 text-[color:var(--landing-muted)] sm:text-[19px] sm:leading-8">
                  Start with a craving, an ingredient, or a few constraints.{" "}
                  <span className="font-semibold text-[color:var(--landing-ink)]">Max</span>{" "}
                  helps you refine the dish before it becomes the recipe, then turns it into a plan and shopping list.
                </p>
              </div>
            </div>

            <p className="mt-4 hidden text-[16px] font-medium tracking-[-0.01em] text-[color:var(--landing-muted)] sm:block sm:text-[18px]">
              Fewer dead-end searches. More dinners you actually want to make.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/sign-up" className="landing-btn landing-btn-primary">
                Start with Max
              </Link>
              <Link href="#how-it-works" className="landing-btn landing-btn-secondary">
                See how it works
              </Link>
            </div>

            <div className="mt-7 hidden gap-3 sm:grid sm:grid-cols-3">
              {heroFeatureProof.map((item) => (
                <div key={item.title} className="landing-feature-proof-card">
                  <p className="text-[15px] font-semibold leading-tight text-[color:var(--landing-ink)]">{item.title}</p>
                  <p className="mt-1.5 text-[13px] leading-5 text-[color:var(--landing-muted)]">{item.subtitle}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="landing-photo-shell">
              <div className="landing-photo-hero">
                <Image
                  src="/assets/homepage_photos/creamy_shrimp_pasta.jpg"
                  alt="Creamy shrimp pasta plated for the MealMax homepage hero"
                  fill
                  priority
                  unoptimized
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 52vw"
                />
              </div>

              <div className="landing-ui-card">
                <div>
                  <p className="app-kicker">Max in action</p>
                  <div className="mt-3 grid gap-2">
                    <div className="rounded-[18px] bg-[color:var(--landing-accent)] px-4 py-2.5 text-[13px] leading-5 text-white">
                      Creamy, bright shrimp pasta. Feels a little special, still weeknight-manageable.
                    </div>
                    <div className="rounded-[18px] border border-[rgba(57,75,70,0.08)] bg-[rgba(250,248,242,0.94)] px-4 py-2.5 text-[13px] leading-5 text-[color:var(--landing-ink)]">
                      Max turns that brief into a polished recipe, weekly plan, and grocery list.
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {heroHighlights.map((item) => (
                    <span key={item} className="landing-ui-badge">
                      {item}
                    </span>
                  ))}
                </div>

                <div className="mt-4 rounded-[16px] border border-[rgba(74,106,96,0.15)] bg-[rgba(247,250,248,0.97)] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-semibold leading-tight text-[color:var(--landing-ink)]">
                        Creamy Lemon Shrimp Pasta
                      </p>
                      <p className="mt-1 text-[12px] text-[color:var(--landing-muted)]">25 min · Best pick for tonight</p>
                    </div>
                    <span className="landing-score">Best pick</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section hidden lg:block">
        <div className="max-w-3xl">
          <p className="app-kicker">Start anywhere</p>
          <h2 className="mt-3 font-display text-[26px] font-semibold tracking-[-0.04em] text-[color:var(--landing-ink)] sm:text-[42px]">
            Start anywhere. Max takes it from there.
          </h2>
          <p className="mt-4 text-[16px] leading-7 text-[color:var(--landing-muted)] sm:text-[18px] sm:leading-8">
            There is no wrong starting point. Max works with whatever you bring.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {entryModes.map((mode) => (
            <article key={mode.title} className="landing-feature-card">
              <h3 className="text-[20px] font-semibold leading-tight text-[color:var(--landing-ink)] sm:text-[24px]">
                {mode.title}
              </h3>
              <p className="mt-3 text-[16px] leading-7 text-[color:var(--landing-muted)]">{mode.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="landing-section">
        <div className="max-w-3xl">
          <p className="app-kicker">How it works</p>
          <h2 className="mt-3 font-display text-[26px] font-semibold tracking-[-0.04em] text-[color:var(--landing-ink)] sm:text-[42px]">
            From idea to recipe in 3 steps.
          </h2>
          <p className="mt-4 text-[16px] leading-7 text-[color:var(--landing-muted)] sm:text-[18px] sm:leading-8">
            Max helps you shape the meal before it becomes the recipe. No guesswork, no dead-end searches.
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
              <div className="landing-step-image mt-6 hidden lg:block">
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
                  unoptimized
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 30vw"
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section hidden lg:block">
        <div className="max-w-3xl">
          <p className="app-kicker">See what Max creates</p>
          <h2 className="mt-3 font-display text-[26px] font-semibold tracking-[-0.04em] text-[color:var(--landing-ink)] sm:text-[42px]">
            One conversation. Three meals, a plan, and a list.
          </h2>
          <p className="mt-4 text-[16px] leading-7 text-[color:var(--landing-muted)] sm:text-[18px] sm:leading-8">
            Tell Max what you want this week. Here&apos;s what comes out the other side.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {maxOutputMeals.map((meal) => (
            <article key={meal.name} className="landing-output-meal-card">
              <p className="text-[17px] font-semibold leading-tight text-[color:var(--landing-ink)]">{meal.name}</p>
              <p className="mt-1.5 text-[13px] text-[color:var(--landing-muted)]">{meal.time}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {meal.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-[rgba(74,106,96,0.16)] bg-white px-3 py-1 text-[12px] font-medium text-[color:var(--landing-ink)]">
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="landing-output-plan-card">
            <p className="app-kicker mb-3">Weekly plan</p>
            <div className="space-y-2">
              {maxOutputWeekPlan.map((entry) => (
                <div key={entry.day} className="flex items-center gap-3">
                  <span className="w-8 shrink-0 text-[12px] font-semibold uppercase tracking-[0.14em] text-[color:var(--landing-muted)]">{entry.day}</span>
                  <span className="text-[14px] text-[color:var(--landing-ink)]">{entry.meal}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="landing-output-grocery-card">
            <p className="app-kicker mb-3">Grocery list</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {maxOutputGrocery.map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--landing-accent)]" />
                  <span className="text-[13px] leading-5 text-[color:var(--landing-ink)]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section hidden lg:block">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
          <div>
            <p className="app-kicker">Not just recipe search</p>
            <h2 className="mt-3 font-display text-[26px] font-semibold tracking-[-0.04em] text-[color:var(--landing-ink)] sm:text-[42px]">
              Actual meal shaping.
            </h2>
          </div>
          <div className="landing-note">
            <p className="text-[16px] leading-7 text-[color:var(--landing-ink)]">
              Max helps you shape the meal before you commit to it — adjusting flavor, effort, ingredients, and goals through conversation.
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
                  unoptimized
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 44vw"
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section hidden lg:block">
        <div className="max-w-3xl">
          <p className="app-kicker">Planning</p>
          <h2 className="mt-3 font-display text-[26px] font-semibold tracking-[-0.04em] text-[color:var(--landing-ink)] sm:text-[42px]">
            Turn one good idea into a full week.
          </h2>
          <p className="mt-4 text-[16px] leading-7 text-[color:var(--landing-muted)] sm:text-[18px] sm:leading-8">
            When you find meals that fit, MealMax can turn them into a weekly plan and build your grocery list automatically.
          </p>
        </div>
      </section>

      <section className="landing-section overflow-hidden">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.68fr)]">
          <div>
            <p className="app-kicker">Why it&apos;s better</p>
            <h2 className="mt-3 font-display text-[26px] font-semibold tracking-[-0.04em] text-[color:var(--landing-ink)] sm:text-[42px]">
              Smarter meal creation, not just recipe browsing.
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

          <div className="landing-aside-panel hidden lg:block">
            <div className="landing-aside-image">
              <Image
                src="/assets/homepage_photos/3 vairous dishes.jpg"
                alt="Temporary homepage photo showing several dishes"
                fill
                unoptimized
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
          <div className="landing-proof hidden lg:block">
            <p className="app-kicker">What you get</p>
            <h2 className="mt-3 font-display text-[24px] font-semibold tracking-[-0.04em] text-[color:var(--landing-ink)] sm:text-[40px]">
              The full loop, in one place.
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
              {testimonials.map((item, index) => (
                <article key={item.name} className={`landing-testimonial${index > 0 ? " hidden sm:block" : ""}`}>
                  <p className="text-[16px] leading-7 text-[color:var(--landing-ink)] sm:text-[18px] sm:leading-8">"{item.quote}"</p>
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
            unoptimized
            className="object-cover"
            sizes="100vw"
          />
        </div>
        <div className="landing-cta-copy">
          <p className="app-kicker text-white/80">Ready when dinner gets complicated</p>
          <h2 className="mt-3 font-display text-[26px] font-semibold tracking-[-0.04em] text-white sm:text-[42px]">
            Start with a craving. End with a plan.
          </h2>
          <p className="mt-4 max-w-2xl text-[16px] leading-7 text-white/82 sm:text-[18px] sm:leading-8">
            Tell Max what you want to make. Get an elevated recipe, a meal plan, and a grocery list in minutes.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/sign-up" className="landing-btn landing-btn-cta">
              Start with Max
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
