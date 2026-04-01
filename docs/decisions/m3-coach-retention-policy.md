# M3 Coach Sidecar Retention Policy

Ticket 4.3 — Backend / Data
Date: 2026-04-01

## Table

`recipe_coach_layers`

## Policy

### Saved-version-linked coach artifacts

Coach sidecars linked to a saved `recipe_version_id` persist long-term.
The `ON DELETE CASCADE` on the `recipe_version_id` foreign key ensures that if the
recipe version is deleted, its coach sidecar is automatically cleaned up.
No separate retention job or manual cleanup is needed for these rows.

### Request-only transient builds

Coach artifacts are only written when a stable `recipe_version_id` exists.
Request-only builds (where generation completes but the user has not saved a version)
do not produce `recipe_coach_layers` rows. There are no orphaned transient artifacts.

### Consequence

No silent infinite-growth risk for M3 scope. Coach rows exist only as long as their
parent recipe version exists. Cascade delete handles cleanup automatically.

## Future consideration

If a future milestone introduces a staging or draft-version concept (recipe generated
but not yet saved), that flow should explicitly decide whether to write a transient coach
row and define a TTL or cleanup strategy at that point. Do not assume M3 policy covers it.
