# M3 Authority Boundaries

Ticket 1.3 — Backend / AI
Date: 2026-03-31

## One-sentence answer

**CookingCoach owns actionable pre-cook guidance, step-linked cues, mistake prevention,
and in-session recovery moves for migrated recipes.**

---

## Full authority map

### ResolvedCookingIntent
**Owns:** User meaning — what the user asked for, dish family, constraints, ingredient mentions,
pivot detection, clarification requirements.
**Does not own:** Planning, scoring, coaching, recipe structure.

### CulinaryBlueprint
**Owns:** Culinary planning — dish components, ingredient roles, cook methods, flavor architecture,
sequence logic, feasibility flags, chef opportunities.
**Does not own:** User intent resolution, recipe text, scoring, coaching guidance.

### Recipe draft / result (RecipeDraft, AiRecipeResult)
**Owns:** The cookable recipe — title, ingredients, steps, servings, timing.
**Does not own:** Planning inputs, scores, coaching content.

### Validation modules (recipeStructuralValidation.ts, culinaryValidator.ts)
**Owns:** Structural and culinary correctness judgments — missing steps, ingredient conflicts,
technique violations, validation truth.
**Does not own:** Planning, scoring, coaching.

### ChefScore / DelightScore
**Owns:** Quality scoring — subscores by dimension (flavor, technique, texture, harmony,
clarity, risk), improvement priorities, score bands.
**Does not own:** Coaching guidance, rescue moves, step-linked cues.

### CookingCoach (this milestone)
**Owns:**
- Pre-cook confidence guidance (chef secrets, watch-fors, mistake prevention)
- Step-linked sensory cues for Cook mode
- In-session recovery moves for cook-time failures

**Does not own:**
- Recipe meaning (belongs to ResolvedCookingIntent)
- Planning decisions (belongs to CulinaryBlueprint)
- Quality scores (belongs to ChefScore)
- Recipe-improvement recommendations (belongs to chef-fix / future Improve with Max flow)
- Validation truth (belongs to validation modules)

### chef-fix (future)
**Owns:** Recipe-improvement recommendations — changes to recipe versions for next time.
**Relationship to CookingCoach:** Distinct. Recovery moves in CookingCoach are for saving
the current dish NOW. Chef-fix is for improving the recipe for NEXT TIME. These must remain
separate flows unless explicitly unified in a future milestone.

---

## Constraints

1. **CookingCoach must not silently become a planning layer.**
   Coach guidance is derived FROM the blueprint, not parallel to it.

2. **CookingCoach must not override validation truth.**
   If a recipe has structural or culinary validation failures, coaching does not paper over them.

3. **CookingCoach must not silently become a scoring layer.**
   Coach content is not scored. It exists to help the cook, not to rate the recipe.

4. **CookingCoach must not become a recipe-improvement layer.**
   Recovery moves say "here is how to save this dish right now."
   They do not say "here is how to change the recipe for next time."

5. **Coach generation in M3 is rule-based and deterministic.**
   No LLM call. Same inputs produce the same CookingCoach output.
   This keeps coaching auditable and testable.

---

## See also

- `docs/decisions/m3-coaching-overlap-audit.md` — module classification
- `docs/decisions/authority-boundaries.md` — M2 contract hierarchy (Blueprint, BuildSpec, etc.)
- `lib/ai/coaching/coachTypes.ts` — canonical CookingCoach type definition
