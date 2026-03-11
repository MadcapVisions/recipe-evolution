# Recipe Evolution

Next.js 16 + Supabase app for recipe creation, versioning, AI-assisted cooking workflows, grocery lists, photos, and live cook sessions.

## Requirements

- Node.js 20+
- npm
- Supabase project access
- Supabase CLI if you want to apply migrations or deploy edge functions locally/remotely

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
- product intelligence tables
- recipe visibility states
- AI rate limiting
- AI rate limit cleanup and metrics

Migration files live in [supabase/migrations](/Users/macbook12/Desktop/AIcook/recipe-evolution/supabase/migrations).

## Supabase Edge Functions

This repo still includes these edge functions in [supabase/functions](/Users/macbook12/Desktop/AIcook/recipe-evolution/supabase/functions):

- `ai-structure-recipe`
- `ai-improve-recipe`
- `ai-refine-recipe`
- `ai-generate-recipe`

Current app usage:

- text-import / structuring flows now use `/api/ai/structure-recipe`
- HomeHub no longer depends on `ai-generate-recipe`; it now uses `/api/ai/home`
- recipe improvement in the app uses `/api/ai/improve-recipe`
- legacy direct-invoke UI components for `ai-improve-recipe` and `ai-refine-recipe` have been removed from the app

Deploy functions when needed:

```bash
supabase functions deploy ai-structure-recipe
supabase functions deploy ai-improve-recipe
supabase functions deploy ai-refine-recipe
supabase functions deploy ai-generate-recipe
```

Function config lives in [supabase/config.toml](/Users/macbook12/Desktop/AIcook/recipe-evolution/supabase/config.toml).

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

- signed-out redirect behavior
- sign-in / sign-up screen rendering
- sign out + protected-route recovery
- authenticated recipe creation + first version creation
- recipe detail rendering after save
- hidden/archive persistence on `/recipes`

## App AI Routes

App-route AI endpoints currently in use:

- [app/api/ai/home/route.ts](/Users/macbook12/Desktop/AIcook/recipe-evolution/app/api/ai/home/route.ts)
- [app/api/ai/chef-chat/route.ts](/Users/macbook12/Desktop/AIcook/recipe-evolution/app/api/ai/chef-chat/route.ts)
- [app/api/ai/improve-recipe/route.ts](/Users/macbook12/Desktop/AIcook/recipe-evolution/app/api/ai/improve-recipe/route.ts)

These routes are authenticated and use Supabase-backed rate limiting.

Rate-limit operations added in the database:

- `public.cleanup_ai_rate_limits(interval)` removes old limiter rows
- `public.ai_rate_limit_route_metrics` gives route-level request/window summaries
- `public.ai_rate_limit_cleanup_job_status` exposes the scheduled cleanup job state
- a `pg_cron` job named `cleanup-ai-rate-limits` runs daily and deletes rows older than 30 days

## Notes

- Server-side auth guards now use `supabase.auth.getUser()` instead of `getSession()`.
- HomeHub AI calls now go through the authenticated app route layer rather than directly through `supabase.functions.invoke("ai-generate-recipe")`.
- If local scans are noisy, delete the stale `.next_backup_1773153870` directory in the project root.
