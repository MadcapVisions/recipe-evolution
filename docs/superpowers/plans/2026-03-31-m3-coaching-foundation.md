# M3 Plan A — Coaching Foundation

Date: 2026-03-31
Branch: feature/m3-coaching-foundation
Scope: Epics 1, 2, 3, 4 (partial), 9 — backend/AI coaching layer

## Scope

Implement the coaching type system, structured chef rules, launch-family coaching content,
deterministic CookingCoach generator, rescue taxonomy and recovery moves, coach persistence,
Recipe Detail data loader extension, and M3 feature flags.

Explicitly out of scope for this plan:
- Frontend (Epics 5, 6) — Recipe Detail block, Cook mode cues/rescue UI
- Telemetry (Epic 7)
- QA integration tests (Epic 8)
- Plans B+ will cover those

## Key decisions

- Coach generation is rule-based and deterministic — no LLM call in M3
- ChefRuleRecord/chefCatalog.ts informs rule format but coaching rules live in coaching/ module
- chefIntelligence.ts is frozen for legacy only — not reused in coach flow
- buildCookingContext.ts classified as internal-only string helper — not surfaced to users
- recipe_version_id matches existing chefScoreStore.ts naming convention

## Tasks

---

### Task 1 — Define coaching type system
**File:** `lib/ai/coaching/coachTypes.ts`
**Ticket:** 1.1

Types to define:
- `GuidanceImportance`: "critical" | "important" | "nice_to_know"
- `StepLinkage`: `{ stepIndex: number; stepText?: string }` (optional per element)
- `RescueScenario`: enum/union of taxonomy values (too_salty, too_thin, etc.)
- `ChefSecret`: `{ text: string; rationale: string; stepLinkage?: StepLinkage }`
- `WatchFor`: `{ cue: string; importance: GuidanceImportance; stepLinkage?: StepLinkage }`
- `MistakePrevention`: `{ mistake: string; prevention: string; importance: GuidanceImportance }`
- `RecoveryMove`: `{ scenario: RescueScenario; move: string; familyAware: boolean }`
- `CookingCoach`: `{ chefSecrets: ChefSecret[]; watchFors: WatchFor[]; mistakePreviews: MistakePrevention[]; recoveryMoves: RecoveryMove[]; generatedFrom: string; generatedAt: string }`

Verify: file compiles, types are importable

---

### Task 2 — Write coaching overlap audit
**File:** `docs/decisions/m3-coaching-overlap-audit.md`
**Ticket:** 1.2

Classify each module with: migration status + output role + UI status
- `chefIntelligence.ts` → freeze for legacy only | recipe_improvement | internal_only
- `chefCatalog.ts` → reuse rule format as inspiration; rule data remains in scoring flow | internal_signal_only | internal_only
- `buildCookingContext.ts` → freeze for legacy only; string-based, not structured | internal_signal_only | internal_only
- Recipe Detail insight helpers → document any found during audit
- Cook mode helpers → document any found during audit

---

### Task 3 — Write M3 authority boundaries doc
**File:** `docs/decisions/m3-authority-boundaries.md`
**Ticket:** 1.3

State clearly:
- CulinaryBlueprint owns planning
- Validation modules own structure/culinary judgment
- ChefScore/DelightScore own scoring outputs
- CookingCoach owns: pre-cook guidance, step-linked cues, mistake prevention, in-session recovery moves
- chef-fix (future) owns recipe-improvement recommendations
- Coaching must not override recipe meaning or validation truth

---

### Task 4 — Define structured chef rule format
**File:** `lib/ai/coaching/chefRules.ts`
**Ticket:** 2.1

Types to define:
- `CoachRuleCategory`: "universal" | "family_specific" | "dish_pattern" | "mistake_prevention" | "recovery" | "finish" | "watch_for"
- `CoachRuleOutputType`: "chef_secret" | "watch_for" | "mistake_prevention" | "recovery_move" | "finish_guidance"
- `CoachRuleApplicability`: `{ families?: string[]; methods?: string[]; roles?: IngredientRole[] }`
- `CoachRule`: `{ id: string; category: CoachRuleCategory; outputType: CoachRuleOutputType; applicability: CoachRuleApplicability; rationale: string; priority: number; text: string | ((ctx: CoachRuleContext) => string) }`
- `CoachRuleContext`: minimal context passed when evaluating rules (family, primaryMethod, richness, ingredients)

Export: `evaluateCoachRules(rules: CoachRule[], ctx: CoachRuleContext): CoachRule[]`

Verify: compiles, evaluateCoachRules filters by applicability correctly

---

### Task 5 — Build launch-family coaching rule set
**File:** `lib/ai/coaching/familyCoachingRules.ts`
**Ticket:** 2.2

For each of the 8 launch families, define:
- 1–2 chef secrets
- 2–3 watch-fors
- 1–2 common mistakes + prevention
- 1–2 rescue moves
- finish guidance where relevant

Families: skillet_saute, pasta, soups_stews, sheet_pan, chicken_dinners, rice_grain_bowls,
roasted_vegetables, baked_casseroles

Also export: `UNIVERSAL_COACH_RULES: CoachRule[]` (3–5 rules that apply to all families)
And: `getFamilyCoachRules(family: string): CoachRule[]` — returns family rules + universals, falls back to universals only for unknown families

Verify: all 8 families return non-empty rule sets, unknown family returns universal fallback

---

### Task 6 — Build CookingCoach generator
**File:** `lib/ai/coaching/buildCookingCoach.ts`
**Ticket:** 2.3

Signature:
```typescript
export function buildCookingCoach(
  intent: ResolvedCookingIntent,
  blueprint: CulinaryBlueprint,
  recipe: RecipeDraft,
  methodPlan: MethodPlan
): CookingCoach
```

Logic:
1. Get applicable rules via `getFamilyCoachRules(blueprint.dishFamily)`
2. Evaluate rules against CoachRuleContext derived from inputs
3. Assemble CookingCoach: select top chef secrets (max 2), top watch-fors, top mistake preventions, recovery moves where warranted
4. Attach step linkage where rule references a step index
5. Set generatedFrom = intent.requestId, generatedAt = now

Output must be deterministic — same inputs produce same output. No LLM call.

Verify: generates coach with at least 1 chef secret and 1 watch-for for all launch families

---

### Task 7 — Define rescue scenario taxonomy
**File:** `lib/ai/coaching/rescueScenarios.ts`
**Ticket:** 3.1

Define and export:
```typescript
export const RESCUE_SCENARIOS = [
  "too_salty", "too_thin", "too_thick", "overbrowned_aromatics",
  "underseasoned", "too_wet_watery", "dry_protein", "broken_sauce",
  "texture_not_crisping", "dough_batter_too_wet", "dough_batter_too_dry"
] as const;
export type RescueScenario = typeof RESCUE_SCENARIOS[number];
```

Also export: scenario display labels and brief descriptions for UI use later

Verify: compiles, type is importable by coachTypes.ts

---

### Task 8 — Map rescue scenarios to family-aware recovery moves
**File:** `lib/ai/coaching/rescueRecoveryMap.ts`
**Ticket:** 3.2

Export:
```typescript
export type RecoveryEntry = {
  scenario: RescueScenario;
  move: string;
  families?: string[]; // undefined = applies to all
}
export const RECOVERY_MAP: RecoveryEntry[]
export function getRecoveryMoves(scenario: RescueScenario, family: string): RecoveryEntry[]
```

Populate with practical, family-aware recovery moves for all 11 scenarios.
Family-specific entries should vary the advice when the approach genuinely differs
(e.g. thickening a pasta sauce vs a stew).

Verify: each scenario has at least one recovery move; family-specific lookups return family-aware moves where defined

---

### Task 9 — Integrate recovery moves into CookingCoach
**Ticket:** 3.3

Update `buildCookingCoach.ts`:
- Derive likely rescue scenarios from blueprint/recipe context (e.g. protein dish → dry_protein risk)
- Call `getRecoveryMoves(scenario, family)` for each likely scenario
- Include top recovery moves (max 3) in CookingCoach.recoveryMoves
- Do not include recovery moves that don't apply to the recipe type

Verify: chicken_dinners coach includes dry_protein recovery; pasta coach includes too_thick/too_thin

---

### Task 10 — Add M3 feature flags
**File:** `lib/ai/featureFlags.ts`
**Ticket:** 9.1

Add to FEATURE_FLAG_KEYS:
```typescript
COACH_LAYER_V1: "coach_layer_v1",
RECIPE_DETAIL_PRECOOK_BLOCK_V1: "recipe_detail_precook_block_v1",
COOK_MODE_CUES_V1: "cook_mode_cues_v1",
COOK_MODE_RESCUE_V1: "cook_mode_rescue_v1",
```

Verify: compiles, keys are accessible

---

### Task 11 — Add recipe_coach_layers migration
**File:** `supabase/migrations/202603310001_recipe_coach_layers.sql`
**Ticket:** 4.1

```sql
create table recipe_coach_layers (
  id uuid primary key default gen_random_uuid(),
  recipe_version_id uuid not null unique references recipe_versions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  coach_json jsonb not null,
  created_at timestamptz not null default now()
);

alter table recipe_coach_layers enable row level security;

create policy "owner_access" on recipe_coach_layers
  for all using (auth.uid() = user_id);
```

Verify: SQL is valid, follows RLS pattern from existing migrations

---

### Task 12 — Add coach persistence store
**File:** `lib/ai/coaching/coachStore.ts`
**Ticket:** 4.2

Exports:
```typescript
export async function persistCoachArtifact(
  supabase: SupabaseClient,
  params: { recipeVersionId: string; userId: string; coach: CookingCoach }
): Promise<void>

export async function loadCoachArtifact(
  supabase: SupabaseClient,
  params: { recipeVersionId: string; userId: string }
): Promise<CookingCoach | null>
```

Follow chefScoreStore.ts patterns:
- persistCoachArtifact upserts (conflict on recipe_version_id)
- loadCoachArtifact returns null when not found, never throws on missing
- persistence failure must not bubble up and corrupt recipe save

Verify: unit tests cover persist + load round-trip via mock supabase

---

### Task 13 — Extend Recipe Detail data loader for coach data
**File:** `lib/versionDetailData.ts`
**Ticket:** 4.2b

Add to `loadVersionDetailData()` (or parallel loader):
- Fetch from recipe_coach_layers where recipe_version_id = versionId and user_id = userId
- Return coach data as optional field on the detail payload
- Return null/undefined when no coach sidecar exists — must not break page load

Verify: absence of coach data returns null without error; presence returns CookingCoach shape

---

### Task 14 — Document coach retention policy
**File:** `docs/decisions/m3-coach-retention-policy.md`
**Ticket:** 4.3

State:
- coach sidecars linked to saved recipe versions persist long-term (cascade delete on version delete)
- request-only transient builds do not produce coach rows (no version_id = no row)
- no separate cleanup job needed for M3 scope

---

## Test file mapping

| Task | Test file |
|------|-----------|
| 1    | tests/unit/coachTypes.test.ts |
| 4    | tests/unit/chefRules.test.ts |
| 5    | tests/unit/familyCoachingRules.test.ts |
| 6    | tests/unit/buildCookingCoach.test.ts |
| 7    | tests/unit/rescueScenarios.test.ts |
| 8    | tests/unit/rescueRecoveryMap.test.ts |
| 9    | (covered in buildCookingCoach.test.ts) |
| 12   | tests/unit/coachStore.test.ts |
| 13   | tests/unit/versionDetailData.test.ts (extend existing or new) |

Tasks 2, 3, 10, 11, 14 are docs/config — no unit tests needed.

## Verification

After all tasks: `./node_modules/.bin/tsc -p tsconfig.unit.json && node --require ./scripts/_mock-server-only.cjs --test ".tmp-unit/tests/unit/*.test.js"`

All pre-existing tests must continue to pass.
