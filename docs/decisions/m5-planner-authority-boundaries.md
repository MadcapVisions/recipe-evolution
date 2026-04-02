# M5 Planner Authority Boundaries

Ticket 1.1 / 1.3 — Backend / AI
Date: 2026-04-02

## One-sentence answer

**Planner is a consumer of shared product intelligence, not a second private preference or recipe-truth system.**

---

## Signal hierarchy (what wins where)

1. **Explicit user constraints and settings** (`user_preferences`)
   - Dietary restrictions, pantry exclusions, equipment limits, and explicit preferences remain the
     highest authority.
   - Planner may not override them.

2. **Accepted plan state** (`meal_plan_entries`)
   - Canonical persisted planner truth for accepted weekly meals.
   - M5 does **not** introduce a second persisted week-draft truth by default.

3. **Canonical recipe/version truth**
   - Recipe meaning: `ResolvedCookingIntent`
   - Planning quality: `CulinaryBlueprint`
   - Recipe quality/trust: validation + scoring outputs
   - Cooked-outcome truth: `recipe_postcook_feedback`
   - Planner consumes these signals; it does not redefine them.

4. **Shared learned signals** (`getLearnedSignals`, `LearnedSignals`)
   - Shared ranking/suggestion signals for personalization.
   - May rank and suggest, but do not hard-constrain.

5. **Planner suitability and week assembly**
   - Planner-specific consumer logic that combines the sources above for a weekly context.
   - This is where ranking, effort balance, overlap, and sparse fallback are applied.

---

## What planner owns

Planner owns:
- candidate suitability for the weekly-planning use case
- version-aware meal selection rules for scheduling
- week assembly and effort balancing
- overlap-aware weekly optimization
- bounded suggestion explanations
- accepted-plan-to-grocery derivation

Planner does **not** own:
- learned preference derivation
- semantic interpretation of what recipes mean
- recipe quality truth
- post-cook truth
- pantry inference beyond explicit settings

---

## Canonical M5 persistence rules

### Accepted weekly plan
- `meal_plan_entries` remains the canonical persisted truth.
- Accepted weekly plans are written there.

### Assisted planner draft
- Assisted planner drafts remain transient in UI or request-local state in M5.
- Partial regeneration mutates only targeted nights in transient draft state.
- On acceptance, the backend may still persist by replacing the full selected date range in
  `meal_plan_entries`.

### Flexible nights
- A flexible night is an intentional absence of a meal entry.
- M5 does not add a persisted "flex slot" object.

### Week grocery
- Week grocery remains a derived consequence of accepted `meal_plan_entries`.
- M5 does not add a persisted week-grocery artifact by default.

---

## Core consumer rules

### Shared learned signals
- Planner reads shared learned signals from `lib/ai/learnedSignals.ts`.
- Planner must not recompute learned preferences independently.
- Planner suggestions may differ from Create or Library because the use case differs, but signal
  semantics must remain shared.

### Recipe quality and trust
- Planner consumes recipe quality signals from earlier milestones.
- Weak or unproven recipes must not be treated as equal to strong repeat candidates.
- Planner must behave like a trust surface, not a novelty surface.

### Post-cook outcomes
- Planner uses post-cook outcomes as resurfacing/suitability signals where relevant.
- `would_make_again = false` primarily downranks the exact recipe version.
- Planner may apply a light, temporary recipe-level caution only when no materially improved newer
  version exists.

### Draft lifecycle
- Drafts are excluded from default assisted planning in M5.
- M5 does not treat "good-looking drafts" as default planner candidates.
- Experimentation-oriented draft inclusion is future work, not default planner behavior.

---

## Version selection rules (locked for M5)

### Default selection
- Planner should generally schedule the latest viable non-draft version by default.
- It should not schedule the latest version purely because it is newest.

### Weak new draft vs strong older kept version
- A newer weak or unproven draft does not suppress the recipe identity.
- A strong older kept version remains schedulable by default.

### Version-aware trust behavior
- Planner is allowed to fall back from the newest version to the strongest viable kept version.
- User-facing planner surfaces should remain recipe-oriented while scheduling a specific viable
  version under the hood.

---

## Weekly-planning scope rules

- M5 is dinner-first.
- One primary dinner slot per day.
- Default assisted scope is **3 dinners**, not 5 or 7.
- Broader fills are explicit planner modes, not the default.

---

## Overlap and calendar-awareness rules

- Overlap must be meaningful.
- Planner should consider:
  - actual ingredient reuse
  - perishability
  - pantry assumptions from explicit settings only
  - shared prep components
  - leftovers / second-use opportunities
  - monotony avoidance
- Planner must not reward garnish-only or trivial overlap.

Planner overlap scoring must consider both:
- the proposed assisted draft
- already accepted nearby meals on the calendar when relevant

---

## Sparse-data rule

- Sparse-data fallback must be defined before finalizing the ranking engine.
- Planner must remain useful for users with thin learned data.
- Sparse fallback uses explicit settings, strong kept recipes, recency, and simple planner-safe
  heuristics.

---

## Explanation rule

- Planner explanations must remain consumer-safe, short, and bounded.
- They may explain suitability in plain terms.
- They must not overstate confidence or sound identity-inferential.

---

## Not open for re-debate in M5

- Introducing a second persisted weekly-truth model before needed
- Treating planner as a private learned-preference engine
- Defaulting to the newest version regardless of trust
- Letting weak drafts flood assisted planning
- Inferring pantry staples for users without explicit pantry settings
- Persisting flexible nights as a special object
- Persisting week grocery as a separate authoritative truth

---

## See also

- `docs/decisions/product-authority-map.md`
- `docs/m4-learning-authority.md`
- `docs/decisions/authority-boundaries.md`
- `docs/decisions/m3-authority-boundaries.md`
