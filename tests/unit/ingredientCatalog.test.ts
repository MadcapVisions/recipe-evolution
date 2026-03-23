import test from "node:test";
import assert from "node:assert/strict";
import { ALIAS_TO_ENTRY, CANONICAL_KEY_TO_ENTRY, FAMILY_KEY_TO_ENTRIES, INGREDIENT_CATALOG } from "../../lib/ai/ingredientCatalog";

test("ALIAS_TO_ENTRY resolves 'cannellini bean' (singular) to white_bean", () => {
  const entry = ALIAS_TO_ENTRY.get("cannellini bean");
  assert.ok(entry, "should find entry");
  assert.equal(entry!.canonical_key, "white_bean");
});

test("ALIAS_TO_ENTRY resolves 'green onion' to scallion", () => {
  const entry = ALIAS_TO_ENTRY.get("green onion");
  assert.ok(entry);
  assert.equal(entry!.canonical_key, "scallion");
});

test("ALIAS_TO_ENTRY resolves 'garbanzo bean' to chickpea", () => {
  const entry = ALIAS_TO_ENTRY.get("garbanzo bean");
  assert.ok(entry);
  assert.equal(entry!.canonical_key, "chickpea");
});

test("ALIAS_TO_ENTRY resolves 'sweet pepper' to bell_pepper", () => {
  const entry = ALIAS_TO_ENTRY.get("sweet pepper");
  assert.ok(entry);
  assert.equal(entry!.canonical_key, "bell_pepper");
});

test("ALIAS_TO_ENTRY resolves 'coriander leaves' to cilantro", () => {
  const entry = ALIAS_TO_ENTRY.get("coriander leaf");  // singularized form
  assert.ok(entry);
  assert.equal(entry!.canonical_key, "cilantro");
});

test("ALIAS_TO_ENTRY resolves 'rocket' to arugula", () => {
  const entry = ALIAS_TO_ENTRY.get("rocket");
  assert.ok(entry);
  assert.equal(entry!.canonical_key, "arugula");
});

test("ALIAS_TO_ENTRY resolves 'parmigiano' to parmesan", () => {
  const entry = ALIAS_TO_ENTRY.get("parmigiano");
  assert.ok(entry);
  assert.equal(entry!.canonical_key, "parmesan");
});

test("ALIAS_TO_ENTRY resolves 'prawns' to shrimp (singular: prawn)", () => {
  const entry = ALIAS_TO_ENTRY.get("prawn");
  assert.ok(entry);
  assert.equal(entry!.canonical_key, "shrimp");
});

test("ALIAS_TO_ENTRY resolves 'spaghetti' to pasta", () => {
  const entry = ALIAS_TO_ENTRY.get("spaghetti");
  assert.ok(entry);
  assert.equal(entry!.canonical_key, "pasta");
});

test("ALIAS_TO_ENTRY resolves 'tamari' to soy_sauce", () => {
  const entry = ALIAS_TO_ENTRY.get("tamari");
  assert.ok(entry);
  assert.equal(entry!.canonical_key, "soy_sauce");
});

test("ALIAS_TO_ENTRY resolves 'yam' to sweet_potato", () => {
  const entry = ALIAS_TO_ENTRY.get("yam");
  assert.ok(entry);
  assert.equal(entry!.canonical_key, "sweet_potato");
});

test("CANONICAL_KEY_TO_ENTRY has entries for all catalog items", () => {
  for (const entry of INGREDIENT_CATALOG) {
    const found = CANONICAL_KEY_TO_ENTRY.get(entry.canonical_key);
    assert.ok(found, `missing: ${entry.canonical_key}`);
    assert.equal(found!.canonical_id, entry.canonical_id);
  }
});

test("FAMILY_KEY_TO_ENTRIES groups bean family correctly", () => {
  const beans = FAMILY_KEY_TO_ENTRIES.get("bean");
  assert.ok(beans && beans.length >= 5, `expected >= 5 bean entries, got ${beans?.length}`);
  const keys = beans!.map((e) => e.canonical_key);
  assert.ok(keys.includes("white_bean"));
  assert.ok(keys.includes("chickpea"));
  assert.ok(keys.includes("black_bean"));
});

test("FAMILY_KEY_TO_ENTRIES groups herb family correctly", () => {
  const herbs = FAMILY_KEY_TO_ENTRIES.get("herb");
  assert.ok(herbs && herbs.length >= 8, `expected >= 8 herb entries, got ${herbs?.length}`);
  const keys = herbs!.map((e) => e.canonical_key);
  assert.ok(keys.includes("basil"));
  assert.ok(keys.includes("thai_basil"));
  assert.ok(keys.includes("cilantro"));
});

test("thai_basil and basil are distinct catalog entries with same family", () => {
  const basil = CANONICAL_KEY_TO_ENTRY.get("basil");
  const thaiBasil = CANONICAL_KEY_TO_ENTRY.get("thai_basil");
  assert.ok(basil);
  assert.ok(thaiBasil);
  assert.notEqual(basil!.canonical_id, thaiBasil!.canonical_id);
  assert.equal(basil!.family_key, thaiBasil!.family_key);
});

test("no duplicate canonical_ids in catalog", () => {
  const ids = INGREDIENT_CATALOG.map((e) => e.canonical_id);
  const unique = new Set(ids);
  assert.equal(unique.size, ids.length, "duplicate canonical_ids found");
});

test("no duplicate canonical_keys in catalog", () => {
  const keys = INGREDIENT_CATALOG.map((e) => e.canonical_key);
  const unique = new Set(keys);
  assert.equal(unique.size, keys.length, "duplicate canonical_keys found");
});
