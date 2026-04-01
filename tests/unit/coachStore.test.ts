import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { persistCoachArtifact, loadCoachArtifact } from "../../lib/ai/coaching/coachStore";
import type { CookingCoach } from "../../lib/ai/coaching/coachTypes";

function makeCoach(): CookingCoach {
  return {
    chefSecrets: [
      { text: "Pat protein dry before searing", rationale: "Moisture prevents browning" },
    ],
    watchFors: [
      { cue: "Pan should shimmer but not smoke", importance: "critical" },
    ],
    mistakePreviews: [
      { mistake: "Crowding the pan", prevention: "Cook in batches", importance: "important" },
    ],
    recoveryMoves: [
      { scenario: "dry_protein", move: "Slice thin and serve with sauce", familyAware: true },
    ],
    generatedFrom: "req-001",
    generatedAt: "2026-03-31T00:00:00.000Z",
  };
}

test("persistCoachArtifact calls upsert with correct fields", async () => {
  let capturedTable = "";
  let capturedPayload: unknown = null;
  let capturedOptions: unknown = null;

  const supabase = {
    from(table: string) {
      capturedTable = table;
      return {
        upsert(payload: unknown, options: unknown) {
          capturedPayload = payload;
          capturedOptions = options;
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  await persistCoachArtifact(supabase as unknown as SupabaseClient, {
    recipeVersionId: "version-1",
    userId: "user-1",
    coach: makeCoach(),
  });

  assert.equal(capturedTable, "recipe_coach_layers");
  const payload = capturedPayload as Record<string, unknown>;
  assert.equal(payload.recipe_version_id, "version-1");
  assert.equal(payload.user_id, "user-1");
  assert.ok(payload.coach_json !== null);
  const opts = capturedOptions as Record<string, unknown>;
  assert.equal(opts.onConflict, "recipe_version_id");
});

test("persistCoachArtifact does not throw on supabase error", async () => {
  const supabase = {
    from() {
      return {
        upsert() {
          return Promise.resolve({ error: { message: "DB error" } });
        },
      };
    },
  };

  // Should not throw
  await assert.doesNotReject(
    persistCoachArtifact(supabase as unknown as SupabaseClient, {
      recipeVersionId: "version-1",
      userId: "user-1",
      coach: makeCoach(),
    })
  );
});

test("loadCoachArtifact returns coach when row exists", async () => {
  const coach = makeCoach();
  const supabase = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle() {
          return Promise.resolve({ data: { coach_json: coach }, error: null });
        },
      };
    },
  };

  const result = await loadCoachArtifact(supabase as unknown as SupabaseClient, {
    recipeVersionId: "version-1",
    userId: "user-1",
  });

  assert.ok(result !== null);
  assert.equal(result!.generatedFrom, "req-001");
  assert.equal(result!.chefSecrets.length, 1);
});

test("loadCoachArtifact returns null when no row exists", async () => {
  const supabase = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle() {
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
  };

  const result = await loadCoachArtifact(supabase as unknown as SupabaseClient, {
    recipeVersionId: "version-1",
    userId: "user-1",
  });
  assert.equal(result, null);
});

test("loadCoachArtifact returns null on supabase error without throwing", async () => {
  const supabase = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle() {
          return Promise.resolve({ data: null, error: { message: "DB error" } });
        },
      };
    },
  };

  const result = await loadCoachArtifact(supabase as unknown as SupabaseClient, {
    recipeVersionId: "version-1",
    userId: "user-1",
  });
  assert.equal(result, null);
});
