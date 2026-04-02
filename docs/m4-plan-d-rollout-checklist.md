# Milestone 4 Plan D — Product Consumers Rollout Checklist

## D1: Improve with Max post-cook context

- [ ] `IMPROVE_WITH_FEEDBACK_V1` feature flag exists and defaults to `false`
- [ ] `lib/ai/feedback/buildPostCookImproveContext.ts` exists and exports `formatPostCookImproveContext` (pure) + `buildPostCookImproveContext` (async)
- [ ] 6 formatter tests pass: `npm run test:unit 2>&1 | grep buildPostCookImproveContext`
- [ ] `ImproveRecipeInput` has `postCookContext?: string | null` field
- [ ] System prompt injects post-cook context block after user taste summary
- [ ] With flag off: `postCookContext` is null and system prompt is unchanged
- [ ] With flag on + prior feedback: context string appears in system prompt
- [ ] With flag on + no feedback: context is null, system prompt unaffected

## D2: Library resurfacing shelf

- [ ] `LIBRARY_RESURFACING_V1` feature flag exists and defaults to `false`
- [ ] `lib/recipes/resurfacingData.ts` exports `getResurfacingData` and `ResurfacingData` type
- [ ] `components/recipes/LibraryResurfacingShelf.tsx` renders shelf sections for each non-empty bucket
- [ ] `RecipesBrowser` accepts `resurfacingShelf?: ResurfacingData` prop
- [ ] With flag off: `RecipesBrowser` renders without shelf prop, no change
- [ ] With flag on + no cook history: shelf is undefined / component renders nothing
- [ ] With flag on + cook history: shelf rows visible above recipe grid
- [ ] Shelf item links point to correct `/recipes/{id}/versions/{versionId}`

## D3: Create personalization

- [ ] `CREATE_PERSONALIZATION_V1` feature flag exists and defaults to `false`
- [ ] `lib/postcook/buildCreateSuggestions.ts` exports `mapPatternsToSuggestions` (pure) + `buildCreateSuggestions` (server-only)
- [ ] 7 mapper tests pass: `npm run test:unit 2>&1 | grep buildCreateSuggestions`
- [ ] `NewRecipeForm` accepts `suggestions?: string[]` prop
- [ ] With flag off: `suggestions` is empty, no chips rendered
- [ ] With flag on + no signals (low confidence): no chips rendered
- [ ] With flag on + signals: chips visible; clicking chip appends to description field
- [ ] Personalization failure (network/DB error) is caught, form still loads

## Rollback plan

1. All Plan D code is additive — no existing behavior is removed
2. Set `IMPROVE_WITH_FEEDBACK_V1`, `LIBRARY_RESURFACING_V1`, `CREATE_PERSONALIZATION_V1` flags to `false` to disable all surfaces
3. `buildPostCookImproveContext` returns null on any DB error — improve-recipe pipeline unaffected
4. `buildCreateSuggestions` is wrapped in try/catch in the page — Create form always loads
5. `RecipesBrowser` renders normally when `resurfacingShelf` is undefined

## Gate for Plan E

- [ ] All 3 flag-gated surfaces are individually testable off/on
- [ ] `npm run test:unit` passes with ≥ 614 tests
- [ ] `npm run typecheck` passes clean
- [ ] `npm run lint` passes clean
