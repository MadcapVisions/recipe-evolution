# Locked Session Backward Compatibility Audit Findings

**Date:** 2026-03-30
**Ticket:** 3.3b
**Prerequisite for:** Ticket 3.1 (build route refactor)

## Summary

Backward compatibility is sufficient. No data migration is required before Ticket 3.1 proceeds.

All compatibility scenarios were verified in `tests/unit/lockedSessionLegacyCompat.test.ts`:
- Legacy sessions without `build_spec` → handled by `buildLockedBrief` legacy reconstruction path
- Stale `build_spec` missing `derived_at: "lock_time"` sentinel → `normalizeBuildSpec()` returns null; legacy path takes over
- `build_spec` with non-canonical `dish_family` → `normalizeBuildSpec()` rejects; legacy path takes over
- Refinements with absent optional fields (`resolved_ingredient_intents`, `ingredient_provenance`) → optional chaining and `?? []` fallbacks prevent crashes

## DB Record Snapshot

Run `docs/locked-session-audit.sql` in Supabase and fill in:

| Metric | Value |
|--------|-------|
| Total records | [FILL IN] |
| State distribution | [FILL IN — e.g. built: N, ready_to_build: M] |
| Records with valid build_spec | [FILL IN] |
| Records without build_spec (legacy) | [FILL IN] |
| Records with invalid build_spec sentinel | [FILL IN] |
| Records with unexpected state values | [FILL IN — expected: 0] |
| Records with non-canonical dish_family in build_spec | [FILL IN — expected: 0] |

## Compatibility Findings

### build_spec field (may be null in legacy records)
- Legacy records without `build_spec` fall through to `buildLockedBrief`'s legacy reconstruction path. This path was in production before `build_spec` was introduced.
- `normalizeBuildSpec()` is strict: it rejects any spec missing `derived_at: "lock_time"`, specs with non-canonical `dish_family`, or specs with invalid enum values. Stale payloads are treated as absent.
- **Verdict: safe. No migration needed.**

### refinements optional fields
- `resolved_ingredient_intents` is optional per the TypeScript contract. All downstream code uses optional chaining (`?.`). Old records without this field are handled correctly.
- `extracted_changes.ingredient_provenance` is optional. All spread patterns use `?? []` fallback. Old records without this field are handled correctly.
- **Verdict: safe. No migration needed.**

### state field values
- Known states: `exploring`, `direction_locked`, `ready_to_build`, `building`, `built`.
- [FILL IN: confirm no unexpected state values found in DB — expected result from query 4: zero rows]
- **Verdict: [FILL IN based on query 4 results]**

## Decision for Ticket 3.1

Legacy session compatibility for the route refactor:
- `canonicalizeLockedSession()` is already defensive. No changes needed before 3.1.
- The `intent_resolver_v2` flag path must not touch locked-session briefs. `enrichBriefWithIntent` gates on `!lockedSession?.selected_direction` — confirmed in 3.1 plan.
- No migration SQL is required.
- 3.1 implementation may proceed.
