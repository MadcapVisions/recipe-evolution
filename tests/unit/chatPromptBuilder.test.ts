import test from "node:test";
import assert from "node:assert/strict";
import { buildChefChatPrompt } from "../../lib/ai/chatPromptBuilder";

test("buildChefChatPrompt includes conversation mode guidance", () => {
  const messages = buildChefChatPrompt("I want a Mexican burrito dish.", null, []);

  const systemMessages = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n");

  assert.match(systemMessages, /You are in conversation mode only\./);
  assert.match(systemMessages, /Give the user concrete meal direction quickly\./);
});

test("buildChefChatPrompt includes user taste profile section", () => {
  const messages = buildChefChatPrompt("I want tacos.", null, [], "Prefers spicy food.");
  const systemMessages = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n");

  assert.match(systemMessages, /User Taste Profile:/);
  assert.match(systemMessages, /Prefers spicy food\./);
});

test("buildChefChatPrompt includes session memory when provided", () => {
  const messages = buildChefChatPrompt("Give me other options.", null, [], undefined, "Session memory:\n- Active dish: 100 Grand dessert");
  const systemMessages = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n");

  assert.match(systemMessages, /Session memory:/);
  assert.match(systemMessages, /Active dish: 100 Grand dessert/);
});
