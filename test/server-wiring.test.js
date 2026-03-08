const test = require("node:test");
const assert = require("node:assert/strict");

test("server index exports startServer", () => {
  const mod = require("../server/index");
  assert.equal(typeof mod.startServer, "function");
});
