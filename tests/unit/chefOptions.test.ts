import test from "node:test";
import assert from "node:assert/strict";
import { buildChefChatEnvelope, extractChefOptions } from "../../lib/ai/chefOptions";

test("extractChefOptions parses compact labeled options from chef replies", () => {
  const options = extractChefOptions(`
OPTION 1: Bright shrimp eggplant pasta with tomato, garlic, and chili flakes for a lighter weeknight direction.
OPTION 2: Smoky shrimp rice bowl with charred vegetables and lime.
OPTION 3: Crispy shrimp tacos with slaw and spicy yogurt.
Best pick: the pasta.
  `);

  assert.equal(options.length, 3);
  assert.match(options[0]?.summary ?? "", /pasta/i);
  assert.match(options[1]?.summary ?? "", /rice bowl/i);
  assert.match(options[2]?.summary ?? "", /tacos/i);
});

test("buildChefChatEnvelope marks option mode and recommended option", () => {
  const envelope = buildChefChatEnvelope(`
OPTION 1: Bright shrimp eggplant pasta with tomato, garlic, and chili flakes for a lighter weeknight direction.
OPTION 2: Smoky shrimp rice bowl with charred vegetables and lime.
OPTION 3: Crispy shrimp tacos with slaw and spicy yogurt.
Best pick: the pasta.
  `);

  assert.equal(envelope.mode, "options");
  assert.equal(envelope.options.length, 3);
  assert.equal(envelope.recommended_option_id, "option-1");
});
