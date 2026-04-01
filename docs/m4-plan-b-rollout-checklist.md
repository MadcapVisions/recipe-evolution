# Milestone 4 Plan B — Post-Cook Feedback UX Rollout Checklist

## Pre-launch gates

- [ ] Plan A foundation verified:
  - [ ] `recipe_postcook_feedback` table exists in staging
  - [ ] `POST /api/recipes/{id}/versions/{versionId}/postcook` returns 200 for valid payload
  - [ ] `POSTCOOK_FEEDBACK_V1` flag exists in `feature_flags` table
- [ ] `POSTCOOK_FEEDBACK_V1` flag set to `false` in production before enabling

## Cook-completion entry (B3.1)

- [ ] Flag off: old completion modal (rating/improvements/best-version) appears unchanged
- [ ] Flag on: clicking "Mark cook complete" opens PostCookFeedbackSheet (new flow)
- [ ] Flag on: "great" outcome → immediate done confirmation, then navigate to recipe detail
- [ ] Flag on: non-great outcome → outcome → issue tags → submit → done confirmation
- [ ] "Mark as Best Version" toggle visible and functional in new flow
- [ ] Skipping feedback navigates to recipe detail
- [ ] Improve CTA appears for disappointing/failed/with-tags outcomes
- [ ] Improve CTA does NOT appear for clean "great" outcome

## Recipe detail reminder (B3.2)

- [ ] Flag off: banner does not appear
- [ ] Flag on, no prior feedback for this version: banner appears
- [ ] Flag on, feedback already submitted for this version: banner does not appear
- [ ] Dismissing banner removes it for the current session (does not re-nag on same view)
- [ ] Clicking "Leave feedback" opens PostCookFeedbackSheet
- [ ] After submitting from the banner, banner disappears on refresh

## API and schema

- [ ] Submission payload matches Plan A schema (overall_outcome, issue_tags, would_make_again, notes)
- [ ] 409 duplicate-window response is swallowed silently (no error shown to user)
- [ ] Network failure shows recoverable error message
- [ ] Notes clamped to 500 characters
- [ ] Notes empty/whitespace submitted as null

## Analytics events

- [ ] `postcook_prompt_viewed` fires when sheet opens
- [ ] `postcook_submitted` fires on successful submission (not on skip or duplicate)
- [ ] `postcook_skipped` fires when user taps Skip at any step
- [ ] `postcook_issue_tag_selected` fires when a tag chip is toggled
- [ ] `postcook_note_added` fires when notes field has content on submit
- [ ] `postcook_improve_clicked` fires when "Improve this recipe →" is tapped

## Rollback plan

1. Set `postcook_feedback_v1` flag to `false` in `feature_flags` table
2. Old cook-completion modal immediately restored (no code change needed)
3. Recipe detail reminder disappears immediately (flag-gated on server render)
4. Existing `recipe_postcook_feedback` rows are inert — they stay in DB but affect nothing
5. `user_taste_scores` updates from feedback events are fire-and-forget — no rollback needed
   for already-processed events (they represent real signal, not errors)

## Downstream gates for Plans C/D

- [ ] At least one real post-cook feedback event submitted end-to-end in staging
- [ ] `user_taste_scores` updated after that event (check via admin layer)
- [ ] Analytics events visible in `product_events` table
