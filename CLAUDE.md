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

## Recipe Creation Logic Map

### Two Top-Level Paths

| Path | Entry Route | Purpose |
|---|---|---|
| **Home Build** | `POST /api/ai/home/build` | New recipe from scratch |
| **Improve Recipe** | `POST /api/ai/improve-recipe` | Mutate existing version |

---

### Path 1: Home Build (`app/api/ai/home/build/route.ts`)

**Pre-generation:**
1. **Auth + rate limit** — `lib/ai/routeSecurity.ts` — validates session, checks `check_ai_rate_limit` RPC (20 req/5min)
2. **Brief resolution** — decides which brief to use:
   - If `lockedSession.selected_direction` exists → `buildLockedBrief()` (`lib/ai/lockedSession.ts`)
   - If persisted brief is locked (no direction) → use it as-is
   - Else → `compileCookingBrief()` (`lib/ai/briefCompiler.ts`) — derives intent from message + history
3. **Recipe plan** — `buildRecipePlanFromBrief()` (`lib/ai/recipePlanner.ts`) — translates brief into constraints for the generator

**Generation retry loop** (inside `generateHomeRecipe`, `lib/ai/homeHub.ts`):
1. Generate recipe with current plan
2. **Verify** — `verifyRecipeAgainstBrief()` (`lib/ai/recipeVerifier.ts`) — checks recipe matches brief
3. If verification fails → `RecipeBuildError` with `retryStrategy`:
   - `regenerate_same_model` → retry with tighter plan (`buildRetryRecipePlan`)
   - `regenerate_stricter` → same, stricter constraints
   - After attempt 2: escalate to `try_fallback_model` (uses `taskSetting.fallbackModel`)
   - `no_retry` / exhausted → terminal failure
4. Terminal failure: `mapToLaunchDecision()` (`lib/ai/launchDecisionMapper.ts`) → user-facing recovery card

**Shadow path** (telemetry only, no effect on served result):
When `macroTargets` are set, `orchestrateRecipeGeneration()` runs in parallel to collect comparison telemetry.

**Post-generation persistence:**
- `storeGenerationAttempt()` (`lib/ai/generationAttemptStore.ts`) — logs every attempt (success or failure)
- `upsertLockedDirectionSession()` — marks session state as `built`

---

### Path 2: Improve Recipe (`app/api/ai/improve-recipe/route.ts`)

1. **Auth + rate limit** — `requireAuthenticatedAiAccess` (10 req/5min)
2. **Load canonical data** — reads `recipe_versions` from DB; falls back to request body
3. **Session brief** — `resolveRecipeSessionBrief()` (`lib/ai/recipeSessionStore.ts`) — loads conversation context for this recipe/version
4. **Improve** — `improveRecipe()` (`lib/ai/improveRecipe.ts`) — single AI call, returns updated `RecipeDraft`
5. Error classification — `classifyImproveRecipeError()` (`lib/ai/improveRecipeError.ts`) — maps errors to user-facing messages + HTTP codes

---

### Path 3: Chef Chat (`POST /api/ai/home` → `chef_chat` mode)

**Intent classification** (before calling AI):
- `guardCookingTopic()` (`lib/ai/topicGuard.ts`) — blocks non-food messages
- `deriveBriefRequestMode()` (`lib/ai/briefStateMachine.ts`) — classifies turn as: `explore | compare | revise | locked`

**After AI response:**
- `extractRefinementDeltaWithFallback()` — extracts structured ingredient/style changes from reply
- `appendLockedSessionRefinementDelta()` — merges delta into locked session
- Persists: conversation turns, locked session, compiled brief (all fire-and-forget)
- Returns `session_action: "clear_locked_direction"` if user pivoted

**Locked direction state machine** (`lib/ai/lockedSessionStore.ts`):
`exploring → direction_locked → ready_to_build → building → built`

---

### Core Generation Orchestrator (`lib/ai/recipeGenerationOrchestrator.ts`)

Used by home build (shadow path today, full path coming). Per-family pipeline:

| Step | File | Recovery |
|---|---|---|
| **0. Dish family selection** | `intentResolver.ts` + `dishFamilyRules.ts` | Tries fallback candidates in order |
| **0b. Macro feasibility** | `familyMacroFeasibility.ts` | Fails early → try next family |
| **1. Ingredient planning** | `ingredientPlanner.ts` | `ingredientPlanRepair.ts` (up to 2 retries) |
| **2. Step generation** | `stepGenerator.ts` | `stepPlanRepair.ts` (up to 2 retries) |
| **3. Full validation** | structural + `ratioValidator.ts` + `macroTargetValidator.ts` + `nutritionCalculator.ts` | If any fail → step 4 |
| **4. Full repair** | `repairOrchestrator.ts` (up to 2 retries) | `accepted_repair` / `kept_original` / `regenerate_from_ingredients` |

**Final outcomes:** `accepted` → `accepted_after_recipe_repair` → `kept_repaired_recipe` → `regenerate_from_ingredients` → `failed`

---

### Shared Infrastructure

| File | Role |
|---|---|
| `lib/ai/routeSecurity.ts` | Auth check + rate limit for every AI route |
| `lib/ai/taskSettings.ts` | Per-route model config (primary + fallback) from `ai_task_settings` table |
| `lib/ai/cache.ts` | SHA256-keyed response cache (`ai_cache` table) |
| `lib/ai/userTasteProfile.ts` | Cached user preference summary injected into every generation |
| `lib/ai/recipeTelemetry.ts` | Structured timing/stage logs attached to generation results |
| `lib/recipes/recipeDraft.ts` | Canonical `RecipeDraft` shape — shared pre-persistence type |
| `lib/recipes/canonicalEnrichment.ts` | Derives quantity/unit/prep on read (never persisted) |
| `lib/ai/recipeResult.ts` | `AiRecipeResult` wrapper around `RecipeDraft` with metadata |
