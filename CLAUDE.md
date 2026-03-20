# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server (localhost:3000)
npm run dev:turbo    # Dev server with Turbopack (experimental)
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript type checking
npm run test:unit    # Node unit tests
npm run e2e          # Playwright E2E tests (builds first, runs on :3001)
```

## Architecture

**Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS + Supabase (PostgreSQL, Auth, Storage)

**AI layer:** OpenRouter (primary), with fallback support for OpenAI/Anthropic/Gemini. All AI routes live under `app/api/ai/` and enforce auth, per-route rate limiting (via Supabase RPC), and SHA256-keyed response caching (`ai_cache` table).

**Key architectural rules:**
- Recipes are always created atomically with an initial version via the `create_recipe_with_initial_version` RPC — never insert into `recipes` alone.
- Canonical recipe storage is intentionally text-only (`ingredients_json` stores `{name: string}[]`, `steps_json` stores `{text: string}[]`). Quantity/unit/prep enrichment is derived on read via `lib/recipes/canonicalEnrichment.ts`, not persisted.
- All tables use Supabase Row Level Security. Server-side code uses `SUPABASE_SERVICE_ROLE_KEY` only for admin operations — regular routes use the user's session.
- Server Components are used where possible; Client Components are only for interactivity.
- AI conversation history is persisted server-side in `ai_conversation_turns` and feeds `user_taste_profiles`.

**Directory layout:**
- `app/` — Next.js pages and API routes
- `components/` — React components organized by feature (shell, recipes, home, planner, grocery)
- `lib/` — Business logic: AI engines (`lib/ai/`), recipe processing (`lib/recipes/`), auth helpers (`lib/auth/`), Supabase clients (`lib/supabase/`)
- `supabase/migrations/` — SQL migration files (source of truth for schema)

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=
OPENROUTER_DEFAULT_MODEL=openai/gpt-4o-mini
OPENROUTER_HTTP_REFERER=http://localhost:3000
OPENROUTER_APP_TITLE=Recipe Evolution
ADMIN_EMAILS=                  # comma-separated
AI_TIMEOUT_MS=20000
AI_MAX_RETRIES=2
# E2E only:
E2E_TEST_EMAIL=
E2E_TEST_PASSWORD=
```

## Core Data Types

`RecipeDraft` (`lib/recipes/recipeDraft.ts`) is the shared shape used across all AI creation flows before persistence. `AiRecipeResult` (`lib/ai/recipeResult.ts`) wraps it with metadata. At the DB layer, `ingredients_json` and `steps_json` on `recipe_versions` only carry `name`/`text` fields.

## Key RPC Functions

- `create_recipe_with_initial_version` — atomic recipe + v1 creation
- `create_recipe_version` — atomic new version
- `check_ai_rate_limit` — check & increment per-route limit
- `ai_rate_limit_route_metrics` — admin metrics view

## Admin Access

Routes under `app/admin/` and `app/api/admin/` are gated by `lib/auth/adminAccess.ts`, which checks the `ADMIN_EMAILS` env var. AI model config per task is managed via the `ai_task_settings` table and the admin UI.
