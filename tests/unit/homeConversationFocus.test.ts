import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDirectionSummary,
  buildFocusedChatHistory,
  buildFocusedRecipeConversation,
  buildReplyBranch,
} from "../../lib/ai/homeConversationFocus";

test("buildFocusedChatHistory keeps only the active branch tail", () => {
  const history = buildFocusedChatHistory([
    { role: "user", text: "I have shrimp, eggplant, pasta, tomatoes, and garlic. Give me 3 options." },
    { role: "ai", text: "Option 1: shrimp pasta. Option 2: rice bowl. Option 3: tacos." },
    { role: "user", text: "Let's do the pasta." },
    { role: "ai", text: "Go with a bright shrimp-eggplant pasta with tomato and garlic." },
  ]);

  assert.deepEqual(history, [
    { role: "user", content: "Let's do the pasta." },
    { role: "assistant", content: "Go with a bright shrimp-eggplant pasta with tomato and garlic." },
  ]);
});

test("buildFocusedRecipeConversation drops earlier option chatter once a newer direction exists", () => {
  const focused = buildFocusedRecipeConversation([
    { role: "user", text: "Give me 3 options." },
    { role: "ai", text: "Option 1 pasta. Option 2 bowl. Option 3 salad." },
    { role: "user", text: "Let's do the pasta." },
    { role: "ai", text: "Make it a bright shrimp and eggplant pasta." },
    { role: "user", text: "Yes to both cooking the pasta and the sauce." },
  ]);

  assert.deepEqual(focused, [
    { role: "user", text: "Let's do the pasta." },
    { role: "ai", text: "Make it a bright shrimp and eggplant pasta." },
    { role: "user", text: "Yes to both cooking the pasta and the sauce." },
  ]);
});

test("buildReplyBranch isolates a specific assistant direction", () => {
  const branch = buildReplyBranch(
    [
      { role: "user", text: "Give me options." },
      { role: "ai", text: "Option set one." },
      { role: "user", text: "What about the pasta option?" },
      { role: "ai", text: "Do a shrimp eggplant pasta with tomato and garlic." },
      { role: "user", text: "Keep it spicy." },
    ],
    3
  );

  assert.deepEqual(branch, [
    { role: "user", text: "What about the pasta option?" },
    { role: "ai", text: "Do a shrimp eggplant pasta with tomato and garlic." },
  ]);
});

test("buildDirectionSummary returns the active assistant direction without merging the user refinement text", () => {
  const summary = buildDirectionSummary([
    { role: "user", text: "Let's do the pasta." },
    { role: "ai", text: "Make it a bright shrimp and eggplant pasta with tomato and garlic." },
    { role: "user", text: "Keep it spicy and not too heavy." },
  ]);

  assert.match(summary, /shrimp and eggplant pasta/i);
  assert.doesNotMatch(summary, /spicy and not too heavy/i);
});
