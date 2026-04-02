# MealMax Roadmap Snapshot

> Internal reference for milestone status, completed work, and what remains.
> Last updated: 2026-04-02

---

## Milestone 1: Start Better

**Goal**

Fix recipe creation stability and reduce friction at the start of the flow.

**Completed**
- canonical semantic intent direction established
- safer dish-family handling
- session contamination and pivot-reset logic defined
- retry/failure behavior redesigned around typed recovery
- Draft lifecycle introduced for Max-generated recipes
- guided Create entry approach established

**Product impact**

Create is no longer supposed to behave like an unstable blank-chat generator. It is the start of a structured recipe flow.

**Status**

Complete

---

## Milestone 2: Generate Better

**Goal**

Make recipes more coherent, intentional, and worth cooking.

**Completed**
- Culinary Blueprint planning layer established
- ingredient-role and method-planning structure introduced
- structural vs culinary validation split
- quality/trust scoring direction clarified
- sidecar persistence for generation artifacts
- Recipe Detail hierarchy improved
- My Recipes moved toward Draft/Kept-aware behavior

**Product impact**

Recipe generation is no longer just “AI output.” It is supposed to be planned, validated, and scored.

**Status**

Complete

---

## Milestone 3: Cook Better

**Goal**

Make MealMax useful during cooking, not just before cooking.

**Completed**
- structured Cooking Coach contract defined
- deterministic/rule-based coaching layer established
- rescue taxonomy introduced
- in-session rescue split cleanly from future-version improvement
- pre-cook guidance block added conceptually to Recipe Detail
- step-linked cook-mode cueing and rescue architecture defined
- coaching sidecar persistence added

**Product impact**

Recipes became more actionable and safer to cook, with better support when things go wrong.

**Status**

Complete

---

## Milestone 4: Learn Better

**Goal**

Use real cooked outcomes and user behavior to improve future suggestions, improvement flows, resurfacing, and personalization.

### 4A: Data Foundation

**Completed**
- authority docs written
- canonical post-cook feedback type system added
- dedicated `recipe_postcook_feedback` event table added
- M4 feature flags added
- post-cook API route added
- taste-model extensions added
- post-cook mapping layer added
- `userTasteProfile` wired to learned score state
- shared learned-signal interface added:
  - `getLearnedSignals`
  - `LearnedSignals`
- cache invalidation / route wiring added
- admin stats / rollout checklist added

**Status**

Complete

### 4B: Post-Cook Feedback UX

**Intended scope**
- lightweight post-cook flow
- cook-completion entry
- revisit reminder
- post-cook analytics
- improve-next-step CTA

**Status**

In progress / depends on current implementation state. Use the current M4 plan docs and code to confirm final completion.

### 4C: Learning Pipeline

**Intended scope**
- post-cook events to learned scores
- repeated-event weighting
- shared learned-signal contract and delivery path
- summary generation from learned state
- sparse-data behavior

**Status**

Foundation complete, confirm final consumer/hardening state. 4A already established the core load-bearing pieces.

### 4D: Product Consumers

**Intended scope**
- Improve with Max uses post-cook outcomes
- My Recipes resurfacing uses learned signals
- Create personalization uses learned signals

**Status**

Depends on implementation progress after 4A. Use M4 product-consumer tickets to confirm final state.

### 4E: Settings, Telemetry, QA, Rollout

**Intended scope**
- learned-preferences visibility policy
- milestone telemetry model
- observability
- QA matrix
- rollout rules

**Status**

Partially complete / verify current state. 4A established core flags and rollout scaffolding.

**Milestone 4 overall product impact**

MealMax stopped being only a generator and started becoming a system that can learn from real cooking.

**Milestone 4 status**

Substantially complete at foundation level. Verify B–E closeout if not already finalized.

---

## Milestone 5: Plan Better

**Goal**

Turn the planner into an assistant-led weekly planning system.

**Completed so far**
- planner authority/rules docs added
- planner module audit added
- M5 feature flags added
- deterministic planner engine added
- planner-specific candidate loader added
- lifecycle bridge adapter added
- first assisted canary added behind `PLANNER_ASSISTED_V1`
- `Build an easy week` mode added
- compact planner reasons/explanation chips added
- planner analytics added
- sparse fallback state added
- first-pass partial regeneration added
- overlap-aware weekly optimization added
- planner to accepted week to derived grocery continuity added
- planner E2E path now runs green under fixed `next start`
- unit coverage exists for:
  - engine
  - candidates
  - lifecycle bridge
  - regeneration
  - overlap
  - planner grocery

**Implementation note**

M5 closeout included a compatibility guard so missing `recipe_postcook_feedback` schema visibility degrades to empty feedback instead of crashing planner candidate loading in production-like runtime. This was required to get the planner E2E path green. Closeout also fixed stale Playwright `next start` server reuse and feature-flag cache contamination in the long-lived E2E runtime.

**Still to finish before close**
- formal M5 QA matrix
- final telemetry/observability review
- explicit documentation of compatibility fallback if needed
- controlled canary rollout
- optional decision on whether to add `Start from my favorites` before closing milestone

**Product impact**

Planner now has a real assisted planning loop instead of being only manual weekly CRUD.

**Status**

Near complete, in closeout / rollout phase

---

## Milestone 6: Unify Better

**Goal**

Collapse transitional architecture, remove duplicated logic, standardize cross-surface behavior, and retire milestone-era scaffolding.

**Planned work**
- final authority map after M1–M5
- legacy / adapter audit
- shared service consolidation
- shared recommendation semantics
- cross-surface explanation consistency
- Create / Library / Planner / Improve / Settings unification pass
- legacy cleanup and flag retirement
- cross-surface consistency QA
- recommendation drift observability
- rollout/rollback control for cleanup changes

**Product impact**

MealMax should finally feel like one coherent system instead of multiple intelligent subsystems.

**Status**

Planned, not started

---

## Overall Roadmap Status

**Complete**
- Milestone 1
- Milestone 2
- Milestone 3

**Built and foundationally strong**
- Milestone 4A
- much of Milestone 4’s intelligence layer likely depends on current completion of B–E

**Near release**
- Milestone 5

**Next major milestone**
- Milestone 6

---

## Recommended Next Sequence

**Immediate**
1. finish M5 closeout
2. QA matrix
3. telemetry review
4. canary rollout
5. closeout decision on optional favorites mode

**Then**
1. start Milestone 6
2. authority map
3. legacy audit
4. contract/service consolidation
5. cross-surface behavior unification

---

## Big-Picture Product State

MealMax is evolving from:
- recipe generator

into:
- recipe generator
- cooking guide
- learning system
- weekly planning assistant

Milestone 6 is the point where all of that either becomes one coherent product, or starts drifting into inconsistent smart subsystems.
