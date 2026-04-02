# M5 Planner Rules

Tickets 2.1, 2.2, 2.3, 2.5, 3.3, 4.1, 4.2, 5.1, 5.4, 6.1
Date: 2026-04-02

## Purpose

Define the bounded rule system for Milestone 5 before implementing the planner engine, assisted
UX, overlap scoring, grocery derivation, telemetry, and rollout.

M5 succeeds only if planner suggestions are:
- easier than planning manually
- trustworthy
- editable
- overlap-aware in a practical way
- coherent with grocery output
- useful for sparse-data users

---

## 1. Candidate suitability model

Planner candidate suitability is a bounded consumer model, not a source of truth.

### Inputs planner may use

- explicit user settings and hard constraints
- shared learned signals
- recipe quality signals
- lifecycle state
- post-cook outcomes
- effort / time suitability
- ingredient overlap potential
- accepted nearby calendar meals
- pantry assumptions from explicit settings only

### Inputs planner must not invent

- private learned preference derivation
- inferred pantry baseline for sparse-data users
- hidden recipe-truth semantics separate from shared product contracts

### Suitability dimensions

1. **Trust**
   - kept vs draft
   - viable non-draft vs weak/unproven version
   - quality signals

2. **Repeatability**
   - positive post-cook history
   - `would_make_again`
   - recent successful resurfacing

3. **Fit**
   - learned-pattern compatibility
   - explicit preference alignment
   - likely weeknight fit / effort fit

4. **Weekly usefulness**
   - overlap value
   - monotony risk
   - compatibility with already accepted nearby meals

### Suitability rules

- Weak or unproven recipes must not rank like strong repeat candidates.
- Default assisted planning excludes drafts.
- Learned signals may help rank candidates, but they do not hard-constrain.
- Candidate suitability must be deterministic enough for unit coverage.

---

## 2. Recipe-level vs version-level rules

### Default version behavior

- Planner schedules the latest viable non-draft version by default.
- Planner does not schedule the latest version purely because it is newest.

### Strong older kept version vs newer weak draft

- Strong older kept versions remain schedulable by default.
- Newer weak/unproven drafts do not suppress the recipe identity.

### `would_make_again = false`

Operational rule:
- primary effect: downrank the exact recipe version
- secondary effect: apply a light recipe-level caution only when no materially improved newer
  version exists
- recovery rule: a materially improved newer version should reduce or clear the caution

### Version-aware user-facing rule

- Planner UI may stay recipe-oriented while selecting a specific viable version under the hood.
- If needed in detail views, surface that the scheduled meal uses the best available version rather
  than blindly using "latest."

### Temporary lifecycle bridge rule

Because persisted planner-ready lifecycle truth is not yet fully exposed, M5 uses a temporary
planner eligibility bridge:

- explicit drafts are excluded from assisted planning
- explicit non-draft versions are eligible
- unknown lifecycle versions are cautionary, not fully trusted
- cautionary versions may only be used when stronger trust signals justify them
- stronger older viable versions remain preferred over weaker newer uncertain versions

This bridge rule should be retired once a stronger persisted lifecycle adapter exists.

---

## 3. Sparse-data fallback rules

Sparse-data fallback must be defined before engine finalization.

### Sparse-data inputs

- explicit preferences and constraints
- strong kept recipes
- favorites
- recent successful recipes
- simple recency heuristics
- basic effort balance

### Sparse-data exclusions

- no speculative pantry inference
- no draft-heavy exploration
- no overconfident learned-pattern language

### Sparse-data behavior

- default to strong kept recipes over experimental choices
- prefer simple, planner-safe weeknight candidates
- use explainable heuristics rather than weak pseudo-personalization

---

## 4. Week assembly strategy

### Planning scope

- M5 is dinner-first
- one primary dinner slot per day
- default assisted scope is 3 dinners
- broader fills are explicit entry modes

### Supported assisted strategies

- Plan 3 dinners for me
- Build an easy week
- Fill 5 weeknights
- Reuse ingredients this week
- Start from my favorites
- Leave one flexible night

### Week assembly rules

- avoid stacking multiple high-effort meals back to back
- balance heavier and lighter nights
- allow one or more intentional unfilled/flexible nights
- avoid repetitive cuisine/protein/format clustering when practical
- do not maximize overlap so aggressively that the week becomes monotonous

### Flexible-night rule

- a flexible night is simply an unfilled day
- no special persisted flex object in M5

### Build an easy week mode

- `Build an easy week` uses the same transient draft and accepted-plan persistence model as the
  base assisted canary.
- It does not expand the default planning scope beyond the current bounded assisted fill behavior.
- It prefers reliable low-effort dinners over novelty.
- It increases weight on:
  - lower prep/cook effort
  - stronger trust and quality
  - stronger repeat-worthiness
  - weeknight suitability
- It decreases weight on:
  - high-effort meals
  - cautionary lifecycle candidates
  - repeated `too_many_steps` / `too_complex` post-cook complaints
  - weak or recently negative outcomes
- It fails conservatively:
  - relax toward medium-effort trusted meals when needed
  - never pull in draft or excluded candidates just to fill count
  - keep the existing conservative assisted fallback state when confidence stays weak

### Partial regeneration rule

M5 partial regeneration operates only on transient planner draft state.

- accepted week remains unchanged until apply
- generated nights are regenerable by default
- manual, locked, and flexible nights are opt-in only
- targeted nights may be replaced only by candidates that still pass normal planner trust rules
- if no better replacement exists, the original suggestion is preserved
- partial regeneration must not introduce persisted planner draft state in M5

---

## 5. Explanation rules

Planner explanations should be short, useful, and non-creepy.

### Allowed explanation concepts

- quick weeknight fit
- strong repeat candidate
- reuses ingredients from another meal
- balances a heavier earlier meal
- good fit for what the user usually responds well to

### Not allowed

- identity-inferential or overly personal copy
- false certainty from weak evidence
- verbose system-logic dumps

### Explanation behavior

- explain the strongest plain-language reasons only
- keep wording consumer-safe
- degrade to generic, practical explanation when evidence is weak

---

## 6. Ingredient overlap model

Overlap must be meaningful, not cosmetic.

### Overlap may reward

- literal ingredient reuse
- shared prep components
- second-use produce or proteins
- conservative leftover opportunities
- perishability-aware reuse

### Overlap must discount or reject

- garnish-only reuse
- tiny token overlap that does not reduce shopping or prep load
- overlap that creates obvious monotony

### M5 modeling level

- use a lightweight rule layer only
- define practical perishability buckets
- define conservative second-use windows
- keep rules explainable and testable

### Overlap-aware weekly optimization rule

M5 uses overlap-aware weekly scoring to improve assisted weekly drafts.

- overlap scoring rewards meaningful ingredient and prep reuse
- overlap scoring must not weaken recipe trust or lifecycle rules
- overlap scoring must penalize monotony and trivial overlap
- overlap scoring should consider nearby accepted meals where relevant
- overlap explanations remain compact and planner-safe
- accepted week remains the source of truth for later grocery derivation

---

## 7. Grocery optimization rules

Week grocery is downstream of the accepted plan.

### Grocery derivation rules

- derive grocery from accepted `meal_plan_entries`
- reflect accepted servings overrides
- suppress pantry staples from explicit settings only
- merge overlapping ingredients where it truly reduces shopping load
- preserve grocery continuity with planner choices

### Planner to grocery continuity rule

In M5, weekly grocery is derived from the accepted weekly plan.

- `meal_plan_entries` remains canonical accepted plan state
- transient planner drafts do not drive grocery truth
- grocery aggregation uses accepted recipe/version selections and servings
- pantry suppression uses explicit user pantry settings only
- no persisted weekly grocery artifact is introduced in M5

### Grocery must not do

- become its own authoritative planning truth
- infer pantry assumptions for the user
- over-merge distinct items in ways that confuse shopping

---

## 8. Telemetry baseline and success framing

M5 must be judged against explicit before/after behavior, not vague intuition.

### Core comparison dimensions

- planner usage
- assisted-plan adoption
- week draft acceptance rate
- time-to-plan
- grocery generation from accepted plans
- manual override frequency
- repeat weekly planning behavior

### M5 telemetry events

- `planner_assisted_entry_used`
- `planner_week_draft_generated`
- `planner_week_draft_accepted`
- `planner_meal_swapped`
- `planner_partial_regeneration_used`
- `planner_manual_fallback_used`

### Additional useful measurements

- overlap score presence
- sparse fallback usage
- grocery generation from accepted plan
- edit intensity after draft generation

---

## 9. QA matrix boundaries

M5 QA must cover the full loop, not isolated helpers only.

### Required QA scenarios

- assisted entry modes
- sparse-data fallback
- version-aware selection behavior
- older strong kept version vs newer weak draft
- overlap-aware week scoring
- monotony prevention
- flexible-night handling
- partial regeneration while preserving untouched nights
- accepted-plan grocery derivation
- servings override impact on grocery output
- mixed-flag and flag-off behavior

---

## 10. Feature-flag rollout rules

### Proposed flags

- `PLANNER_ASSISTED_V1`
- `PLANNER_OVERLAP_V1`
- `PLANNER_GROCERY_OPT_V1`

### Rollout guidance

- assisted planning may launch before overlap/grocery optimization if needed
- overlap and grocery optimization can lag if quality is not ready
- rollout must be staged, observable, and reversible

---

## Immediate implementation consequences

1. Define sparse fallback before finalizing ranking engine behavior.
2. Build a planner-specific candidate query layer and version resolver.
3. Keep assisted drafts transient until user acceptance.
4. Keep accepted week persistence on `meal_plan_entries`.
5. Keep week grocery as a derived view from accepted plan state.
6. Keep planner explanation logic bounded and reason-code driven.
