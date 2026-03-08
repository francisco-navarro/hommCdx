import { TILE_TYPES } from "./config.mjs";

export function seededValue(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

export function createWorldTiles(world) {
  const tiles = new Uint8Array(world.cols * world.rows);
  tiles.fill(TILE_TYPES.GRASS);

  paintWaterBodies(tiles, world);
  paintRoads(tiles, world);
  paintWaterBorders(tiles, world);

  return tiles;
}

function indexOf(world, x, y) {
  return y * world.cols + x;
}

function inBounds(world, x, y) {
  return x >= 0 && y >= 0 && x < world.cols && y < world.rows;
}

function paintWaterBodies(tiles, world) {
  const lakeCount = Math.max(3, Math.floor(Math.min(world.cols, world.rows) / 12));
  for (let i = 0; i < lakeCount; i += 1) {
    const cx = Math.floor(seededValue(100 + i * 13, 201 + i * 17) * world.cols);
    const cy = Math.floor(seededValue(300 + i * 19, 401 + i * 23) * world.rows);
    const baseRadius = 2 + Math.floor(seededValue(500 + i * 29, 601 + i * 31) * 5);

    for (let y = Math.max(0, cy - baseRadius - 2); y <= Math.min(world.rows - 1, cy + baseRadius + 2); y += 1) {
      for (let x = Math.max(0, cx - baseRadius - 2); x <= Math.min(world.cols - 1, cx + baseRadius + 2); x += 1) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.hypot(dx, dy);
        const wobble = seededValue(700 + x * 3 + i, 800 + y * 5 + i) * 1.8;
        if (dist < baseRadius + wobble - 0.5) {
          tiles[indexOf(world, x, y)] = TILE_TYPES.WATER;
        }
      }
    }
  }
}

function paintRoads(tiles, world) {
  const horizontalStartY = Math.floor(
    seededValue(901, 1011) * (world.rows - 4)
  ) + 2;
  const verticalStartX = Math.floor(
    seededValue(1111, 1211) * (world.cols - 4)
  ) + 2;

  carveRoad(tiles, world, 0, horizontalStartY, "horizontal");
  carveRoad(tiles, world, verticalStartX, 0, "vertical");
}

function carveRoad(tiles, world, startX, startY, mode) {
  let x = startX;
  let y = startY;
  let prevDx = 0;
  let prevDy = 0;
  let steps = 0;
  const maxSteps = world.cols * world.rows;

  while (inBounds(world, x, y) && steps < maxSteps) {
    let dx = 0;
    let dy = 0;
    const turnBias = seededValue(1300 + x * 7 + steps, 1400 + y * 11 + steps);

    if (mode === "horizontal") {
      dx = 1;
      if (turnBias > 0.82) dy = 1;
      else if (turnBias < 0.18) dy = -1;
    } else {
      dy = 1;
      if (turnBias > 0.82) dx = 1;
      else if (turnBias < 0.18) dx = -1;
    }

    const idx = indexOf(world, x, y);
    if (dy !== 0 && dx !== 0) {
      const turnRight = dx * prevDy - dy * prevDx > 0;
      tiles[idx] = turnRight ? TILE_TYPES.CORNER_1 : TILE_TYPES.CORNER_2;
    } else if (dx !== 0) {
      tiles[idx] = TILE_TYPES.PATH_H;
    } else {
      tiles[idx] = TILE_TYPES.PATH_V;
    }

    prevDx = dx;
    prevDy = dy;
    x += dx;
    y += dy;
    x = Math.max(0, Math.min(world.cols - 1, x));
    y = Math.max(0, Math.min(world.rows - 1, y));

    if (mode === "horizontal" && x >= world.cols - 1) break;
    if (mode === "vertical" && y >= world.rows - 1) break;
    steps += 1;
  }
}

function paintWaterBorders(tiles, world) {
  const clone = new Uint8Array(tiles);
  for (let y = 0; y < world.rows; y += 1) {
    for (let x = 0; x < world.cols; x += 1) {
      const idx = indexOf(world, x, y);
      const current = clone[idx];
      if (
        current === TILE_TYPES.WATER ||
        current === TILE_TYPES.PATH_H ||
        current === TILE_TYPES.PATH_V ||
        current === TILE_TYPES.CORNER_1 ||
        current === TILE_TYPES.CORNER_2
      ) {
        continue;
      }

      if (hasWaterNeighbor(clone, world, x, y)) {
        tiles[idx] = TILE_TYPES.WATER_BORDER;
      }
    }
  }
}

function hasWaterNeighbor(tiles, world, x, y) {
  const neighbors = [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ];

  for (let i = 0; i < neighbors.length; i += 1) {
    const [nx, ny] = neighbors[i];
    if (!inBounds(world, nx, ny)) continue;
    if (tiles[indexOf(world, nx, ny)] === TILE_TYPES.WATER) return true;
  }
  return false;
}

export function getWorldSize(world) {
  return {
    width: world.cols * world.tileSize,
    height: world.rows * world.tileSize,
  };
}
