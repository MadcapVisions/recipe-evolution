# Milestone 4 Plan E — Settings, Telemetry & Final Rollout Checklist

## E1: Learned preferences settings

- [ ] `LEARNED_PREFERENCES_SETTINGS_V1` feature flag exists and defaults to `false`
- [ ] `POST /api/user/taste-scores/reset` returns 200 for authenticated user
- [ ] `POST /api/user/taste-scores/reset` returns 401 for unauthenticated request
- [ ] After reset: `user_taste_scores.scores_json` is `null` for that user
- [ ] After reset: `user_taste_profiles.updated_at` is zeroed (epoch)
- [ ] After reset: `invalidateLearnedSignalsCache` called (in-process cache cleared)
- [ ] `LearnedPreferencesSection` renders pattern list when patterns exist
- [ ] `LearnedPreferencesSection` renders empty-state message when no patterns
- [ ] Each pattern shows label + direction indicator + confidence badge
- [ ] With flag off: Settings page renders without learned section (no nav entry, no section)
- [ ] With flag on: "Learned preferences" appears in sidebar nav and as a section
- [ ] Reset button shows loading state during request
- [ ] Reset button shows success message and triggers `router.refresh()` after success
- [ ] Reset button shows error message on failure (retryable)

## E2: Telemetry

- [ ] `learned_signal_generated` event appears in `product_events` after post-cook feedback submission
- [ ] Event metadata includes `outcome`, `issue_tag_count`, `would_make_again`
- [ ] Telemetry failure does NOT crash the postcook route (already inside try/catch)
- [ ] `getPostCookCoverageStats()` in `lib/admin/adminData.ts` returns sensible data after events submitted

## Full M4 milestone gate

### Plan A (Data Foundation)
- [ ] `recipe_postcook_feedback` table exists with RLS policies
- [ ] `POST /api/recipes/{id}/versions/{versionId}/postcook` returns 200 for valid payload
- [ ] `user_taste_scores` updated after feedback submission
- [ ] `lib/ai/learnedSignals.ts` returns non-empty patterns for user with ≥3 cook events

### Plan B (UX)
- [ ] `POSTCOOK_FEEDBACK_V1` flag gates the feedback sheet in Cook Mode
- [ ] Post-cook sheet completes in ≤15 seconds
- [ ] `PostCookReminderBanner` visible on Recipe Detail when flag on + no prior feedback

### Plan C (Learning Pipeline)
- [ ] `applyPostCookFeedback` correctly maps issue tags to taste score deltas
- [ ] `summarizeLearnedScores` returns empty string when confidence is "low"
- [ ] `getLearnedSignals` 5-minute TTL cache working (repeat call returns cached)

### Plan D (Product Consumers)
- [ ] `IMPROVE_WITH_FEEDBACK_V1` flag gates post-cook context injection in improve-recipe
- [ ] `LIBRARY_RESURFACING_V1` flag gates shelf on library page
- [ ] `CREATE_PERSONALIZATION_V1` flag gates suggestion chips on create form
- [ ] All three surfaces are independently flag-toggleable

### Plan E (Settings + Telemetry)
- [ ] `LEARNED_PREFERENCES_SETTINGS_V1` flag gates learned preferences section
- [ ] `learned_signal_generated` event emitted after every postcook score update

## Rollback plan (full M4)

1. All M4 flags default to `false` — flipping any flag off restores prior behavior
2. `user_taste_scores` can be reset per-user via `POST /api/user/taste-scores/reset`
3. `recipe_postcook_feedback` rows are append-only — safe to ignore on rollback
4. `getLearnedSignals` returns empty patterns if scores are null — no downstream crash
5. All Plan D surfaces (`postCookContext`, resurfacing shelf, suggestion chips) are no-ops when their flags are off
6. Settings section disappears instantly when `LEARNED_PREFERENCES_SETTINGS_V1` is set to false

## Staged rollout order

1. Enable `POSTCOOK_FEEDBACK_V1` → collect feedback, verify `product_events`
2. Enable `IMPROVE_WITH_FEEDBACK_V1` → verify context injection in improve-recipe logs
3. Enable `LIBRARY_RESURFACING_V1` + `CREATE_PERSONALIZATION_V1` → verify signals surface correctly for users with ≥3 events
4. Enable `LEARNED_PREFERENCES_SETTINGS_V1` → all users can view + reset their learned profile
