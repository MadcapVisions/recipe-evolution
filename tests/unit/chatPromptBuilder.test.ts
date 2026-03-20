import test from "node:test";
import assert from "node:assert/strict";
import { buildChefChatPrompt } from "../../lib/ai/chatPromptBuilder";

test("buildChefChatPrompt includes active conversation rails when provided", () => {
  const messages = buildChefChatPrompt(
    "I want a Mexican burrito dish.",
    null,
    [],
    undefined,
    ["Chicken", "Mexican", "30 min"]
  );

  const systemMessages = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n");

  assert.match(systemMessages, /Active Conversation Rails:/);
  assert.match(systemMessages, /- Chicken/);
  assert.match(systemMessages, /do not ask whether they want vegetarian/i);
});

test("buildChefChatPrompt omits rails block when no rails are active", () => {
  const messages = buildChefChatPrompt("I want tacos.", null, []);
  const systemMessages = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n");

  assert.doesNotMatch(systemMessages, /Active Conversation Rails:/);
});
