const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { createGameEngine } = require("../server/game/engine");

test("players spawn on walkable tile centers", async () => {
  const publicDir = path.join(__dirname, "..", "public");
  const engine = await createGameEngine(publicDir);
  const player = engine.ensurePlayer("spawn_test_session", "SpawnTester");
  const snap = engine.getSnapshotFor("spawn_test_session", { width: 960, height: 540 });

  assert.equal(player.player.x % engine.world.tileSize, 0);
  assert.equal(player.player.y % engine.world.tileSize, 0);
  assert.equal(engine.isWalkableAtWorld(player.player.x, player.player.y), true);
  assert.deepEqual(player.resources, { gold: 0, iron: 0, crystal: 0, mercury: 0 });
  assert.deepEqual(snap.state.resources, { gold: 0, iron: 0, crystal: 0, mercury: 0 });
});
