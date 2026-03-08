import {
  clampPlayerToWorld,
  computeCamera,
  screenClickToWorld,
  updatePlayerTowardsTarget,
} from "./game-logic.mjs";
import { PLAYER_CONFIG } from "./config.mjs";
import { getWorldSize } from "./world.mjs";

export function createInitialState(world, view) {
  const { width, height } = getWorldSize(world);
  const player = {
    x: width / 2,
    y: height / 2,
    size: PLAYER_CONFIG.size,
    speed: PLAYER_CONFIG.speed,
  };

  return {
    player,
    camera: computeCamera(player, view, width, height),
    moveTarget: {
      active: false,
      x: player.x,
      y: player.y,
    },
  };
}

export function updateGameState(state, world, view, dt) {
  const movement = updatePlayerTowardsTarget(state.player, state.moveTarget, dt);
  const { width, height } = getWorldSize(world);
  const player = clampPlayerToWorld(movement.player, width, height);
  const camera = computeCamera(player, view, width, height);

  return {
    ...state,
    player,
    camera,
    moveTarget: movement.moveTarget,
  };
}

export function setMoveTargetFromClick(state, click, rect, world, view) {
  const { width, height } = getWorldSize(world);
  const moveTarget = screenClickToWorld(
    click,
    rect,
    view,
    state.camera,
    world,
    width,
    height
  );

  return {
    ...state,
    moveTarget: {
      ...moveTarget,
      active: true,
    },
  };
}
