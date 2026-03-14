import test from "node:test";
import assert from "node:assert/strict";
import { hashAiCacheInput } from "../../lib/ai/cache";

test("hashAiCacheInput is stable for equivalent object key order", () => {
  const first = {
    prompt: "lemon chicken",
    options: {
      count: 2,
      filters: ["quick", "healthy"],
    },
  };

  const second = {
    options: {
      filters: ["quick", "healthy"],
      count: 2,
    },
    prompt: "lemon chicken",
  };

  assert.equal(hashAiCacheInput(first), hashAiCacheInput(second));
});

test("hashAiCacheInput changes when normalized content changes", () => {
  const base = {
    prompt: "lemon chicken",
    ingredients: ["chicken", "lemon"],
  };

  const changed = {
    prompt: "lemon chicken",
    ingredients: ["chicken", "lime"],
  };

  assert.notEqual(hashAiCacheInput(base), hashAiCacheInput(changed));
});

test("hashAiCacheInput preserves array order significance", () => {
  const first = {
    ingredients: ["chicken", "lemon"],
  };

  const second = {
    ingredients: ["lemon", "chicken"],
  };

  assert.notEqual(hashAiCacheInput(first), hashAiCacheInput(second));
});
