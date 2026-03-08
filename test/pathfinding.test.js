const test = require("node:test");
const assert = require("node:assert/strict");
const { findPathAStar } = require("../server/game/pathfinding");

test("findPathAStar finds a detour around blocked tiles", () => {
  const world = { cols: 6, rows: 6 };
  const blocked = new Set(["2,1", "2,2", "2,3", "2,4"]);
  const isWalkable = (col, row) => !blocked.has(`${col},${row}`);

  const path = findPathAStar({ col: 1, row: 2 }, { col: 4, row: 2 }, world, isWalkable);

  assert.ok(path.length > 0);
  assert.deepEqual(path[0], { col: 1, row: 2 });
  assert.deepEqual(path[path.length - 1], { col: 4, row: 2 });
  for (const step of path) {
    assert.equal(isWalkable(step.col, step.row), true);
  }
});

test("findPathAStar reroutes target to nearest walkable tile when goal is blocked", () => {
  const world = { cols: 5, rows: 5 };
  const blocked = new Set(["3,3"]);
  const isWalkable = (col, row) => !blocked.has(`${col},${row}`);

  const path = findPathAStar({ col: 1, row: 1 }, { col: 3, row: 3 }, world, isWalkable);

  assert.ok(path.length > 0);
  assert.notDeepEqual(path[path.length - 1], { col: 3, row: 3 });
  assert.equal(isWalkable(path[path.length - 1].col, path[path.length - 1].row), true);
});

test("findPathAStar uses diagonal when it is available", () => {
  const world = { cols: 4, rows: 4 };
  const isWalkable = () => true;

  const path = findPathAStar({ col: 1, row: 1 }, { col: 2, row: 2 }, world, isWalkable);

  assert.deepEqual(path, [
    { col: 1, row: 1 },
    { col: 2, row: 2 },
  ]);
});

test("findPathAStar avoids diagonal corner cutting through blocked orthogonals", () => {
  const world = { cols: 4, rows: 4 };
  const blocked = new Set(["2,1", "1,2"]);
  const isWalkable = (col, row) => !blocked.has(`${col},${row}`);

  const path = findPathAStar({ col: 1, row: 1 }, { col: 2, row: 2 }, world, isWalkable);

  assert.ok(path.length > 0);
  assert.notDeepEqual(path, [
    { col: 1, row: 1 },
    { col: 2, row: 2 },
  ]);
});
