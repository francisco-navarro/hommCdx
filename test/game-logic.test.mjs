import test from "node:test";
import assert from "node:assert/strict";

import {
  clamp,
  updatePlayerTowardsTarget,
  clampPlayerToWorld,
  computeCamera,
  screenClickToWorld,
} from "../public/game-logic.mjs";

test("clamp keeps values inside range", () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(clamp(14, 0, 10), 10);
});

test("updatePlayerTowardsTarget moves player by speed and dt", () => {
  const player = { x: 0, y: 0, speed: 100 };
  const moveTarget = { x: 100, y: 0, active: true };

  const result = updatePlayerTowardsTarget(player, moveTarget, 0.5);
  assert.equal(result.player.x, 50);
  assert.equal(result.player.y, 0);
  assert.equal(result.moveTarget.active, true);
});

test("updatePlayerTowardsTarget snaps to target when close", () => {
  const player = { x: 98.8, y: 100, speed: 100 };
  const moveTarget = { x: 100, y: 100, active: true };

  const result = updatePlayerTowardsTarget(player, moveTarget, 0.016);
  assert.equal(result.player.x, 100);
  assert.equal(result.player.y, 100);
  assert.equal(result.moveTarget.active, false);
});

test("clampPlayerToWorld keeps player in map bounds", () => {
  const clamped = clampPlayerToWorld({ x: -10, y: 9000, speed: 1 }, 500, 400);
  assert.equal(clamped.x, 0);
  assert.equal(clamped.y, 400);
});

test("computeCamera clamps viewport in world", () => {
  const camera = computeCamera({ x: 50, y: 50 }, { width: 200, height: 100 }, 500, 400);
  assert.deepEqual(camera, { x: 50, y: 50 });

  const camera2 = computeCamera(
    { x: 490, y: 390 },
    { width: 200, height: 100 },
    500,
    400
  );
  assert.deepEqual(camera2, { x: 490, y: 390 });
});

test("screenClickToWorld converts screen click to clamped world coordinates", () => {
  const click = { clientX: 350, clientY: 225 };
  const rect = { left: 100, top: 100, width: 500, height: 250 };
  const view = { width: 1000, height: 500 };
  const camera = { x: 320, y: 160 };
  const world = { tileSize: 32, isoTileWidth: 128, isoTileHeight: 64 };

  const worldPos = screenClickToWorld(click, rect, view, camera, world, 1200, 900);
  assert.deepEqual(worldPos, { x: 320, y: 160 });

  const outside = { clientX: -500, clientY: -500 };
  const clamped = screenClickToWorld(outside, rect, view, camera, world, 1200, 900);
  assert.deepEqual(clamped, { x: 0, y: 0 });
});
