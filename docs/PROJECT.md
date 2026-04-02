# Recipe Evolution — Project Reference

> Internal reference. Updated whenever major features are added, changed, or removed.
> Last updated: 2026-04-02

See also:
- `docs/roadmap-snapshot.md` for the Milestones 1–6 status snapshot and immediate sequence
- `docs/decisions/product-authority-map.md` for the locked Milestone 1–4 product and contract baseline
- `docs/decisions/authority-boundaries.md` for Milestone 2 contract ownership
- `docs/decisions/m3-authority-boundaries.md` for Milestone 3 coaching ownership
- `docs/m4-learning-authority.md` for Milestone 4 learning-signal hierarchy
- `docs/decisions/m5-planner-authority-boundaries.md` for Milestone 5 planner signal hierarchy and persistence rules
- `docs/decisions/m5-planner-module-audit.md` for Milestone 5 planner/grocery module disposition
- `docs/decisions/m5-planner-rules.md` for Milestone 5 planner ranking, overlap, grocery, QA, and rollout rules

---

## What this app is

An AI-powered recipe creation and evolution app. Users have chef conversations that guide an AI into generating recipes. Those recipes are saved with full version history — every iteration is kept. Users can improve, remix, fork, and cook recipes, and the AI learns their taste over time.

---

## Current features

### Recipe creation (Home Hub)
- Multi-turn chef conversation — user describes what they want, AI asks clarifying questions
- Direction selection — AI surfaces 3 concrete recipe directions, user picks one
- Locked direction — once a direction is chosen, the brief is locked and recipe generation begins
- Recipe brief compiler — extracts dish family (60 families), required/forbidden ingredients, protein, anchor ingredient
- Recipe verifier + repair loop — AI output is verified against the brief; retried up to N times if it drifts
- Dish family detection — 60 families covering every major food category (see `lib/ai/homeRecipeAlignment.ts`)
- Fallback title derivation — generates a reasonable working title from conversation context if AI doesn't name the dish

### Recipe library
- Saved recipe list with search
- Recipe favoriting (mark best version)
- Recipe forking (create new recipe from an existing version, with lineage tracking)
- Ingredient-based search across all recipes
- Recipe visibility states: hidden, archived
- Custom category / dish family (user-settable per recipe)
- Recipe renaming (inline, from recipe page)

### Recipe versioning
- Every AI-generated or user-saved iteration is a numbered version
- Version timeline with lazy load (8 at a time)
- Version labels (rename individual versions)
- Version favoriting (mark best version within a recipe)
- Version deletion
- Change log / change summary per version
- Chef tips (stored as version notes)
- Fork from suggestion (creates a new recipe from a Chef Workshop suggestion)

### Recipe detail page
- Full ingredient list with canonical enrichment (quantities derived on read)
- Adjustable servings (scales ingredients live)
- Step-by-step instructions
- Prep plan panel (generated from steps, with checkboxes)
- Cook mode (full-screen step-by-step)
- Nutrition facts panel (AI-generated, cached)
- Photo gallery (upload, view, delete)
- Share recipe (copy link)
- Version history dropdown
- Recipe switch dropdown (navigate between recipes)
- "Version frame" summary card (recipe name, stage, intent)

### Chef Workshop (recipe improvement)
- AI-powered improvement chat on existing recipes
- Direction selection (same pattern as Home Hub)
- Generates a suggested change with full recipe diff
- One-click apply → saves as new version
- Fork suggestion → saves as new recipe

### Meal planner
- Weekly grid (Mon–Sun)
- Add any recipe version to any day
- Navigate from planner directly to recipe page

### Grocery list
- Aggregates ingredients from planned meals
- Grouped by category

### Admin panel (`/admin`)
- AI task settings — configure model, max tokens, temperature per task
- AI usage logs and cost tracking
- Per-route rate limit metrics
- Model recommendations with benchmark annotations

### AI cost tracking
- Per-user token usage logged to `ai_usage_log`
- Visible in admin

### User taste profiles
- Conversation turns persisted to `ai_conversation_turns`
- Feeds `user_taste_profiles` (used as context in chef conversation prompts)

---

## Planned / in-progress

- **Taste profile integration** — `user_taste_profiles` exists in DB but not yet wired into recipe generation prompts
- **Remove debug panel from create page** — test-only UI, not for production
- **Recipe improvement JSON reliability** — occasional parse failures with some models; needs prompt hardening
- **Chef chat context length** — chef_chat maxTokens at 600, may truncate long multi-turn conversations
- **Re-run model benchmarks** — after Gemini 2.5 Flash prefix-match fix, benchmarks need re-running to validate recommendations
- **Category browsing** — filter/browse recipe library by dish_family (column now exists, UI not built)
- **Multi-axis recipe tagging** — dish_family covers format but not cooking method or course; future work
- **Recipe sharing / public pages** — share link exists but public recipe view not built

---

## Architecture

### Stack
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Storage, RLS)
- **AI:** OpenRouter (primary), fallback support for OpenAI / Anthropic / Gemini direct

### Directory layout
```
app/
  api/ai/          — AI API routes (chef-chat, home, home/build, chef, nutrition, prep-plan)
  api/recipes/     — Recipe CRUD API
  api/admin/       — Admin-only API
  admin/           — Admin UI pages
  recipes/         — Recipe pages (list, detail, cook mode, new)
  planner/         — Meal planner page
  grocery/         — Grocery list page
components/
  home/            — Home Hub (chef conversation UI + AI hook)
  recipes/         — Recipe library + version detail components
  shell/           — App shell, sidebar, nav
  admin/           — Admin UI components
  forms/           — New recipe forms
lib/
  ai/              — AI engines, prompts, contracts, evals
  recipes/         — Recipe data processing (canonical enrichment, prep plan, servings)
  auth/            — Auth helpers, admin access guard
  supabase/        — Supabase client factories
supabase/
  migrations/      — SQL migration files (source of truth for schema)
```

### Key data flow: recipe creation
```
User types in HomeHub chat
  → useHomeHubAi (React hook)
  → POST /api/ai/home (chef conversation + direction selection)
    → homeHub.ts → buildChefConversationMessages → OpenRouter
    → Returns: directions[] or free_chat message
  → User picks direction → direction locked
  → POST /api/ai/home/build (recipe generation)
    → briefCompiler.ts → builds CookingBrief (dish_family, ingredients, constraints)
    → homeHub.ts → buildRecipeGenerationPrompt → OpenRouter
    → recipeVerifier.ts → verifies output matches brief
    → recipeRepair.ts → retries if verification fails (up to AI_MAX_RETRIES)
    → Returns: AiRecipeResult
  → createRecipeFromDraft() → POST /api/recipes
    → create_recipe_with_initial_version RPC → saves recipe + v1 atomically
  → Router pushes to /recipes/[id]/versions/[versionId]
```

### Key data flow: recipe improvement (Chef Workshop)
```
User types improvement request on recipe detail page
  → VersionDetailClient → useRecipeAssistant
  → POST /api/ai/chef-chat
    → Returns: directions[] or message
  → User picks direction
  → POST /api/ai/chef (recipe improvement)
    → lockedSession.ts → builds improvement context
    → Returns: SuggestedChange (full new recipe + explanation)
  → User clicks "Apply" → createRecipeVersionViaApi()
    → POST /api/recipes/[id]/versions → create_recipe_version RPC
  → Or "Fork" → createRecipeFromDraft() with new title
```

### Caching
- All AI responses cached in `ai_cache` table, keyed by SHA256 of (route + prompt)
- Recipe data uses Next.js fetch cache with revalidation tags per user/recipe
- Cache tags: `recipe-library:{userId}`, `recipe-sidebar:{userId}`, `recipe-version:{versionId}`, etc.

### Rate limiting
- Per-route limits stored in `ai_rate_limits` table
- `check_ai_rate_limit` RPC: atomically checks and increments, returns allowed/blocked
- Limits configurable per route via admin panel

---

## AI task map

| Task key | Route | What it does | Key file |
|---|---|---|---|
| `chef_chat` | `/api/ai/chef-chat` | Multi-turn chef conversation on existing recipe | `lib/ai/chefChat.ts` |
| `home_chat` | `/api/ai/home` | Home Hub chef conversation + direction selection | `lib/ai/homeHub.ts` |
| `home_recipe` | `/api/ai/home/build` | Recipe generation from locked brief | `lib/ai/homeHub.ts` |
| `recipe_improvement` | `/api/ai/chef` | Generate suggested improvement from direction | `lib/ai/recipePlanner.ts` |
| `recipe_structuring` | `/api/ai/structure` | Parse raw text into structured recipe | `lib/ai/recipeStructurer.ts` |
| `nutrition` | `/api/ai/nutrition` | Generate nutrition facts for a recipe | `lib/ai/nutritionFacts.ts` |
| `prep_plan` | `/api/ai/prep-plan` | Generate prep plan from recipe steps | `lib/ai/prepPlan.ts` |

### Dish family detection (60 families)
Defined in `lib/ai/homeRecipeAlignment.ts → detectRequestedDishFamily()`.

Categories:
- **Baked goods:** cookies, brownies_bars, muffins_scones, cake, pastry, fried_pastry, dessert_bread, bread, pie, tart
- **Desserts:** frozen_dessert, custard_pudding, candy_confection, dessert
- **Pizza/bread:** pizza, flatbread
- **Pasta/noodles:** pasta, noodle_soup, stir_fry
- **Mexican:** tacos, tamales
- **Soups/stews:** soup, chili, curry
- **Grains/rice:** rice, grains, salad
- **Condiments:** dips_spreads, sauce_condiment
- **Egg/breakfast:** egg_dish, pancakes_crepes, savory_pancake, porridge_cereal, breakfast
- **Sandwiches:** burger, sandwich, wraps, spring_rolls
- **Filled/baked:** dumplings, savory_pastry, pot_pie, casserole, stuffed
- **Proteins:** grilled_bbq, fried, meatballs_ground_meat, braised, sushi_raw, raw_cured, seafood_fish, chicken_poultry, sausage, tofu_tempeh, beans_legumes
- **Sides:** fritters_patties, steamed, roasted, potato, vegetable_side, skillet
- **Other:** bowl, beverage, preserve, pickled_fermented, appetizer_snack, board_platter, souffle, fondue

---

## Database schema (key tables)

```
recipes
  id, owner_id, title, description, tags[], dish_family,
  is_favorite, best_version_id, forked_from_version_id,
  created_at, updated_at

recipe_versions
  id, recipe_id, version_number, version_label,
  servings, prep_time_min, cook_time_min, difficulty,
  ingredients_json ({name}[]), steps_json ({text}[]),
  notes, change_log, change_summary, rating,
  ai_metadata_json, canonical_ingredients, canonical_steps,
  created_at

ai_conversation_turns    — persisted chat history per recipe/session
user_taste_profiles      — derived user preferences from conversations
ai_cache                 — SHA256-keyed AI response cache
ai_rate_limits           — per-route rate limit counters
ai_task_settings         — per-task model/token/temperature config (admin)
ai_usage_log             — per-request token cost tracking
recipe_visibility_states — hidden/archived state per recipe
cook_sessions            — cook mode progress tracking
version_photos           — photos attached to recipe versions
meal_plan_entries        — weekly meal plan (recipe + day + user)
prep_progress            — per-step checkbox state during cook mode
```

---

## Canonical enrichment

`ingredients_json` and `steps_json` on `recipe_versions` store **text only** (`{name: string}[]`, `{text: string}[]`). Quantity/unit/prep data is parsed and enriched on read via `lib/recipes/canonicalEnrichment.ts`. This means the raw DB storage never needs migration when enrichment logic improves.

---

## Major changes log

| Date | Change |
|---|---|
| 2026-03-23 | Dish family taxonomy expanded from 28 → 60 families; fixed misclassifications; recipe rename + custom category on recipe pages; dish_family column added to recipes table |
| 2026-03-22 | AI cost tracking per user (ai_usage_log); recipe fork lineage (forked_from_version_id) |
| 2026-03-22 | AI-powered Nutrition Facts panel on recipe page |
| 2026-03-22 | Ingredient-based recipe search |
| 2026-03-21 | Locked direction sessions (direction context persisted across turns) |
| 2026-03-20 | AI recipe reliability improvements: brief compiler, verifier, repair loop, recipe alignment |
| 2026-03-18 | Chef tips in recipe output; recipe description on detail page |
| 2026-03-18 | AI task settings admin panel; model recommendations with benchmark data |
| 2026-03-18 | Ravioli bug fix (user message dropped from locked direction context) |
| 2026-03-03 | Initial schema: recipes, recipe_versions, meal_plan, grocery, ai_conversation_turns, user_taste_profiles |
