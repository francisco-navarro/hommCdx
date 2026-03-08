import test from "node:test";
import assert from "node:assert/strict";

import { createWorldTiles, seededValue } from "../public/world.mjs";
import {
  createInitialState,
  setMoveTargetFromClick,
  updateGameState,
} from "../public/state.mjs";

test("seededValue is deterministic for same coordinates", () => {
  const a = seededValue(10, 22);
  const b = seededValue(10, 22);
  assert.equal(a, b);
});

test("createWorldTiles is deterministic and within expected tile ids", () => {
  const world = { cols: 24, rows: 18, tileSize: 32 };
  const first = createWorldTiles(world);
  const second = createWorldTiles(world);

  assert.deepEqual([...first], [...second]);
  assert.equal(first.length, 432);

  let hasHorizontal = false;
  let hasVertical = false;

  for (const tile of first) {
    assert.ok(tile >= 0 && tile <= 2);
    if (tile === 1) hasHorizontal = true;
    if (tile === 2) hasVertical = true;
  }

  assert.equal(hasHorizontal, true);
  assert.equal(hasVertical, true);
});

test("createInitialState starts player centered in world", () => {
  const world = { cols: 10, rows: 12, tileSize: 32 };
  const view = { width: 320, height: 240 };
  const state = createInitialState(world, view);

  assert.equal(state.player.x, 160);
  assert.equal(state.player.y, 192);
  assert.equal(state.moveTarget.active, false);
  assert.deepEqual(state.camera, { x: 0, y: 72 });
});

test("setMoveTargetFromClick maps click to world and activates target", () => {
  const world = { cols: 10, rows: 10, tileSize: 32 };
  const view = { width: 320, height: 160 };
  const state = {
    player: { x: 100, y: 100, speed: 300, size: 18 },
    camera: { x: 40, y: 60 },
    moveTarget: { x: 0, y: 0, active: false },
  };

  const click = { clientX: 150, clientY: 100 };
  const rect = { left: 50, top: 50, width: 200, height: 100 };
  const next = setMoveTargetFromClick(state, click, rect, world, view);

  assert.deepEqual(next.moveTarget, { x: 200, y: 140, active: true });
});

test("updateGameState advances player toward click target", () => {
  const world = { cols: 10, rows: 10, tileSize: 32 };
  const view = { width: 320, height: 160 };
  const state = {
    player: { x: 0, y: 0, speed: 100, size: 18 },
    camera: { x: 0, y: 0 },
    moveTarget: { x: 100, y: 0, active: true },
  };

  const next = updateGameState(state, world, view, 0.2);
  assert.equal(next.player.x, 20);
  assert.equal(next.player.y, 0);
  assert.equal(next.moveTarget.active, true);
});
