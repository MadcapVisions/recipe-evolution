# MealMax M4 Learning Authority Boundaries

## Signal hierarchy (what wins where)

1. **Hard constraints** (Settings / `user_preferences`): dietary restrictions, equipment limits,
   pantry exclusions — always authoritative, never overridden by learned behavior.
2. **Explicit preferences** (`user_preferences`): favorite cuisines, proteins, flavors,
   spice tolerance — authoritative for defaults.
3. **Post-cook outcomes** (`recipe_postcook_feedback`): real cooked-outcome events —
   canonical source of truth for "I made this and here is how it went."
4. **Learned scores** (`user_taste_scores`): structured −1/+1 scores per taste dimension —
   derived from all feedback types; influences ranking/suggestions, never overrides constraints.
5. **Taste summary** (`user_taste_profiles`): rendered text built from learned scores —
   descriptive aid, not hard fact. Surface with cautious language when evidence is sparse.
6. **Lightweight reactions** (`recipe_feedback`): thumbs-up/down — remain active and feed
   taste scores with lower weight than post-cook events.

## Module disposition

| Module | Disposition | Role |
|---|---|---|
| `lib/ai/tasteModel.ts` | reuse + extend (M4 adds 2 optional dims) | learned-signal producer |
| `lib/ai/userTasteProfile.ts` | refactor to consume `user_taste_scores` | rendered summary output |
| `POST /api/taste/feedback` | reuse directly | lightweight reaction input |
| `POST /api/taste/scores` | reuse directly | learned-signal read |
| `POST /api/taste/why-fits` | reuse directly | explanation-only output |
| `recipe_feedback` table | freeze for legacy | lightweight reaction input |
| `recipe_postcook_feedback` (new) | canonical post-cook event store | post-cook outcome input |
| `lib/ai/learnedSignals.ts` (new) | shared delivery interface | suggestion/ranking consumer |
| `lib/recipeSidebarData.ts` | wrap in Plan B | suggestion/ranking consumer |
| home suggestion builders | wrap in Plan D | suggestion/ranking consumer |
| Create-page suggestion source | wrap in Plan D | suggestion/ranking consumer |

## Rules

- Learned behavior cannot outrank explicit dietary, equipment, or pantry constraints.
- `would_make_again = false` reduces resurfacing appeal for that recipe version shape only.
  It is not a broad cuisine dislike and must not be treated as one.
- Learned summaries use hedged language when `getOverallConfidenceLevel` returns "medium".
  They return empty string when it returns "low".
- Create, Library, Planner, and Settings consume learned signals via `learnedSignals.ts`.
  They do not recompute their own private learning logic.

## Storage decision (locked — not open for re-debate)

Post-cook feedback uses a dedicated `recipe_postcook_feedback` event table.
`recipe_feedback` (thumbs-up/down) remains unchanged.
These two tables are not merged at the storage layer.
Each post-cook cooking outcome is stored as a new INSERT row (event model, not upsert).
