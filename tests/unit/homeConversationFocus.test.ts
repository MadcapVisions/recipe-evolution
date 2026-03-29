import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDirectionSummary,
  buildFocusedChatHistory,
  buildFocusedRecipeConversation,
  buildReplyBranch,
  buildReplyThread,
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

test("buildFocusedChatHistory keeps the original dish anchor when the user asks for different options again", () => {
  const history = buildFocusedChatHistory([
    { role: "user", text: "I want a dessert inspired by a 100 Grand bar." },
    { role: "ai", text: "Option 1 caramel crunch tart. Option 2 no-bake bar. Option 3 ice cream sundae." },
    { role: "user", text: "Those are the same options you first gave me, I want 3 different options." },
    { role: "ai", text: "Here are three other 100 Grand-inspired directions." },
  ]);

  assert.deepEqual(history, [
    { role: "user", content: "I want a dessert inspired by a 100 Grand bar." },
    { role: "assistant", content: "Option 1 caramel crunch tart. Option 2 no-bake bar. Option 3 ice cream sundae." },
    { role: "user", content: "Those are the same options you first gave me, I want 3 different options." },
    { role: "assistant", content: "Here are three other 100 Grand-inspired directions." },
  ]);
});

test("buildFocusedRecipeConversation keeps the original dish anchor across repeated option requests", () => {
  const focused = buildFocusedRecipeConversation([
    { role: "user", text: "I want a dessert inspired by a 100 Grand bar." },
    { role: "ai", text: "Option 1 caramel crunch tart. Option 2 no-bake bar. Option 3 ice cream sundae." },
    { role: "user", text: "Those are the same options you first gave me, I want 3 different options." },
    { role: "ai", text: "Here are three other 100 Grand-inspired directions." },
  ]);

  assert.deepEqual(focused, [
    { role: "user", text: "I want a dessert inspired by a 100 Grand bar." },
    { role: "ai", text: "Option 1 caramel crunch tart. Option 2 no-bake bar. Option 3 ice cream sundae." },
    { role: "user", text: "Those are the same options you first gave me, I want 3 different options." },
    { role: "ai", text: "Here are three other 100 Grand-inspired directions." },
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

test("buildReplyThread keeps earlier user constraints when building from a later assistant reply", () => {
  const thread = buildReplyThread(
    [
      { role: "user", text: "I want salted caramelized banana bread pudding with sourdough discard." },
      { role: "ai", text: "Start with caramelized bananas and sourdough discard in the custard." },
      { role: "user", text: "Make it creamy and wet." },
      { role: "ai", text: "Soak the stale bread longer and increase the custard slightly." },
    ],
    3
  );

  assert.deepEqual(thread, [
    { role: "user", text: "I want salted caramelized banana bread pudding with sourdough discard." },
    { role: "ai", text: "Start with caramelized bananas and sourdough discard in the custard." },
    { role: "user", text: "Make it creamy and wet." },
    { role: "ai", text: "Soak the stale bread longer and increase the custard slightly." },
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
