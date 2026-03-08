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

  const seen = new Set();
  let hasRoad = false;
  let hasWater = false;
  let hasWaterBorder = false;
  let hasWaterCorner = false;
  let hasCorner = false;
  let hasTrees = false;
  let hasGrass2 = false;
  let hasSawmill = false;
  let hasGoldMine = false;
  let hasCastleRed = false;
  let hasCastleYellow = false;

  for (const tile of first) {
    assert.ok(tile >= 0 && tile <= 23);
    seen.add(tile);
    if (tile === 1 || tile === 2 || tile === 5 || tile === 6 || tile === 7 || tile === 8 || tile === 15) {
      hasRoad = true;
    }
    if (tile === 5 || tile === 6 || tile === 7 || tile === 8 || tile === 15) hasCorner = true;
    if (tile === 3) hasWater = true;
    if (tile === 4 || tile === 17 || tile === 18 || tile === 19) hasWaterBorder = true;
    if (tile >= 10 && tile <= 13) hasWaterCorner = true;
    if (tile === 9 || tile === 14) hasTrees = true;
    if (tile === 16) hasGrass2 = true;
    if (tile === 20) hasSawmill = true;
    if (tile === 21) hasGoldMine = true;
    if (tile === 22) hasCastleRed = true;
    if (tile === 23) hasCastleYellow = true;
  }

  assert.equal(hasRoad, true);
  assert.equal(hasCorner, true);
  assert.equal(hasWater, true);
  assert.equal(hasWaterBorder, true);
  assert.equal(hasWaterCorner, false);
  assert.equal(hasTrees, true);
  assert.equal(hasGrass2, true);
  assert.equal(hasSawmill, true);
  assert.equal(hasGoldMine, true);
  assert.equal(hasCastleRed, true);
  assert.equal(hasCastleYellow, true);
  assert.ok(seen.size >= 5);
});

test("createInitialState starts player centered in world", () => {
  const world = { cols: 10, rows: 12, tileSize: 32 };
  const view = { width: 320, height: 240 };
  const state = createInitialState(world, view);

  assert.equal(state.player.x, 160);
  assert.equal(state.player.y, 192);
  assert.equal(state.moveTarget.active, false);
  assert.deepEqual(state.camera, { x: 160, y: 192 });
});

test("setMoveTargetFromClick maps click to world and activates target", () => {
  const world = {
    cols: 10,
    rows: 10,
    tileSize: 32,
    isoTileWidth: 128,
    isoTileHeight: 64,
  };
  const view = { width: 320, height: 160 };
  const state = {
    player: { x: 100, y: 100, speed: 300, size: 18 },
    camera: { x: 40, y: 60 },
    moveTarget: { x: 0, y: 0, active: false },
  };

  const click = { clientX: 150, clientY: 100 };
  const rect = { left: 50, top: 50, width: 200, height: 100 };
  const next = setMoveTargetFromClick(state, click, rect, world, view);

  assert.deepEqual(next.moveTarget, { x: 40, y: 60, active: true });
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
