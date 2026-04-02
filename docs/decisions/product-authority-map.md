# Product Authority Map — Milestones 1–4

**Purpose:** One compact reference for what is already decided, which contracts are authoritative,
and which topics are not open for re-debate during implementation and review.

Use this document as the top-level baseline. For milestone-specific details, follow the linked
authority docs.

---

## Product direction

The app is moving from mostly prompt-driven recipe generation toward a structured cooking product
that helps users:

1. Start fast
2. Shape the right dish
3. Generate a strong recipe
4. Cook with confidence
5. Improve over time
6. Return because the product visibly learns

The main screen architecture remains:

- Homepage / sales page
- Create
- Recipe Detail
- My Recipes
- Weekly Planner
- Settings
- Admin hidden from users

What changed across Milestones 1–4 is the intelligence, contracts, and persistence under those
surfaces.

---

## Canonical contract stack

### `ResolvedCookingIntent`
**Owns:** semantic meaning.

Use it for:
- user intent
- dish identity
- ingredient mentions
- pivot state
- constraints and premise trust

Do not use session state, locked session, route-local parsing, or `CookingBrief` as semantic
authority in migrated flows.

### `CulinaryBlueprint`
**Owns:** culinary planning.

Use it for:
- flavor architecture
- components
- ingredient roles
- primary method
- sequence/checkpoints
- finish strategy
- feasibility

Do not let legacy planning modules override blueprint decisions in migrated flow.

### Recipe draft / result
**Owns:** the cookable recipe artifact.

Use it for:
- title
- ingredients
- steps
- servings
- timing

Do not treat the draft/result as the planning authority.

### Validation + scoring
**Own:** recipe quality judgments.

Validation layers:
- structural validity
- culinary coherence

Scoring layers:
- chef score
- delight score

Milestone 2 rule:
- delight score supplements chef score
- it does not replace chef score by default

### `CookingCoach`
**Owns:** deterministic cook-time guidance.

Use it for:
- pre-cook guidance
- step-linked cues
- mistake prevention
- in-session recovery moves

Do not use it for:
- planning
- scoring
- validation
- future recipe-improvement logic

### `LearnedSignals` / `getLearnedSignals`
**Own:** shared learned behavior delivery to product surfaces.

Use them for:
- personalization
- ranking
- resurfacing
- learned suggestion shaping

Do not let product surfaces recompute their own learning logic.

---

## Milestone decisions that are locked

### Milestone 1 — Start Better

Locked product decisions:
- Create is guided-entry plus chat, not blank-chat-only
- Max-generated recipes start as Drafts
- Drafts can be improved and cooked before being kept
- `Improve with Max` is the primary improvement label
- canonical semantic interpretation comes from one shared resolver

Locked architectural rules:
- `ResolvedCookingIntent` is canonical for migrated generation flows
- `BuildSpec` may remain a temporary downstream execution bridge
- `CookingBrief` is legacy compatibility context only in migrated flows
- session/locked-session persistence is not semantic authority

Do not reintroduce:
- regex-only dish-family fallback that silently defaults into harmful categories
- route-specific semantic reconstruction
- constraint contamination across dish pivots
- retry behavior that stacks contradictory notes without typed failure handling

### Milestone 2 — Generate Better

Locked product decisions:
- generation is planned before drafted
- recipe quality is judged in layers
- Recipe Detail must quickly answer what this recipe is, why this version is good, and what to do next
- migrated planning/validation/scoring should consolidate existing systems rather than create a parallel stack

Locked architectural rules:
- `ResolvedCookingIntent` owns meaning
- `CulinaryBlueprint` owns culinary planning
- ingredient roles are expected in migrated flow
- `RecipePlan` is not authoritative in migrated flow
- blueprint/validation/scoring data persist in sidecar storage, not by bloating core recipe version rows

### Milestone 3 — Cook Better

Locked product decisions:
- cook-time guidance must be structured, not generic filler
- Cook-mode rescue is for saving the current dish now
- `Improve with Max` / chef-fix remains for improving the recipe for next time
- pre-cook guidance must not duplicate the Milestone 2 quality summary
- coaching is deterministic and rule-based in M3

Locked architectural rules:
- `CookingCoach` is a separate authority with narrow scope
- structured chef rules and rescue taxonomy are auditable
- coaching artifacts persist in sidecar storage linked to recipe version
- rescue UI must not pretend certainty when no exact guidance exists

### Milestone 4 — Learn Better

Locked product decisions:
- Milestone 4 is split into Plans A–E
- post-cook outcomes are a distinct signal class from lightweight reactions
- post-cook uses dedicated event storage
- `userTasteProfile.ts` must read learned score state rather than remain a disconnected path
- all product consumers use one shared learned-signal interface

Locked architectural rules:
- `recipe_feedback` remains lightweight reaction storage
- `recipe_postcook_feedback` stores real cooked-outcome events
- repeated post-cook submissions are append-only event rows, not overwrites
- post-cook issue tags map through a dedicated mapping layer, not old `FeedbackReason`
- learned signals are descriptive ranking signals, not hard user facts

---

## Product-surface rules

### Create
- Must preserve guided-entry plus chat
- Should use learned-pattern signals for chips, quick-start copy, and likely dinner suggestions
- Must keep sane fallback behavior for sparse-data users
- Learned signals rank and shape suggestions; they do not hard-constrain explicit settings

### Recipe Detail
- The top-level hierarchy is:
  - action band
  - confidence block
  - deep detail layers
- M2 summary answers why this version is good
- M3 pre-cook block answers what matters when you cook it
- Improvement action label remains `Improve with Max`

### Cook Mode
- Uses step-linked cues and rescue entry points
- Rescue guidance is for the current dish only
- Must fall back honestly when no exact rescue scenario exists

### My Recipes
- Should recognize living recipes with evolving versions
- Should move beyond pure chronology toward behavior-smart shelves
- Draft/Kept visibility and quick actions remain part of the direction

### Settings
- Explicit preferences are highest authority for hard constraints
- Learned-preferences visibility is conditional/stretch in M4, not automatically committed
- No learned-preference UI ships without data-quality review

---

## Data and signal hierarchy

From highest authority downward:

1. Hard constraints and explicit user settings
2. Canonical semantic interpretation (`ResolvedCookingIntent`)
3. Post-cook outcomes as event truth for cooked results
4. Learned score state
5. Rendered summaries such as taste-profile text
6. Lightweight reactions as lower-weight signals

Operational rule:
- learned behavior can influence ranking, resurfacing, and suggestion shaping
- learned behavior must not override dietary, equipment, pantry, or other hard constraints

---

## Not open for re-debate

- Reverting Create back to blank-chat-only
- Treating saved session state as semantic authority
- Letting legacy planning contracts outrank `CulinaryBlueprint`
- Treating `CookingCoach` as a second hidden planning or scoring system
- Merging post-cook outcome storage into lightweight reaction storage
- Stuffing post-cook issue tags into legacy `FeedbackReason`
- Allowing consumer surfaces to invent private learned-signal logic
- Treating one bad cook event as a permanent broad dislike claim
- Shipping personalization copy that sounds identity-inferential or creepy

---

## Dependencies future work should assume

- Migrated generation depends on `ResolvedCookingIntent`
- Strong recipe drafting depends on `CulinaryBlueprint`
- Cook-mode guidance depends on `CookingCoach`
- Learned personalization depends on `LearnedSignals` / `getLearnedSignals`
- Sidecar persistence is the preferred pattern for blueprint, validation, coaching, and related
  structured intelligence artifacts
- Rollout, invalidation, telemetry, and reversibility are first-class requirements for Milestone 4
  consumer work

---

## Source documents

- `docs/decisions/authority-boundaries.md`
- `docs/decisions/m3-authority-boundaries.md`
- `docs/m4-learning-authority.md`
- `docs/superpowers/plans/2026-03-31-m2-blueprint-foundation.md`
- `docs/superpowers/plans/2026-03-31-m3-coaching-foundation.md`
- `docs/superpowers/plans/2026-04-01-m4-plan-a-data-foundation.md`
- `docs/superpowers/plans/2026-04-01-m4-plan-b-postcook-feedback-ux.md`
- `docs/superpowers/plans/2026-04-01-m4-plan-d-product-consumers.md`
