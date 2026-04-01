# Milestone 4 Plan C — Learning Pipeline Rollout Checklist

> Plan C was largely pre-built in Plan A. This checklist verifies the complete learning pipeline is functional before Plan D consumers depend on it.

## Plan A foundation (required)

- [ ] `recipe_postcook_feedback` table exists with RLS policies verified
- [ ] `POST /api/recipes/{id}/versions/{versionId}/postcook` returns 200 for valid payload
- [ ] `user_taste_scores` row is updated after a post-cook event is submitted
- [ ] `user_taste_profiles.updated_at` is zeroed (invalidated) after score update

## Mapping layer (C1)

- [ ] `lib/ai/feedback/applyPostCookFeedback.ts` exists and exports `applyPostCookFeedback`
- [ ] `too_spicy` issue tag reduces `spiceTolerance` score
- [ ] `too_heavy` reduces `richnessPreference`
- [ ] `too_bland` increases `flavorIntensityPreference`
- [ ] `too_many_steps` / `too_complex` reduce `complexityTolerance`
- [ ] `would_make_again = false` does NOT create a broad cuisine dislike (only dishFamily penalty)
- [ ] Single noisy event does not dominate profile state (RETENTION=0.9 confirmed)
- [ ] 13 mapping tests pass: `npm run test:unit 2>&1 | grep applyPostCookFeedback`

## Taste summary wiring (C2)

- [ ] `lib/ai/userTasteProfile.ts` exports `summarizeLearnedScores`
- [ ] `buildUserTasteSummary` queries `user_taste_scores` in its parallel Promise.all
- [ ] `summarizeLearnedScores` returns empty string when confidence = "low"
- [ ] Summary uses hedged language at "medium" confidence
- [ ] Sparse-data users (no post-cook events) still get stable summary

## Shared learned-signal interface (C3)

- [ ] `lib/ai/learnedSignals.ts` exists and exports `getLearnedSignals`, `invalidateLearnedSignalsCache`, `deriveLearnedPatterns`
- [ ] `getLearnedSignals` returns patterns for user with ≥ 3 cook events
- [ ] Returns empty patterns gracefully for brand-new users
- [ ] 5-minute TTL cache confirmed working (cached response on repeat call)
- [ ] `invalidateLearnedSignalsCache(userId)` clears the in-process cache entry
- [ ] 10 learned-signal tests pass: `npm run test:unit 2>&1 | grep learnedSignals`

## Consumer safety (C4)

- [ ] `docs/m4-learning-authority.md` is current and reviewed
- [ ] Learned signals never override hard dietary/equipment constraints (documented)
- [ ] Plans B–D import `getLearnedSignals` from `lib/ai/learnedSignals` only

## Observability (C5)

- [ ] `getPostCookCoverageStats()` in `lib/admin/adminData.ts` returns sensible data
- [ ] At least one `learned_signal_generated` event in `product_events` after feedback submission

## Rollback plan

1. All Plan C code is additive — no existing behavior is removed
2. `user_taste_scores` can be nulled per-user if score state is suspected corrupt
3. `getLearnedSignals` gracefully returns empty patterns if scores are null
4. Setting `postcook_feedback_v1` flag to `false` stops new events entering the pipeline

## Gate for Plans D and E

- [ ] At least one real post-cook feedback event submitted end-to-end in staging
- [ ] `user_taste_scores` updated after that event (verified via admin layer)
- [ ] `getLearnedSignals` returns non-empty patterns for that user
- [ ] All 601 unit tests passing
