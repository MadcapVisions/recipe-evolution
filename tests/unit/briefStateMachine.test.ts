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

test("deriveBriefRequestMode returns locked when assistant has locked direction", () => {
  assert.equal(
    deriveBriefRequestMode({
      latestUserMessage: "Yes, let's do that",
      latestAssistantMessage: "Locked direction: Focaccia Pizza. Sheet-pan style with tomato sauce and mozzarella.",
      conversationHistory: [],
    }),
    "locked"
  );
});

test("deriveBriefRequestMode returns revise for modification prompt on locked direction", () => {
  assert.equal(
    deriveBriefRequestMode({
      latestUserMessage: "Make it vegetarian but keep the same pasta shape",
      latestAssistantMessage: "Locked direction: Pasta Primavera. Bright pasta with spring vegetables.",
      conversationHistory: [],
    }),
    "revise"
  );
});
