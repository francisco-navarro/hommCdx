import { TILE_TYPES } from "./config.mjs";

export function seededValue(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

export function createWorldTiles(world) {
  const tiles = new Uint8Array(world.cols * world.rows);
  tiles.fill(TILE_TYPES.GRASS);

  const horizontalStep = Math.max(6, Math.floor(world.rows / 8));
  const verticalStep = Math.max(6, Math.floor(world.cols / 8));
  const horizontalRoads = [];
  const verticalRoads = [];

  for (let y = horizontalStep; y < world.rows - horizontalStep; y += horizontalStep) {
    if (seededValue(11, y) > 0.35) {
      const jitter = Math.floor(seededValue(17, y) * 3) - 1;
      horizontalRoads.push(Math.min(world.rows - 1, Math.max(0, y + jitter)));
    }
  }

  for (let x = verticalStep; x < world.cols - verticalStep; x += verticalStep) {
    if (seededValue(x, 19) > 0.35) {
      const jitter = Math.floor(seededValue(x, 23) * 3) - 1;
      verticalRoads.push(Math.min(world.cols - 1, Math.max(0, x + jitter)));
    }
  }

  if (horizontalRoads.length === 0) {
    horizontalRoads.push(Math.floor(world.rows / 2));
  }
  if (verticalRoads.length === 0) {
    verticalRoads.push(Math.floor(world.cols / 2));
  }

  for (let i = 0; i < horizontalRoads.length; i += 1) {
    const y = horizontalRoads[i];
    for (let x = 0; x < world.cols; x += 1) {
      const idx = y * world.cols + x;
      tiles[idx] = TILE_TYPES.PATH_H;
    }
  }

  for (let i = 0; i < verticalRoads.length; i += 1) {
    const x = verticalRoads[i];
    for (let y = 0; y < world.rows; y += 1) {
      const idx = y * world.cols + x;
      tiles[idx] = TILE_TYPES.PATH_V;
    }
  }

  return tiles;
}

export function getWorldSize(world) {
  return {
    width: world.cols * world.tileSize,
    height: world.rows * world.tileSize,
  };
}
