const test = require("node:test");
const assert = require("node:assert/strict");
const { hashPassword, verifyPassword } = require("../server/auth/password");

test("hashPassword and verifyPassword work for valid and invalid password", () => {
  const stored = hashPassword("abc12345");
  assert.equal(typeof stored, "string");
  assert.equal(verifyPassword("abc12345", stored), true);
  assert.equal(verifyPassword("other-password", stored), false);
});
