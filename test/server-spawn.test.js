const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { createGameEngine } = require("../server/game/engine");

test("players spawn on walkable tile centers", async () => {
  const publicDir = path.join(__dirname, "..", "public");
  const engine = await createGameEngine(publicDir);
  const player = engine.ensurePlayer("spawn_test_session", "SpawnTester");

  const centerOffset = engine.world.tileSize / 2;
  assert.equal((player.player.x - centerOffset) % engine.world.tileSize, 0);
  assert.equal((player.player.y - centerOffset) % engine.world.tileSize, 0);
  assert.equal(engine.isWalkableAtWorld(player.player.x, player.player.y), true);
});
