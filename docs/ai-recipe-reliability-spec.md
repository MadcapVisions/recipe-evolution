# AI Recipe Reliability Spec

## Goal

Build a recipe-generation system that remains accurate even when users phrase requests in unusual, hybrid, or previously unseen ways.

The current HomeHub chat-to-recipe flow is vulnerable because it depends too heavily on:

- free-form conversation text as the primary source of truth
- heuristic title and dish-family inference
- permissive fallbacks that can save off-target recipes
- weak validation before persistence

The target system must:

- infer user intent semantically, not from a narrow list of trigger words
- preserve locked constraints across turns
- generate recipes from a structured cooking brief, not raw transcript text
- verify recipe alignment before persistence
- fail safely instead of silently saving nonsense
- log enough state to replay and debug failures
- communicate multi-stage progress clearly enough that added latency feels intentional rather than broken

## Non-Goals

- building a giant culinary ontology before improving reliability
- replacing all existing AI routes in one cutover
- making the user-facing chat feel rigid or form-driven
- solving every culinary ambiguity without clarifying questions

## Core Product Requirements

The system must:

1. Produce recipes that match the requested dish family and style.
2. Preserve critical user constraints across the full flow.
3. Detect and block recipe drift before save.
4. Distinguish between exploration, refinement, and generation.
5. Handle novel phrasing without adding one-off keyword rules for every case.
6. Surface safe recovery states when confidence is low.
7. Expose explicit progress states during slower multi-stage generation.

## Latency And UX Requirements

The target architecture introduces more AI stages than the current system. That is acceptable only if latency is handled as a product concern rather than ignored as an implementation detail.

### Expected Cost

The full target pipeline may require up to four AI calls for a final recipe generation:

- Intent Compiler
- Recipe Planner
- Recipe Generator
- Recipe Verifier

This is materially slower than the current one-pass or two-pass flow.

### Latency Strategy

The final recipe flow must not begin from zero at the moment the user clicks `Generate`.

Required approach:

- compile and update the `CookingBrief` incrementally during conversation
- persist the brief server-side under the active conversation key
- reuse the latest locked brief at recipe-build time whenever it is still fresh
- treat final recipe generation as a smaller pipeline: `plan -> generate -> verify`

This changes the effective user-visible cost from four stages at build time to three stages in the common case.

### Two-Speed UX Model

The product should have two different latency expectations:

#### Chat Speed

Normal chef conversation should remain fast and conversational.

- target the same feel as the current chat flow
- do background brief compilation after or alongside the visible reply
- do not block the chat response on expensive downstream stages

#### Final Build Speed

Locked-direction recipe generation can be slower, but must feel deliberate and instrumented.

- user explicitly initiates final build
- UI shows staged progress tied to real backend events
- the wait should feel like a careful build process, not a frozen interface

### Latency Budgets

Target end-to-end latency for locked-direction final recipe generation:

- good: `4-7s`
- acceptable: `7-10s`
- risky: `10-14s`
- unacceptable: `>14s`

These are product-level targets. If real production latency lands above the acceptable range consistently, the pipeline must be simplified, cached more aggressively, or assigned faster models.

### Required UX Behavior

The app must expose explicit progress states during generation, for example:

- `Understanding your request...`
- `Planning the recipe...`
- `Writing the recipe...`
- `Checking that it matches...`

The UI should not appear stalled while background stages run.

### Latency Mitigations

- compile and persist the `CookingBrief` incrementally during conversation turns so generation does not always start from zero
- skip planner or verifier only for low-stakes exploratory idea generation, never for locked recipe generation
- cache brief compilation and plan generation when inputs have not materially changed
- run deterministic validation immediately before invoking slower semantic verification
- consider a faster verifier model for alignment checks if quality remains acceptable
- keep retries tightly bounded

### Streaming Requirements

The server should stream real stage progress during final recipe generation.

Required progress phases:

- `Understanding your request...`
- `Planning the recipe...`
- `Writing the recipe...`
- `Checking that it matches...`

Preferred enhancements:

- include concise stage-specific detail such as locked direction or current check
- ensure progress state changes are tied to real stage boundaries, not synthetic timers
- preserve progress state in the UI if the user navigates within the generation surface

## AI Cost Strategy

Accuracy improvements cannot depend on using the strongest model for every stage.

### Model Tiering

Use different model tiers for different jobs.

- `Intent Compiler`: small, fast, low-cost model
- `Recipe Planner`: small, fast, low-cost model
- `Recipe Generator`: strongest recipe-capable model
- `Recipe Verifier`: small or medium model depending on observed quality

The expensive model should be reserved for the final generation stage unless data proves otherwise.

### Cost Distribution Targets

Expected proportional cost by stage:

- compiler: `10-15%`
- planner: `10-15%`
- generator: `55-70%`
- verifier: `10-20%`

If planner or verifier approaches generator cost in production, that is a system design failure and should trigger prompt reduction, model downgrade, or stage redesign.

### Cost Controls

- cache brief compilation by conversation key and last-turn hash
- cache plan generation by brief hash
- do not run planner or verifier for low-stakes exploratory idea generation unless explicitly needed
- run deterministic validation before expensive semantic verification
- cap automatic retries at two
- track stage cost and token usage from day one

### Product Rule

We prefer a slower correct recipe over a fast wrong recipe, but the system must stay inside acceptable latency and cost bounds. If those bounds are exceeded, we must tune architecture, model assignment, and caching before scaling usage.

### Product Rule

If locked-direction generation becomes slower, the system must be transparent about it. We prefer a slower correct recipe over a fast wrong one, but the user must understand that the app is actively working through stages.

## Current Failure Taxonomy

### 1. Intent Extraction Failure

The system does not correctly understand the request.

Examples:

- `focaccia pizza` treated as unrelated free text instead of a pizza-family request
- `traditional carbonara` flattened into generic pasta
- `chicken-filled ravioli` reduced to `chicken`

### 2. State Failure

The system does not know whether the user is:

- exploring ideas
- narrowing options
- locking a direction
- requesting final recipe generation
- requesting a revision to an existing recipe

This causes old turns or discarded options to leak into the final build.

### 3. Constraint Loss

Important user constraints are inferred or mentioned but lost between stages.

Examples:

- style not preserved
- required ingredient dropped
- exclusion ignored
- time or difficulty target lost

### 4. Generation Drift

The model writes a plausible recipe that is adjacent to, but not actually, the requested dish.

Examples:

- skillet instead of pizza
- bowl instead of pasta
- dip instead of spreadable salad

### 5. Title Drift

The title is generic, placeholder-like, or mismatched to the recipe.

Examples:

- `Chef Conversation Recipe`
- `Chef-Directed Pasta`
- a skillet recipe titled like a pizza

### 6. Fallback Corruption

The AI path fails and the fallback system creates something unrelated, yet still saves it as final.

### 7. Verification Gap

There is no hard gate blocking persistence when the recipe is off-target.

### 8. Observability Gap

The system does not record enough intermediate artifacts to explain why a failure happened.

### 9. Regression Risk

A fix for one case introduces regressions elsewhere because there is no standing evaluation dataset.

## Target Architecture

The target pipeline is:

1. `Conversation Agent`
2. `Intent Compiler`
3. `Constraint Resolver`
4. `Recipe Planner`
5. `Recipe Generator`
6. `Recipe Verifier`
7. `Persistence Gate`

The key design rule is separation of concerns. No single prompt should be responsible for chat, structured understanding, recipe planning, generation, and correctness enforcement.

## Stage Responsibilities

### Stage 1. Conversation Agent

Responsibilities:

- carry natural chat with the user
- ask clarifying questions when confidence is low or multiple plausible interpretations exist
- present options when the user is exploring
- avoid making silent assumptions when the request is materially ambiguous

Must not:

- directly serve as the final authority on recipe correctness
- silently overwrite a previously locked direction

### Stage 2. Intent Compiler

Responsibilities:

- transform conversation history into a structured `CookingBrief`
- update the brief after each significant turn
- mark which fields are locked vs inferred vs unknown
- normalize user phrasing into canonical culinary concepts

The compiler should reason semantically rather than requiring exact phrases. For example:

- `focaccia pizza` -> canonical family `pizza`, style `focaccia-style`
- `bready Roman-style pizza` -> family `pizza`, style `sheet-pan` or `Roman-style`
- `filled ravioli with chicken` -> canonical centerpiece `ravioli`, ingredient note `chicken-filled`

### Stage 3. Constraint Resolver

Responsibilities:

- determine whether the brief is sufficiently complete for generation
- decide whether clarification is required
- decide whether previously inferred fields should be locked
- determine whether the user has pivoted or is refining the same direction

### Stage 4. Recipe Planner

Responsibilities:

- produce a structured recipe plan before any full recipe is written
- outline core components, sequence, techniques, and expected result
- give the verifier a smaller target to evaluate before a full recipe is generated

### Stage 5. Recipe Generator

Responsibilities:

- generate a full recipe using only the structured brief and approved recipe plan
- preserve locked fields exactly
- avoid importing stale or discarded directions from old conversation turns

### Stage 6. Recipe Verifier

Responsibilities:

- independently evaluate the generated recipe against the brief and plan
- identify mismatch reasons
- produce pass/fail and confidence
- guide retry strategy

### Stage 7. Persistence Gate

Responsibilities:

- allow save only when verification passes
- block generic or failed outputs from becoming user-visible final recipes
- attach generation metadata for auditing and future analysis

## Data Contracts

The following TypeScript types should be introduced as the new core contracts.

### CookingBrief

```ts
export type BriefFieldState = "locked" | "inferred" | "unknown";

export type CookingBrief = {
  request_mode: "explore" | "compare" | "locked" | "generate" | "revise";
  confidence: number;
  ambiguity_reason: string | null;

  dish: {
    raw_user_phrase: string | null;
    normalized_name: string | null;
    dish_family: string | null;
    cuisine: string | null;
    course: string | null;
    authenticity_target: string | null;
  };

  style: {
    tags: string[];
    texture_tags: string[];
    format_tags: string[];
  };

  ingredients: {
    required: string[];
    preferred: string[];
    forbidden: string[];
    centerpiece: string | null;
  };

  constraints: {
    servings: number | null;
    time_max_minutes: number | null;
    difficulty_target: string | null;
    dietary_tags: string[];
    equipment_limits: string[];
  };

  directives: {
    must_have: string[];
    nice_to_have: string[];
    must_not_have: string[];
    required_techniques: string[];
  };

  field_state: {
    dish_family: BriefFieldState;
    normalized_name: BriefFieldState;
    cuisine: BriefFieldState;
    ingredients: BriefFieldState;
    constraints: BriefFieldState;
  };

  source_turn_ids: string[];
  compiler_notes: string[];
};
```

### RecipePlan

```ts
export type RecipePlan = {
  title_direction: string;
  dish_family: string;
  style_tags: string[];
  core_components: string[];
  key_ingredients: string[];
  blocked_ingredients: string[];
  technique_outline: string[];
  expected_texture: string[];
  expected_flavor: string[];
  confidence: number;
  notes: string[];
};
```

### VerificationResult

```ts
export type VerificationResult = {
  passes: boolean;
  confidence: number;
  score: number;
  reasons: string[];
  checks: {
    dish_family_match: boolean;
    style_match: boolean;
    centerpiece_match: boolean;
    required_ingredients_present: boolean;
    forbidden_ingredients_avoided: boolean;
    title_quality_pass: boolean;
    recipe_completeness_pass: boolean;
  };
  retry_strategy: "none" | "regenerate_same_model" | "regenerate_stricter" | "upgrade_model" | "ask_user";
};
```

### GenerationAttempt

```ts
export type GenerationAttempt = {
  conversation_snapshot: string;
  cooking_brief: CookingBrief;
  recipe_plan: RecipePlan | null;
  generator_input: Record<string, unknown>;
  raw_model_output: unknown;
  normalized_recipe: unknown;
  verification: VerificationResult | null;
  attempt_number: number;
  provider: string | null;
  model: string | null;
  outcome: "passed" | "failed_verification" | "parse_failed" | "generation_failed" | "blocked";
};
```

## State Machine

The HomeHub and recipe-detail assistant flows must use explicit state transitions.

### States

- `explore`
- `options_presented`
- `direction_selected`
- `direction_locked`
- `ready_for_recipe`
- `recipe_generated`
- `revision_requested`

### Transition Rules

#### `explore -> options_presented`

When the user asks for ideas, options, or comparative directions.

#### `options_presented -> direction_selected`

When the user picks an option explicitly or clearly endorses one direction.

#### `direction_selected -> direction_locked`

When the compiler determines the user is refining one direction rather than still comparing.

#### `direction_locked -> ready_for_recipe`

When the brief has enough confidence and enough locked constraints to generate.

#### `ready_for_recipe -> recipe_generated`

Only after generator pass + verifier pass.

#### `recipe_generated -> revision_requested`

When the user asks for changes to the generated recipe.

#### Any locked state -> `explore`

Only on explicit pivot, for example:

- `actually give me 3 totally different ideas`
- `never mind, I want tacos instead`

This must not happen on mild refinement prompts like:

- `make it crispier`
- `can we use ricotta instead`
- `what if I want it vegetarian`

## Confidence And Clarification Rules

The system should not always clarify. It should clarify selectively.

Ask a clarifying question when:

- multiple dish families are plausible and materially different
- a required field is missing for a high-stakes request
- the user requests authenticity or dietary constraints that materially affect recipe correctness
- the system confidence is below threshold and generation would likely drift

Default thresholds:

- `>= 0.85`: proceed if no contradiction exists
- `0.65 - 0.84`: proceed only if the unresolved ambiguity is low impact
- `< 0.65`: ask a clarifying question

## Prompt Contracts

### Intent Compiler Prompt

The compiler prompt should:

- summarize the latest active direction
- state that the output must be a structured brief JSON object
- require normalization of dish family and style
- require explicit marking of `locked`, `inferred`, or `unknown`
- require concise ambiguity reasoning

### Recipe Planner Prompt

The planner prompt should:

- consume only the `CookingBrief`
- produce a `RecipePlan`
- explicitly preserve dish family and locked constraints
- reject plan shapes that violate the brief

### Recipe Generator Prompt

The generator prompt should:

- consume only the approved `CookingBrief` and `RecipePlan`
- forbid dish-family drift
- forbid generic titles
- require every ingredient to include quantity
- require complete steps with actionable instructions

### Recipe Verifier Prompt

The verifier prompt should:

- compare `CookingBrief`, `RecipePlan`, and generated recipe
- score alignment
- explain failures concretely
- recommend retry strategy

## Validation Strategy

Validation must combine deterministic checks and model-assisted checks.

### Deterministic Checks

- recipe has title, ingredients, steps
- ingredients include quantities
- title is not generic placeholder text
- forbidden placeholder phrases are blocked
- numeric fields are sane

### Model-Assisted Checks

- dish family alignment
- style and format alignment
- centerpiece preservation
- major required ingredient presence
- forbidden ingredient avoidance
- technique alignment
- title plausibility

The deterministic layer catches obvious bad structure. The model-assisted layer catches semantic drift.

## Safe Failure Policy

The system must fail safely.

### Allowed

- retry generation
- ask a clarifying question
- show a non-destructive error state
- offer the interpreted brief for user confirmation

### Forbidden

- saving an unverified recipe
- saving a recipe with a generic placeholder title
- silently replacing a failed AI recipe with an unrelated local fallback
- crossing dish families in fallback mode

### Local Fallback Policy

Retire deterministic local fallback for locked-direction final recipe generation.

Reasoning:

- the current local fallback is the most dangerous behavior in the system
- a safe failure or clarifying question is strictly better than persisting a plausible but wrong recipe
- keeping local fallback in the final generation path encourages silent corruption instead of explicit recovery

Deterministic helpers may still be used for low-stakes ideation or internal testing, but not for final persisted recipe builds when the user has locked a direction.

## Retry Policy

Retry order:

1. Regenerate from the same brief and plan with stricter constraints
2. Regenerate with verifier failure reasons appended
3. Regenerate using a stronger model if configured
4. If still failing, ask the user a targeted clarifying question or show a safe failure message

Retry limits:

- max 2 automatic retries for parse or drift failures
- after that, stop and surface the issue

## Persistence Rules

A recipe may be saved only if all of the following are true:

- parsed successfully into canonical recipe draft shape
- deterministic validation passes
- verifier returns `passes = true`
- title quality passes
- generation attempt metadata is attached

Blocked recipes should still emit telemetry, but not become visible recipe records.

## Observability Requirements

Every generation attempt must store:

- conversation key
- relevant conversation turn snapshot
- current state machine state
- structured brief
- brief confidence
- recipe plan
- raw AI output
- normalized recipe output
- verifier result
- retry count
- provider/model
- persistence outcome

This data should be queryable from admin/debug tooling.

In addition, every stage must record:

- stage name
- stage start time
- stage end time
- stage duration
- input tokens
- output tokens
- estimated cost
- cache hit vs cache miss

This instrumentation is required to manage both latency and AI spend.

## Storage Proposal

Add a new persistence layer for structured AI artifacts.

### New Table: `ai_generation_attempts`

Suggested fields:

- `id`
- `owner_id`
- `scope`
- `conversation_key`
- `request_mode`
- `state_before`
- `state_after`
- `cooking_brief_json`
- `recipe_plan_json`
- `generator_payload_json`
- `raw_model_output_json`
- `normalized_recipe_json`
- `verification_json`
- `provider`
- `model`
- `attempt_number`
- `outcome`
- `created_at`

### Required New Table: `ai_cooking_briefs`

This table is required. The structured brief cannot live only in transient client state because:

- a refresh would lose locked direction state
- the app already persists conversation turns server-side and should not regress from that behavior
- server-side brief persistence improves replayability, revision handling, and multi-device continuity

- `id`
- `owner_id`
- `conversation_key`
- `scope`
- `brief_json`
- `confidence`
- `is_locked`
- `created_at`
- `updated_at`

## UX Implications

### User-Facing

The user experience should remain conversational, but safer.

Potential additions:

- `Chef understood:` preview when confidence is moderate and request is complex
- better failure message when a recipe could not be generated reliably
- optional ability to confirm the interpreted direction before final build
- streamed multi-stage progress during final build
- explicit status copy when a retry is in progress

### Admin / Debug

Need visibility into:

- compiler brief
- plan
- verifier reasons
- blocked saves
- recurring failure categories

## Evals And Regression Dataset

We need a permanent evaluation set built from real requests and likely edge cases.

This is a prerequisite for implementation, not a late-stage improvement. The seed evals in this spec must become runnable before Phase 1 ships.

### Required Eval Buckets

- exact dish requests
- hybrid dish requests
- traditional / authentic requests
- ingredient-led requests
- pre-made item requests
- exclusion / allergy requests
- time-constrained requests
- revision requests
- ambiguous requests needing clarification
- dish family adjacency traps

### Seed Cases

- `I want focaccia pizza`
- `I want traditional spaghetti carbonara, no cream`
- `I have chicken-filled ravioli, give me a sauce idea`
- `Make a delicate Romanian salata de vinete with olive oil`
- `I want tacos, not a bowl`
- `Make it vegetarian but keep the same pasta shape`
- `I want a crispy flatbread-style pizza with mushrooms`
- `No onions, no garlic, high-protein dinner in 30 minutes`

### Product Metrics

- off-target save rate
- generic-title save rate
- dish-family mismatch rate
- forbidden-ingredient violation rate
- clarification-needed miss rate
- blocked-save rate
- successful retry rate

## Rollout Plan

### Phase 0. Spec, Evals, And Contracts

- define TS types
- define new AI artifact schemas
- define save/block rules
- define telemetry requirements
- create a runnable seed eval harness using the regression cases in this spec
- add pass/fail criteria for brief extraction, plan alignment, final recipe alignment, and save/block behavior
- require Phase 1 changes to pass the seed eval set before shipping
- define stage-level latency and cost instrumentation contract
- define initial model-tier assignment for compiler, planner, generator, and verifier

### Phase 1. Intent Compiler And State Machine

- add `CookingBrief`
- compile brief after each turn
- add explicit state transitions
- log brief artifacts
- persist brief artifacts server-side
- ensure chat UX remains fast while brief compilation happens in the background

### Phase 2. Verifier And Safe Persistence

- add verification pass before save
- block invalid saves
- remove unsafe fallback saves
- attach failure reasons to telemetry
- add streamed final-build progress states
- log per-stage latency and cost metrics

### Phase 3. Plan-First Generation

- introduce `RecipePlan`
- generate full recipe from brief + plan only
- add retry loop driven by verifier failures

### Phase 4. Admin Visibility And Replay

- add debug/admin surfacing for attempts
- allow replay of failing prompts against stored brief and plan

### Phase 5. Continuous Quality Tracking

- expand the initial eval set
- add scripted benchmark runner
- track reliability metrics over time

## Implementation Map For This Repo

### New Files

- `lib/ai/contracts/cookingBrief.ts`
- `lib/ai/contracts/recipePlan.ts`
- `lib/ai/contracts/verificationResult.ts`
- `lib/ai/briefCompiler.ts`
- `lib/ai/briefStateMachine.ts`
- `lib/ai/recipePlanner.ts`
- `lib/ai/recipeVerifier.ts`
- `lib/ai/generationAttemptStore.ts`

### Existing Files Likely To Change

- `app/api/ai/home/route.ts`
- `lib/ai/homeHub.ts`
- `components/home/useHomeHubAi.ts`
- `lib/ai/homeConversationFocus.ts`
- `lib/ai/recipeResult.ts`
- `lib/localRecipeGenerator.ts`
- admin/debug data loaders and pages

### Migration Work

Add migrations for:

- `ai_generation_attempts`
- `ai_cooking_briefs`

## Acceptance Criteria

This effort is successful when:

1. A request like `focaccia pizza` yields a pizza-family brief, a pizza-family plan, and blocks any non-pizza final recipe.
2. Generic titles like `Chef Conversation Recipe` can no longer persist as final recipes.
3. Failed or drifting generations never auto-save to user-facing recipe detail.
4. We can inspect the full chain of artifacts for any bad run.
5. A standing eval set catches regressions before they reach users.
6. Locked recipe generation stays within the acceptable latency budget in normal operation.
7. Stage-level AI cost is observable and the generator remains the dominant spend.

## Open Questions

1. Should the `CookingBrief` be shown to users directly in any flow, or remain internal only?
2. Should recipe verification use the same provider as generation or a separate model by default?
3. Should low-confidence locked-direction requests force confirmation before generation?

## Recommended First Implementation Slice

The first shipping slice should be:

1. Add `CookingBrief` contracts and compiler.
2. Add state machine for HomeHub chat.
3. Add verifier and hard save gate.
4. Persist `CookingBrief` server-side.
5. Remove unsafe final-recipe fallback behavior.
6. Log generation attempts.

That slice will materially reduce the most embarrassing failures before the full planner architecture is in place.
