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
- All tables use Supabase Row Level Security. Server-side code uses `SUPABASE_SERVICE_ROLE_KEY` only for admin operations (`ai_task_settings` lookup) — regular routes use the user's session.
- Server Components are used where possible; Client Components are only for interactivity.
- AI conversation history is persisted server-side in `ai_conversation_turns` and feeds `user_taste_profiles`.
- All AI route responses are streamed (NDJSON) for home build; JSON for all other routes.

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

`coerceIngredientLineWithAmount` in `recipeDraft.ts` has a hardcoded lookup table (~80 lines) that silently injects default quantities for common ingredients when the AI omits them (e.g. `onion` → `"1 onion, diced"`). This is intentional but can mask AI quality issues.

## Key RPC Functions

- `create_recipe_with_initial_version` — atomic recipe + v1 creation
- `create_recipe_version` — atomic new version
- `check_ai_rate_limit` — check & increment per-route limit
- `ai_rate_limit_route_metrics` — admin metrics view

## Admin Access

Routes under `app/admin/` and `app/api/admin/` are gated by `lib/auth/adminAccess.ts`, which checks the `ADMIN_EMAILS` env var. AI model config per task is managed via the `ai_task_settings` table and the admin UI.

---

## AI Route Map

| Route | Rate limit | Purpose |
|---|---|---|
| `POST /api/ai/home` | 20/5min | Home hub: chef chat, mood/ingredient/filtered ideas |
| `GET /api/ai/home` | — | Restore home session state |
| `POST /api/ai/home/build` | 20/5min | Stream NDJSON: generate full recipe from brief |
| `POST /api/ai/improve-recipe` | 10/5min | Mutate existing recipe version |
| `POST /api/ai/chef-chat` | 20/5min | Recipe-detail AI chat + optional improve suggestion |
| `POST /api/ai/nutrition` | — | Calculate nutrition for a recipe |
| `POST /api/ai/structure-recipe` | — | Convert freeform text to structured recipe JSON |
| `POST /api/chef-score/calculate` | — | Calculate + persist chef score for a version |
| `POST /api/chef-score/compare` | — | Diff scores between two versions |
| `POST /api/chef-score/recalculate` | — | Force score recalculation |
| `POST /api/chef-fix/generate` | — | Generate fix suggestions (reliability/flavor/expert) |
| `POST /api/chef-fix/apply` | — | Apply selected fixes → new version + score delta |
| `POST /api/chef-fix/preview` | — | Preview what applying fixes would produce |

---

## Recipe Creation Logic Map

### Top-Level Paths

| Path | Entry Route | Purpose |
|---|---|---|
| **Home Build** | `POST /api/ai/home/build` | New recipe from scratch via NDJSON stream |
| **Improve Recipe** | `POST /api/ai/improve-recipe` | Mutate existing version (standalone) |
| **Home Chef Chat** | `POST /api/ai/home` (chef_chat mode) | Conversational recipe exploration + direction locking |
| **Recipe Detail Chat** | `POST /api/ai/chef-chat` | Recipe-scoped AI chat + optional inline suggestion |

---

### Path 1: Home Build (`app/api/ai/home/build/route.ts`)

Streams NDJSON events: `status`, `debug`, `result`, `error`.

**Pre-generation:**
1. **Auth + rate limit** — `lib/ai/routeSecurity.ts` (20 req/5min)
2. **Parallel setup** — taste profile + task settings + brief/session reads all kicked off concurrently
3. **Brief resolution** — decides which brief to use:
   - If `lockedSession.selected_direction` exists → `buildLockedBrief()` — uses `build_spec` if present, else reconstructs from session refinements
   - If persisted brief is locked (no direction) → use persisted brief as-is
   - Else → `compileCookingBrief()` — derives intent from message + history
4. **Retry modifiers applied** — `relaxRequiredNamedIngredients` removes specific required ingredients; `simplifyRequest` flag passed to generator
5. **Recipe plan** — `buildRecipePlanFromBrief()` (`lib/ai/recipePlanner.ts`) — translates brief into constraints

**Generation retry loop** (in-route, not in homeHub):
1. `generateHomeRecipe()` (`lib/ai/homeHub.ts`) — calls AI, returns `AiRecipeResult`
2. **Verify** — `verifyRecipeAgainstBrief()` (`lib/ai/recipeVerifier.ts`) — pure function, returns `passes`, `score`, `reasons`, `checks`, `retry_strategy`
3. If verification fails → `RecipeBuildError` with `retryStrategy`:
   - `regenerate_same_model` / `regenerate_stricter` → `buildRetryRecipePlan` appends failure reasons → retry (up to 2 same-model attempts)
   - After attempt 2 exhausted and fallback model configured → escalates to `try_fallback_model` (up to 1 more attempt)
   - `no_retry` / fully exhausted → terminal failure
4. Every failed attempt stores a generation attempt record (fire-and-forget) via `storeGenerationAttempt`
5. Each retry emits a `debug` event (`attempt_failed`) to the stream — **visible to all users on failure**

**Shadow path** (telemetry only, never affects served result):
When `effectiveBrief.constraints.macroTargets` is set, `orchestrateRecipeGeneration()` runs after the main result and emits a `debug` event with telemetry. Since most recipes don't set `macroTargets`, shadow coverage is minimal in normal usage.

**Post-generation persistence (success):**
- `upsertLockedDirectionSession()` — marks session state as `built` (fire-and-forget)
- `storeGenerationAttempt()` — logs successful attempt (fire-and-forget)
- Streams `{ type: "result", result, launchDecision }`

**Terminal failure:**
- `mapToLaunchDecision()` (`lib/ai/launchDecisionMapper.ts`) → `LaunchDecision` enum drives UI recovery card
- Streams `{ type: "error", ..., launchDecision }`

**Client save flow:** User clicks "Save" → `createRecipeFromDraft` → `POST /api/recipes` → `create_recipe_with_initial_version` RPC → redirect to `/recipes/{id}/versions/{versionId}`

---

### Path 2: Improve Recipe (`app/api/ai/improve-recipe/route.ts`)

1. **Auth + rate limit** — `requireAuthenticatedAiAccess` (10 req/5min)
2. **Ownership check** — verifies `recipe.owner_id = userId`
3. **Load canonical data** — reads `recipe_versions` from DB; falls back to request body if thin
4. **Session brief** — `resolveRecipeSessionBrief()` (`lib/ai/recipeSessionStore.ts`) — lazy-initializes if none exists
5. **Improve** — `improveRecipe()` (`lib/ai/improveRecipe.ts`):
   - Up to 2 AI attempts + 1 repair pass for hard-required ingredients
   - `verifyInstructionApplied` — keyword coverage check (≥40%)
   - Fallback: deterministic `buildIngredientAdditionFallback` on parse failure
6. **Error classification** — `classifyImproveRecipeError()` maps errors to HTTP codes + user messages
7. `storeGenerationAttempt` (awaited, not fire-and-forget)
8. Returns `{ result: AiRecipeResult }`

**Client save flow:** User clicks "Save Version" → `POST /api/recipes/{id}/versions` → `create_recipe_version` RPC

---

### Path 3: Home Chef Chat (`POST /api/ai/home` → `chef_chat` mode)

**Intent classification** (before calling AI):
- `guardCookingTopic()` (`lib/ai/topicGuard.ts`) — keyword + pattern blocks off-topic messages
- `deriveBriefRequestMode()` (`lib/ai/briefStateMachine.ts`) — classifies turn as: `explore | compare | revise | locked`

**AI call:** `chefChat()` — two-shot: first attempt at structured JSON `{ mode, reply, options, recommended_option_id }`, then a repair pass if envelope is incomplete/weak.

**After AI response:**
- `extractRefinementDeltaWithFallback()` — extracts structured ingredient/style changes
- `appendLockedSessionRefinementDelta()` — merges delta into locked session
- Persists: conversation turns, locked session, compiled brief (all fire-and-forget)
- Returns `session_action: "clear_locked_direction"` if user pivoted away

**Locked direction state machine** (`lib/ai/lockedSessionStore.ts`):
`exploring → direction_locked → ready_to_build → building → built`

---

### Path 4: Recipe Detail Chef Chat (`POST /api/ai/chef-chat`)

1. **Auth + rate limit** (20 req/5min)
2. **Topic guard** — `guardCookingTopic()`
3. **Turn analysis** — `analyzeRecipeTurn()` classifies intent (edit/options/question/save/clarify). Direction-locked detection reads conversation history for `/^Locked direction:/i` pattern match on assistant messages.
4. **Parallel execution** — `chefChatPromise` starts immediately; if `includeSuggestion && orchestration.shouldIncludeSuggestion`:
   - Ownership check (DB) → if fails, returns 403 (chefChatPromise abandoned — in-flight AI call is not cancelled)
   - `improveRecipePromise` starts in parallel with the running `chefChatPromise`
   - Note: `improveRecipe` here does NOT pass `cacheContext`, so identical requests are never cached (unlike the standalone `/api/ai/improve-recipe` route)
5. `await Promise.all([chefChatPromise, improveRecipePromise])`
6. **Chef Intelligence** — `buildChefIntelligence()` — lightweight rule engine detecting baking/sourdough/non-dairy context, generates `ChefInsight` objects
7. **Chef Actions** — `deriveChefActions()` — action buttons derived from message + reply
8. Conversation turns + brief persisted (fire-and-forget)
9. Returns `{ envelope, suggestion, orchestration, actions, chef_intelligence }`

---

### Chef Score / Fix System

**Score calculation** (`POST /api/chef-score/calculate`):
- `chefScoreStore.ts` orchestrates: loads rules from `chef_rules`, `chef_category_expectations`, `chef_score_profiles` tables (falls back to seed data from `chefCatalog.ts` if empty)
- `chefScoring.ts` — pure scoring engine: weighted subscores (flavor, technique, texture, harmony, clarity, risk, extras)
- Writes to `recipe_analysis`, `recipe_scores`, `recipe_score_factors`

**Fix generation** (`POST /api/chef-fix/generate`):
- Modes: `reliability` / `flavor` / `expert`
- `generateChefFixes()` — produces ranked fix recommendations from scoring output

**Fix application** (`POST /api/chef-fix/apply`):
- `applyChefFixActions()` mutates recipe steps/notes based on fix action types
- Creates new version via `create_recipe_version` RPC
- Persists fix session + actions to `recipe_fix_sessions`, `recipe_fix_actions`
- Recalculates score, revalidates Next.js cache tags (recipe detail/library/timeline)
- Returns score delta

**Design note:** `chef-fix/apply` calls `generateAndPersistChefFixes` (full recalculation) just to filter fixes by key. The client already has the fix list — this is redundant on apply.

---

### Core Generation Orchestrator (`lib/ai/recipeGenerationOrchestrator.ts`)

Currently shadow-mode only (see Path 1 shadow path). Per-family multi-stage pipeline:

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
| `lib/ai/taskSettings.ts` | Per-route model config (primary + fallback) from `ai_task_settings` table; 60s in-process cache (module-level, per-isolate) |
| `lib/ai/cache.ts` | SHA256-keyed response cache (`ai_cache` table); per-purpose TTLs: home_ideas=7d, home_recipe=30d, structure=90d |
| `lib/ai/userTasteProfile.ts` | Cached user preference summary injected into every generation; invalidated by zeroing `updated_at` to epoch |
| `lib/ai/recipeTelemetry.ts` | Structured timing/stage logs attached to generation results |
| `lib/ai/briefCompiler.ts` | Pure function: message + history → `CookingBrief` (dish family, required/forbidden ingredients, style, equipment, dietary tags) |
| `lib/ai/briefStateMachine.ts` | Classifies conversation turn as `explore | compare | revise | locked`; detects pivots |
| `lib/ai/lockedSession.ts` | `buildLockedBrief`: reconstructs `CookingBrief` from selected direction + refinements; `markLockedSessionBuilt` |
| `lib/ai/recipeOrchestrator.ts` | `analyzeRecipeTurn` (recipe detail), `analyzeHomeBuildRequest` (home build), `normalizeRecipeEditInstruction` |
| `lib/ai/chefIntelligence.ts` | Rule-based context detection (baking/sourdough/non-dairy); generates `ChefInsight` and `ChefEditAction` |
| `lib/ai/topicGuard.ts` | Keyword + regex guard; strong off-topic patterns checked first, then cooking signal count |
| `lib/ai/generationAttemptStore.ts` | Logs every build attempt (success/failure) to `ai_generation_attempts` |
| `lib/ai/recipeSessionStore.ts` | Per-recipe `CookingBrief` lifecycle; `seedRecipeSessionFromSavedRecipe` inherits from source conversation |
| `lib/recipes/recipeDraft.ts` | Canonical `RecipeDraft` shape — shared pre-persistence type; `normalizeAiIngredients` strips quantity/unit to `{name}[]` |
| `lib/recipes/canonicalEnrichment.ts` | Derives quantity/unit/prep on read (never persisted) |
| `lib/ai/recipeResult.ts` | `AiRecipeResult` wrapper around `RecipeDraft` with metadata |
| `lib/ai/launchDecisionMapper.ts` | Maps issue codes → `LaunchDecision` (SHOW_RECIPE, CLARIFY_INTENT, CONSTRAINT_CONFLICT, GENERATION_RECOVERY, HARD_FAIL, etc.) |

---

## Recipe CRUD Routes

| Route | Purpose |
|---|---|
| `POST /api/recipes` | Create recipe + v1 atomically (enforces free tier limit) |
| `GET/POST /api/recipes/[id]/versions` | Timeline slice or new version |
| `GET/PATCH/DELETE /api/recipes/[id]/versions/[versionId]` | Version detail, label/rating patch, or delete (guards last version) |
| `GET /api/recipes/[id]/versions/[versionId]/live` | Live cooking session state |
| `GET/POST /api/recipes/[id]/versions/[versionId]/grocery` | Grocery planning |
| `GET/POST /api/recipes/[id]/versions/[versionId]/prep-progress` | Step completion tracking |
| `PATCH /api/recipes/[id]/visibility` | Toggle public/private |
| `GET /api/recipes/browse` | Public recipe browse |
| `GET /api/recipes/sidebar` | Sidebar recipe list (cached) |

**Cache tags revalidated on mutation:** `getRecipeDetailTag`, `getRecipeLibraryTag`, `getRecipeSidebarTag`, `getRecipeTimelineTag`, `getRecipePhotosTag`

**After every new version:** `seedRecipeSessionFromSavedRecipe` inherits brief context from source conversation or parent recipe.

---

## Key DB Tables

| Table | Purpose |
|---|---|
| `recipes`, `recipe_versions` | Core recipe data; RLS by `owner_id` |
| `recipe_scores`, `recipe_analysis`, `recipe_score_factors` | Chef scoring data |
| `recipe_fix_sessions`, `recipe_fix_actions` | Fix history |
| `ai_cooking_briefs` | Per-conversation/recipe compiled briefs |
| `ai_locked_direction_sessions` | Home hub direction locking state |
| `ai_conversation_turns` | Full conversation history |
| `ai_generation_attempts` | Telemetry log of every build attempt |
| `ai_cache` | SHA256-keyed response cache |
| `ai_task_settings` | Admin-configurable model/temperature per task |
| `user_preferences`, `user_taste_profiles`, `user_taste_scores` | Personalization layer |
| `recipe_feedback` | Thumbs up/down signals |
| `meal_plan_entries` | Weekly meal planner |
| `chef_rules`, `chef_category_expectations`, `chef_score_profiles`, `chef_fix_strategies` | Chef scoring rule tables (seeded from `chefCatalog.ts` if empty) |

---

## Known Design Constraints

- **Debug events always emitted in production:** The build route always emits `type: "debug"` events (`brief`, `attempt_failed`, `terminal_failure`) to the NDJSON stream. `HomeHub.tsx` renders a `BuildDebugPanel` for any user who experiences a build failure — it shows model names, verification check details, and failure reasons. There is no `NODE_ENV` guard.

- **`lockedSessionSchema` duplicated:** Defined identically (~70 lines each) in both `/api/ai/home/route.ts` and `/api/ai/home/build/route.ts`. Should be extracted to a shared contracts file.

- **Shadow orchestrator minimal coverage:** `orchestrateRecipeGeneration` only runs in shadow when `macroTargets` is set. Most builds never exercise this path.

- **`analyzeRecipeTurn` direction detection is fragile:** Detects locked direction via `/^Locked direction:/i` string match on assistant messages — depends on the AI writing that exact prefix.

- **`taskSettings.ts` module cache:** `cachedSettings` is per-isolate in serverless. At low traffic, cold-starts will call `createSupabaseAdminClient()` on nearly every AI request.
