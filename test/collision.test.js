const test = require("node:test");
const assert = require("node:assert/strict");
const {
  worldToTile,
  tileToCenter,
  findLastWalkableTileOnLine,
  clampMovementToWalkableSegment,
} = require("../server/game/collision");

test("worldToTile and tileToCenter map consistently", () => {
  const world = { cols: 10, rows: 10, tileSize: 32 };
  const t = worldToTile(world, 70, 95);
  assert.deepEqual(t, { col: 2, row: 2 });
  const c = tileToCenter(world, t.col, t.row);
  assert.deepEqual(c, { x: 64, y: 64 });
});

test("findLastWalkableTileOnLine stops before blocked tile", () => {
  const blocked = new Set(["3,1"]);
  const isWalkable = (col, row) => !blocked.has(`${col},${row}`);

  const last = findLastWalkableTileOnLine(
    { col: 1, row: 1 },
    { col: 6, row: 1 },
    isWalkable
  );
  assert.deepEqual(last, { col: 2, row: 1 });
});

test("clampMovementToWalkableSegment returns previous valid position when blocked", () => {
  const world = { tileSize: 32 };
  const blockedAt = 65;
  const result = clampMovementToWalkableSegment(
    world,
    { x: 32, y: 32 },
    { x: 96, y: 32 },
    (x) => x < blockedAt
  );

  assert.equal(result.blocked, true);
  assert.ok(result.x < blockedAt);
});
