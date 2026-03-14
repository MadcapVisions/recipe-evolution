# Recipe Evolution

Next.js 16 + Supabase app for recipe creation, versioning, AI-assisted cooking workflows, grocery lists, photos, and live cook sessions.

Current architecture highlights:

- all new recipes are created atomically with an initial version
- AI-assisted creation flows share a common recipe draft shape
- canonical recipe persistence is intentionally simple: ingredient names and step text
- richer parsing such as quantities, units, prep notes, and timers is treated as optional derived enrichment
- app-route AI endpoints handle auth, rate limits, caching, and provider fallback
- HomeHub and recipe-detail chef conversations are persisted server-side

## Requirements

- Node.js 20+
- npm
- Supabase project access
- Supabase CLI if you want to apply migrations

## Local Environment

Create `.env.local` in the project root with at least:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

If you are using app-route AI features locally, also configure your provider secrets as needed:

```bash
AI_PROVIDER=openai
AI_FALLBACK_PROVIDERS=gemini,claude
AI_TIMEOUT_MS=20000
AI_MAX_RETRIES=2

OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini

GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash

ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-3-5-sonnet-latest
```

For authenticated Playwright coverage, add a dedicated test user:

```bash
E2E_TEST_EMAIL=your-test-user@example.com
E2E_TEST_PASSWORD=your-test-password
```

Use a disposable account for e2e. The tests create and delete recipes for that user.

## Install

```bash
npm install
```

## Run The App

Webpack dev server:

```bash
npm run dev
```

Optional Turbopack dev server:

```bash
npm run dev:turbo
```

Production build:

```bash
npm run build
npm run start
```

Default local URL:

- [http://127.0.0.1:3000](http://127.0.0.1:3000)

## Supabase Setup

Apply database migrations:

```bash
supabase db push
```

Current migrations cover:

- recipes and versions
- photos and live sessions
- grocery lists and AI cache
- AI conversation persistence
- product intelligence tables
- recipe visibility states
- AI rate limiting
- AI rate limit cleanup and metrics
- user taste profiles derived from preferences, behavior, and chat history

Migration files live in [supabase/migrations](/Users/macbook12/Desktop/AIcook/recipe-evolution/supabase/migrations).

## AI Architecture

Primary AI entry points are authenticated Next.js app routes:

- [app/api/ai/home/route.ts](/Users/macbook12/Desktop/AIcook/recipe-evolution/app/api/ai/home/route.ts)
- [app/api/ai/chef-chat/route.ts](/Users/macbook12/Desktop/AIcook/recipe-evolution/app/api/ai/chef-chat/route.ts)
- [app/api/ai/improve-recipe/route.ts](/Users/macbook12/Desktop/AIcook/recipe-evolution/app/api/ai/improve-recipe/route.ts)
- [app/api/ai/structure-recipe/route.ts](/Users/macbook12/Desktop/AIcook/recipe-evolution/app/api/ai/structure-recipe/route.ts)

These routes currently provide:

- auth checks via Supabase server sessions
- per-route AI rate limiting
- provider fallback across OpenAI, Gemini, and Claude
- normalized JSON parsing for structured AI payloads
- AI response caching for structure, HomeHub ideas, HomeHub full recipes, and recipe improvements
- server-side storage of HomeHub and recipe-detail conversation turns
- a shared AI recipe-result envelope for structure, generation, and refinement flows

Shared AI helpers live in:

- [lib/ai/aiClient.ts](/Users/macbook12/Desktop/AIcook/recipe-evolution/lib/ai/aiClient.ts)
- [lib/ai/jsonResponse.ts](/Users/macbook12/Desktop/AIcook/recipe-evolution/lib/ai/jsonResponse.ts)
- [lib/ai/cache.ts](/Users/macbook12/Desktop/AIcook/recipe-evolution/lib/ai/cache.ts)
- [lib/ai/conversationStore.ts](/Users/macbook12/Desktop/AIcook/recipe-evolution/lib/ai/conversationStore.ts)

## Supabase Config

Project-level Supabase config lives in [supabase/config.toml](/Users/macbook12/Desktop/AIcook/recipe-evolution/supabase/config.toml).

## Verification

Lint:

```bash
npm run lint
```

Type-check:

```bash
npm run typecheck
```

Production build:

```bash
npm run build
```

End-to-end suite:

```bash
npm run e2e
```

The e2e script:

- builds the app first
- starts `next start` on `127.0.0.1:3001`
- runs Playwright against the production server

Current e2e coverage includes:

- AI text import flow
- HomeHub chef-chat to recipe creation flow
- recipe-detail chef-chat to apply-ready version flow
- signed-out redirect behavior
- sign-in / sign-up screen rendering
- sign out + protected-route recovery
- authenticated recipe creation + first version creation
- recipe detail rendering after save
- hidden/archive persistence on `/recipes`

Rate-limit operations added in the database:

- `public.cleanup_ai_rate_limits(interval)` removes old limiter rows
- `public.ai_rate_limit_route_metrics` gives route-level request/window summaries
- `public.ai_rate_limit_cleanup_job_status` exposes the scheduled cleanup job state
- a `pg_cron` job named `cleanup-ai-rate-limits` runs daily and deletes rows older than 30 days

## Notes

- Server-side auth guards now use `supabase.auth.getUser()` instead of `getSession()`.
- recipe creation now goes through an atomic recipe-plus-initial-version flow.
- version sequencing now happens through the server API instead of client-side version-number calculation.
- the app treats persisted recipe content as canonical ingredient lines and canonical step lines, not rich first-class culinary objects.
- grocery and cooking experiences derive optional details such as quantities, prep notes, and timers from canonical text when needed.
- HomeHub AI calls now go through the authenticated app route layer instead of the retired edge-function path.
- persisted AI chat turns now feed back into user taste-profile inference.
- If local scans are noisy, delete the stale `.next_backup_1773153870` directory in the project root.
