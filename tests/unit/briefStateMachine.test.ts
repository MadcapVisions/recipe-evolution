import test from "node:test";
import assert from "node:assert/strict";
import { deriveBriefRequestMode } from "../../lib/ai/briefStateMachine";

test("deriveBriefRequestMode returns compare for option-seeking prompts", () => {
  assert.equal(
    deriveBriefRequestMode({
      latestUserMessage: "Give me 3 options for dinner",
      conversationHistory: [],
    }),
    "compare"
  );
});

test("deriveBriefRequestMode returns locked when locked session is active", () => {
  assert.equal(
    deriveBriefRequestMode({
      latestUserMessage: "Yes, let's do that",
      lockedSessionState: "direction_locked",
    }),
    "locked"
  );
});

test("deriveBriefRequestMode returns revise for modification prompt on locked direction", () => {
  assert.equal(
    deriveBriefRequestMode({
      latestUserMessage: "Make it vegetarian but keep the same pasta shape",
      lockedSessionState: "ready_to_build",
    }),
    "revise"
  );
});

test("deriveBriefRequestMode keeps instead-of swaps in revise mode", () => {
  assert.equal(
    deriveBriefRequestMode({
      latestUserMessage: "use chicken thighs instead of breasts",
      lockedSessionState: "direction_locked",
      hasDishSignal: true,
    }),
    "revise"
  );
});

test("deriveBriefRequestMode treats first-message direct asks as locked when dish signal exists", () => {
  assert.equal(
    deriveBriefRequestMode({
      latestUserMessage: "traditional carbonara, no cream",
      hasDishSignal: true,
      hasConstraintSignal: true,
    }),
    "locked"
  );
});

test("deriveBriefRequestMode does not treat ingredient swaps using something else as a pivot", () => {
  assert.equal(
    deriveBriefRequestMode({
      latestUserMessage: "can we use something else instead of ricotta?",
      lockedSessionState: "direction_locked",
      hasDishSignal: true,
    }),
    "revise"
  );
});
