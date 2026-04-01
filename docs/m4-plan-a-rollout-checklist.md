# Milestone 4 Plan A — Rollout Checklist

## Pre-launch

- [ ] `docs/m4-learning-authority.md` reviewed by backend lead + PM
- [ ] `recipe_postcook_feedback` migration applied and verified in staging
- [ ] RLS policies confirmed: owner-only insert + select
- [ ] All five M4 flags added to `feature_flags` table with initial value `false`

## API verification

- [ ] `POST /api/recipes/{id}/versions/{versionId}/postcook` accepts a valid payload
- [ ] Rejects unknown `overall_outcome` with 400
- [ ] Rejects unknown issue tags with 400
- [ ] Rejects duplicate within 30s window with 409
- [ ] Accepts a second legitimate submission after 30s window
- [ ] Returns `{ ok: true, id, created_at }` on success

## Taste-score wiring

- [ ] Submitting post-cook feedback updates `user_taste_scores` for that user
- [ ] `user_taste_profiles.updated_at` is set to epoch after successful feedback (invalidated)
- [ ] Next call to `getCachedUserTasteSummary` triggers a full rebuild
- [ ] Learned score summary text appears in taste profile when confidence ≥ medium

## Learned-signal interface

- [ ] `getLearnedSignals` returns patterns for a user with ≥ 3 cook events
- [ ] Returns empty patterns gracefully for a brand-new user
- [ ] `invalidateLearnedSignalsCache` clears the in-process cache entry
- [ ] Plans B–E can import `getLearnedSignals` and `LearnedSignals` from `lib/ai/learnedSignals`

## Observability

- [ ] `getPostCookCoverageStats()` returns sensible data from admin layer

## Rollback plan

1. Set `postcook_feedback_v1` flag to `false` in the `feature_flags` table
2. Frontend flag check prevents new submissions reaching the API route
3. Existing `recipe_postcook_feedback` rows are inert if the flag is off
4. `user_taste_scores` and `recipe_feedback` continue working normally
5. If taste-score corruption is suspected: set `scores_json = null` for affected user in
   `user_taste_scores` — scores rebuild from lightweight feedback on next generation call

## Downstream readiness gates for Plans B–E

- [ ] `recipe_postcook_feedback` table has events from at least one test user
- [ ] `user_taste_scores` is being updated from postcook events end-to-end
- [ ] `learnedSignals.ts` interface is importable and stable
- [ ] Authority boundary doc is current and has been reviewed
