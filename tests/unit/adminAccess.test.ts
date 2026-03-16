import test from "node:test";
import assert from "node:assert/strict";
import { canAccessAdmin, getAdminEmails } from "../../lib/auth/adminAccess";

test("getAdminEmails normalizes and deduplicates configured emails", () => {
  const original = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = "Chef@Example.com, chef@example.com, ops@example.com ";

  assert.deepEqual(getAdminEmails(), ["chef@example.com", "ops@example.com"]);

  process.env.ADMIN_EMAILS = original;
});

test("canAccessAdmin honors allowlist", () => {
  const original = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = "chef@example.com";

  assert.equal(canAccessAdmin("chef@example.com"), true);
  assert.equal(canAccessAdmin("other@example.com"), false);

  process.env.ADMIN_EMAILS = original;
});
