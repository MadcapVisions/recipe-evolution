# Intent Module — Contract Authority (Ticket 1.5)

## Which contract owns meaning in the build flow?

**`ResolvedCookingIntent`** — the single authoritative upstream semantic contract for migrated build flows. Produced by `resolveCookingIntent()`. All migrated routes derive their generation input from this.

## Other contracts and their roles

| Contract | Role in migrated flows |
|----------|------------------------|
| `ResolvedCookingIntent` | **Canonical upstream semantic contract.** What the user wants to build. |
| `BuildSpec` | Downstream execution contract. Temporary bridge — derived from `ResolvedCookingIntent` via `resolvedIntentToBuildSpec()`. Will be superseded in a future milestone. |
| `CookingBrief` | Legacy compatibility context only. May be passed as context to the resolver but must never override the current user message or resolved intent. |
| `SessionState` / `LockedDirectionSession` | Persistence and session contracts. Input to the resolver, not output. Must not be treated as semantic authority. |

## Source precedence rules (enforced in resolveCookingIntent.ts)

1. Current user message — always wins
2. Explicit user preferences/settings
3. Active locked session (if not contradicted by user message)
4. Persisted `CookingBrief` (context only)
5. Inferred values

## Files in this module

| File | Purpose |
|------|---------|
| `intentTypes.ts` | All exported types for migrated flows |
| `dishFamilyClassifier.ts` | Family classifier v2 — heuristic + AI escalation |
| `constraintScoping.ts` | Scope assignment and pivot invalidation |
| `resolveCookingIntent.ts` | Canonical resolver entry point |
| `resolvedIntentToBuildSpec.ts` | Bridge to downstream `BuildSpec` execution contract |

## What NOT to do

- Do not add semantic logic to `buildLockedBrief()` or `compileCookingBrief()` in migrated flows.
- Do not read `CookingBrief.dish.dish_family` as a higher authority than `ResolvedCookingIntent.dishFamily`.
- Do not let `LockedDirectionSession` reconstruction override `resolveCookingIntent()` output.
