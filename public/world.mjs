import { GENERATION_RULES, TILE_TYPES } from "./map-config.mjs";

export function seededValue(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

export function createWorldTiles(world) {
  const tiles = new Uint8Array(world.cols * world.rows);
  tiles.fill(TILE_TYPES.GRASS);

  paintWaterBodies(tiles, world);
  paintRoadNetwork(tiles, world);
  paintWaterBorders(tiles, world);
  paintTreePatches(tiles, world);
  paintGrassVariation(tiles, world);
  paintStructures(tiles, world);
  enforceCastleSouthRoads(tiles, world);

  return tiles;
}

function indexOf(world, x, y) {
  return y * world.cols + x;
}

function inBounds(world, x, y) {
  return x >= 0 && y >= 0 && x < world.cols && y < world.rows;
}

function paintWaterBodies(tiles, world) {
  const lakeCount = Math.max(
    GENERATION_RULES.water.minLakes,
    Math.floor(Math.min(world.cols, world.rows) / 12)
  );
  for (let i = 0; i < lakeCount; i += 1) {
    const cx = Math.floor(seededValue(100 + i * 13, 201 + i * 17) * world.cols);
    const cy = Math.floor(seededValue(300 + i * 19, 401 + i * 23) * world.rows);
    const baseRadius =
      GENERATION_RULES.water.radiusMin +
      Math.floor(seededValue(500 + i * 29, 601 + i * 31) * GENERATION_RULES.water.radiusVar);

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

function paintRoadNetwork(tiles, world) {
  const pathMask = buildPathMask(world);
  applyPathMaskToTiles(pathMask, tiles, world);
}

function buildPathMask(world) {
  const mask = new Uint8Array(world.cols * world.rows);
  const hub = {
    x: Math.floor(world.cols / 2),
    y: Math.floor(world.rows / 2),
  };

  const edgeTargets = [
    { x: 0, y: Math.floor(seededValue(4001, 4003) * world.rows) },
    { x: world.cols - 1, y: Math.floor(seededValue(4005, 4007) * world.rows) },
    { x: Math.floor(seededValue(4009, 4011) * world.cols), y: 0 },
    { x: Math.floor(seededValue(4013, 4015) * world.cols), y: world.rows - 1 },
  ];

  for (let i = 0; i < edgeTargets.length; i += 1) {
    carvePath(mask, world, hub.x, hub.y, edgeTargets[i].x, edgeTargets[i].y, i);
  }

  // Add branches from existing roads to make the network less grid-like.
  const branchCount = Math.max(
    GENERATION_RULES.roads.branchMin,
    Math.floor((world.cols + world.rows) / GENERATION_RULES.roads.branchDivisor)
  );
  for (let i = 0; i < branchCount; i += 1) {
    const source = pickRoadCell(mask, world, i);
    if (!source) break;
    const tx = Math.floor(seededValue(5001 + i * 17, 5003 + i * 19) * world.cols);
    const ty = Math.floor(seededValue(5005 + i * 23, 5007 + i * 29) * world.rows);
    carvePath(mask, world, source.x, source.y, tx, ty, 100 + i);
  }

  return mask;
}

function pickRoadCell(mask, world, seed) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const x = Math.floor(seededValue(6001 + seed * 13, 6003 + attempt * 17) * world.cols);
    const y = Math.floor(seededValue(6005 + seed * 19, 6007 + attempt * 23) * world.rows);
    if (mask[indexOf(world, x, y)]) return { x, y };
  }
  return null;
}

function countPathNeighbors(mask, world, x, y) {
  let count = 0;
  if (inBounds(world, x, y - 1) && mask[indexOf(world, x, y - 1)]) count += 1;
  if (inBounds(world, x + 1, y) && mask[indexOf(world, x + 1, y)]) count += 1;
  if (inBounds(world, x, y + 1) && mask[indexOf(world, x, y + 1)]) count += 1;
  if (inBounds(world, x - 1, y) && mask[indexOf(world, x - 1, y)]) count += 1;
  return count;
}

function createsAdjacentParallelSegment(mask, world, x, y, nx, ny) {
  if (nx === x && ny === y) return false;

  if (ny === y) {
    // Horizontal segment: avoid an already-existing horizontal segment one tile above/below.
    for (const offset of [-1, 1]) {
      const ay = y + offset;
      if (!inBounds(world, x, ay) || !inBounds(world, nx, ay)) continue;
      if (mask[indexOf(world, x, ay)] && mask[indexOf(world, nx, ay)]) {
        return true;
      }
    }
  } else if (nx === x) {
    // Vertical segment: avoid an already-existing vertical segment one tile left/right.
    for (const offset of [-1, 1]) {
      const ax = x + offset;
      if (!inBounds(world, ax, y) || !inBounds(world, ax, ny)) continue;
      if (mask[indexOf(world, ax, y)] && mask[indexOf(world, ax, ny)]) {
        return true;
      }
    }
  }

  return false;
}

function canUseStep(mask, world, fromX, fromY, toX, toY, tx, ty) {
  if (!inBounds(world, toX, toY)) return false;
  if (toX === fromX && toY === fromY) return false;

  if (!createsAdjacentParallelSegment(mask, world, fromX, fromY, toX, toY)) return true;

  // Allow parallel proximity only when it helps connect to existing network
  // or when we are very close to the final target.
  const distToTarget = Math.abs(tx - toX) + Math.abs(ty - toY);
  if (distToTarget <= 2) return true;

  const neighborCount = countPathNeighbors(mask, world, toX, toY);
  const alreadyRoad = mask[indexOf(world, toX, toY)] === 1;
  return alreadyRoad || neighborCount >= 2;
}

function carvePath(mask, world, sx, sy, tx, ty, seed) {
  let x = sx;
  let y = sy;
  const maxSteps = world.cols * world.rows;

  for (let step = 0; step < maxSteps; step += 1) {
    mask[indexOf(world, x, y)] = 1;
    if (x === tx && y === ty) break;

    const dx = tx - x;
    const dy = ty - y;
    const sxDir = dx === 0 ? 0 : dx > 0 ? 1 : -1;
    const syDir = dy === 0 ? 0 : dy > 0 ? 1 : -1;
    const n = seededValue(7001 + seed * 31 + step * 7, 7003 + x * 11 + y * 13);

    let nx = x;
    let ny = y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const preferX = absDx > absDy + 4 || (absDx <= absDy + 4 && absDy <= absDx + 4 && n < 0.55);
    const firstAxis = preferX ? "x" : "y";
    const secondAxis = preferX ? "y" : "x";

    const candidates = [];
    const pushCandidate = (axis) => {
      if (axis === "x" && sxDir !== 0) {
        candidates.push({ x: x + sxDir, y });
      } else if (axis === "y" && syDir !== 0) {
        candidates.push({ x, y: y + syDir });
      }
    };

    pushCandidate(firstAxis);
    pushCandidate(secondAxis);

    let picked = null;
    for (let i = 0; i < candidates.length; i += 1) {
      const c = candidates[i];
      if (canUseStep(mask, world, x, y, c.x, c.y, tx, ty)) {
        picked = c;
        break;
      }
    }

    if (!picked && candidates.length > 0) {
      // Safety fallback to keep path generation progressing.
      picked = candidates[0];
    }
    if (!picked) break;

    nx = Math.max(0, Math.min(world.cols - 1, picked.x));
    ny = Math.max(0, Math.min(world.rows - 1, picked.y));
    x = nx;
    y = ny;
  }
}

function classifyPathTile(mask, world, x, y) {
  const n = isPath(mask, world, x, y - 1);
  const e = isPath(mask, world, x + 1, y);
  const s = isPath(mask, world, x, y + 1);
  const w = isPath(mask, world, x - 1, y);
  const neighborCount = Number(n) + Number(e) + Number(s) + Number(w);

  // Corner mapping is based on the visual orientation of current assets.
  // (n,e)->NW, (e,s)->NE, (s,w)->SE, (w,n)->SW
  if (n && e && !s && !w) return TILE_TYPES.PATH_CORNER_NW;
  if (e && s && !n && !w) return TILE_TYPES.PATH_CORNER_NE;
  if (s && w && !n && !e) return TILE_TYPES.PATH_CORNER_SE;
  if (w && n && !e && !s) return TILE_TYPES.PATH_CORNER_SW;
  if (neighborCount >= 3) return TILE_TYPES.PATH_CORNER_T;

  if ((n || s) && !(e || w)) return TILE_TYPES.PATH_V;
  if ((e || w) && !(n || s)) return TILE_TYPES.PATH_H;

  // Intersections/T-junctions fallback.
  if (n && s) return TILE_TYPES.PATH_V;
  return TILE_TYPES.PATH_H;
}

function isPath(mask, world, x, y) {
  if (!inBounds(world, x, y)) return false;
  return mask[indexOf(world, x, y)] === 1;
}

function paintWaterBorders(tiles, world) {
  const clone = new Uint8Array(tiles);
  for (let y = 0; y < world.rows; y += 1) {
    for (let x = 0; x < world.cols; x += 1) {
      const idx = indexOf(world, x, y);
      const current = clone[idx];
      if (current === TILE_TYPES.WATER || isPathTile(current)) {
        continue;
      }

      if (hasWaterInfluence(clone, world, x, y)) {
        tiles[idx] = classifyWaterShoreTile(clone, world, x, y);
      }
    }
  }
}

function paintTreePatches(tiles, world) {
  const forestCount = Math.max(
    GENERATION_RULES.forest.blobMin,
    Math.floor((world.cols + world.rows) / GENERATION_RULES.forest.blobDivisor)
  );
  for (let i = 0; i < forestCount; i += 1) {
    const cx = Math.floor(seededValue(9001 + i * 31, 9007 + i * 37) * world.cols);
    const cy = Math.floor(seededValue(9011 + i * 41, 9013 + i * 43) * world.rows);
    const radius = 2 + Math.floor(seededValue(9029 + i * 47, 9031 + i * 53) * 5);

    for (let y = Math.max(0, cy - radius - 1); y <= Math.min(world.rows - 1, cy + radius + 1); y += 1) {
      for (let x = Math.max(0, cx - radius - 1); x <= Math.min(world.cols - 1, cx + radius + 1); x += 1) {
        const idx = indexOf(world, x, y);
        if (tiles[idx] !== TILE_TYPES.GRASS) continue;
        const dist = Math.hypot(x - cx, y - cy);
        const edgeNoise = seededValue(9041 + x * 11 + i, 9043 + y * 13 + i) * 1.5;
        if (dist <= radius - 0.2 + edgeNoise) {
          const variant = seededValue(9053 + x * 7 + i, 9059 + y * 5 + i);
          tiles[idx] = variant > 0.5 ? TILE_TYPES.TREES_2 : TILE_TYPES.TREES;
        }
      }
    }
  }

  for (let y = 0; y < world.rows; y += 1) {
    for (let x = 0; x < world.cols; x += 1) {
      const idx = indexOf(world, x, y);
      if (tiles[idx] !== TILE_TYPES.GRASS) continue;
      const noise = seededValue(9101 + x * 19, 9103 + y * 23);
      const cluster = seededValue(9109 + Math.floor(x / 3), 9113 + Math.floor(y / 3));
      if (noise > 0.9 && cluster > 0.62) {
        const variant = seededValue(9127 + x * 3, 9133 + y * 11);
        tiles[idx] = variant > 0.45 ? TILE_TYPES.TREES_2 : TILE_TYPES.TREES;
      }
    }
  }
}

function paintGrassVariation(tiles, world) {
  for (let y = 0; y < world.rows; y += 1) {
    for (let x = 0; x < world.cols; x += 1) {
      const idx = indexOf(world, x, y);
      if (tiles[idx] !== TILE_TYPES.GRASS) continue;
      const n = seededValue(10001 + x * 7, 10003 + y * 11);
      const cluster = seededValue(10007 + Math.floor(x / 3), 10009 + Math.floor(y / 3));
      if (n > 0.56 && cluster > 0.48) {
        tiles[idx] = TILE_TYPES.GRASS_2;
      }
    }
  }
}

function paintStructures(tiles, world) {
  const structureRules = GENERATION_RULES.structures;
  const sawmillCount = Math.max(
    structureRules.sawmillMin,
    Math.floor((world.cols + world.rows) / structureRules.sawmillDivisor)
  );
  const goldMineCount = Math.max(
    structureRules.goldMineMin,
    Math.floor((world.cols + world.rows) / structureRules.goldMineDivisor)
  );
  const ironMineCount = Math.max(
    structureRules.ironMineMin,
    Math.floor((world.cols + world.rows) / structureRules.ironMineDivisor)
  );
  const glassMineCount = Math.max(
    structureRules.glassMineMin,
    Math.floor((world.cols + world.rows) / structureRules.glassMineDivisor)
  );
  const alchemyLabCount = Math.max(
    structureRules.alchemyLabMin,
    Math.floor((world.cols + world.rows) / structureRules.alchemyLabDivisor)
  );
  const gemMineCount = Math.max(
    structureRules.gemMineMin,
    Math.floor((world.cols + world.rows) / structureRules.gemMineDivisor)
  );
  const castleRedCount = Math.max(
    structureRules.castleRedMin,
    Math.floor((world.cols + world.rows) / structureRules.castleRedDivisor)
  );
  const castleYellowCount = Math.max(
    structureRules.castleYellowMin,
    Math.floor((world.cols + world.rows) / structureRules.castleYellowDivisor)
  );

  placeCastleType(tiles, world, TILE_TYPES.CASTLE_RED, castleRedCount, 14001, structureRules.maxPlaceAttempts);
  placeCastleType(
    tiles,
    world,
    TILE_TYPES.CASTLE_YELLOW,
    castleYellowCount,
    15001,
    structureRules.maxPlaceAttempts
  );
  placeStructureType(tiles, world, TILE_TYPES.SAWMILL, sawmillCount, 12001, structureRules.maxPlaceAttempts);
  placeStructureType(tiles, world, TILE_TYPES.GOLD_MINE, goldMineCount, 13001, structureRules.maxPlaceAttempts);
  placeStructureType(tiles, world, TILE_TYPES.IRON_MINE, ironMineCount, 16001, structureRules.maxPlaceAttempts);
  placeStructureType(tiles, world, TILE_TYPES.GLASS_MINE, glassMineCount, 17001, structureRules.maxPlaceAttempts);
  placeStructureType(tiles, world, TILE_TYPES.ALCHEMY_LAB, alchemyLabCount, 18001, structureRules.maxPlaceAttempts);
  placeStructureType(tiles, world, TILE_TYPES.GEM_MINE, gemMineCount, 19001, structureRules.maxPlaceAttempts);
}

function placeStructureType(tiles, world, tileType, targetCount, seedBase, maxAttempts) {
  let placed = 0;
  for (let attempt = 0; attempt < maxAttempts && placed < targetCount; attempt += 1) {
    const x = Math.floor(seededValue(seedBase + attempt * 17, seedBase + 3 + attempt * 19) * world.cols);
    const y = Math.floor(seededValue(seedBase + 5 + attempt * 23, seedBase + 7 + attempt * 29) * world.rows);
    const idx = indexOf(world, x, y);
    const current = tiles[idx];

    if (current !== TILE_TYPES.GRASS && current !== TILE_TYPES.GRASS_2) continue;
    if (hasWaterNeighbor(tiles, world, x, y)) continue;
    if (isNearCastleDoorCorridor(tiles, world, x, y)) continue;
    if (hasNearbyCastle(tiles, world, x, y, x, y, 5)) continue;
    if (hasNearbyResource(tiles, world, x, y, x, y, 4)) continue;
    tiles[idx] = tileType;
    placed += 1;
  }
}

function placeCastleType(tiles, world, castleType, targetCount, seedBase, maxAttempts) {
  let placed = 0;
  const footprintType =
    castleType === TILE_TYPES.CASTLE_RED ? TILE_TYPES.CASTLE_RED_FOOTPRINT : TILE_TYPES.CASTLE_YELLOW_FOOTPRINT;

  for (let attempt = 0; attempt < maxAttempts && placed < targetCount; attempt += 1) {
    const x = Math.floor(seededValue(seedBase + attempt * 17, seedBase + 3 + attempt * 19) * world.cols);
    const y = Math.floor(seededValue(seedBase + 5 + attempt * 23, seedBase + 7 + attempt * 29) * world.rows);
    if (x + 1 >= world.cols || y + 2 >= world.rows) continue;

    const footprint = [
      [x, y],
      [x + 1, y],
      [x, y + 1],
      [x + 1, y + 1],
    ];
    let blocked = false;
    for (let i = 0; i < footprint.length; i += 1) {
      const [fx, fy] = footprint[i];
      const t = tiles[indexOf(world, fx, fy)];
      if (t !== TILE_TYPES.GRASS && t !== TILE_TYPES.GRASS_2) {
        blocked = true;
        break;
      }
      if (hasWaterNeighbor(tiles, world, fx, fy)) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    if (isNearCastleDoorCorridor(tiles, world, x, y)) continue;
    if (hasNearbyCastleOrResource(tiles, world, x, y, x + 1, y + 1, 5)) continue;

    // Keep door strip below 2x2 footprint route-capable.
    const southLeft = tiles[indexOf(world, x, y + 2)];
    const southRight = tiles[indexOf(world, x + 1, y + 2)];
    if (!canRouteThroughTileType(southLeft) || !canRouteThroughTileType(southRight)) continue;

    tiles[indexOf(world, x, y)] = castleType;
    tiles[indexOf(world, x + 1, y)] = footprintType;
    tiles[indexOf(world, x, y + 1)] = footprintType;
    tiles[indexOf(world, x + 1, y + 1)] = footprintType;
    placed += 1;
  }
}

function isNearCastleDoorCorridor(tiles, world, x, y) {
  const anchors = getCastleAnchors(tiles, world);
  for (let i = 0; i < anchors.length; i += 1) {
    const a = anchors[i];
    const doorY = a.y + 2;
    if (doorY >= world.rows) continue;
    if (y === doorY && x >= a.x - 1 && x <= a.x + 2) return true;
    if (y === doorY + 1 && x >= a.x && x <= a.x + 1) return true;
  }
  return false;
}

function enforceCastleSouthRoads(tiles, world) {
  const pathMask = buildPathMaskFromTiles(tiles, world);
  const castles = getCastleAnchors(tiles, world);

  for (let i = 0; i < castles.length; i += 1) {
    const c = castles[i];
    const sy = c.y + 2;
    if (sy >= world.rows) continue;
    const doorTiles = [
      { x: c.x, y: sy },
      { x: c.x + 1, y: sy },
    ];

    for (let j = 0; j < doorTiles.length; j += 1) {
      const d = doorTiles[j];
      if (!inBounds(world, d.x, d.y)) continue;
      const southIdx = indexOf(world, d.x, d.y);
      if (!canRouteThroughTileType(tiles[southIdx])) continue;
      pathMask[southIdx] = 1;
      if (!hasPathNeighbor(pathMask, world, d.x, d.y)) {
        connectPathMaskToNearestRoad(pathMask, tiles, world, d.x, d.y);
      }
    }
  }

  applyPathMaskToTiles(pathMask, tiles, world);
  enforceCastleDoorOrientation(pathMask, tiles, world, castles);
}

function buildPathMaskFromTiles(tiles, world) {
  const mask = new Uint8Array(world.cols * world.rows);
  for (let y = 0; y < world.rows; y += 1) {
    for (let x = 0; x < world.cols; x += 1) {
      if (isPathTile(tiles[indexOf(world, x, y)])) {
        mask[indexOf(world, x, y)] = 1;
      }
    }
  }
  return mask;
}

function applyPathMaskToTiles(pathMask, tiles, world) {
  for (let y = 0; y < world.rows; y += 1) {
    for (let x = 0; x < world.cols; x += 1) {
      const idx = indexOf(world, x, y);
      if (!pathMask[idx]) continue;
      if (!canPaintPathOverTile(tiles[idx])) continue;
      tiles[idx] = classifyPathTile(pathMask, world, x, y);
    }
  }
}

function hasPathNeighbor(pathMask, world, x, y) {
  if (inBounds(world, x, y - 1) && pathMask[indexOf(world, x, y - 1)]) return true;
  if (inBounds(world, x + 1, y) && pathMask[indexOf(world, x + 1, y)]) return true;
  if (inBounds(world, x, y + 1) && pathMask[indexOf(world, x, y + 1)]) return true;
  if (inBounds(world, x - 1, y) && pathMask[indexOf(world, x - 1, y)]) return true;
  return false;
}

function connectPathMaskToNearestRoad(pathMask, tiles, world, startX, startY) {
  const total = world.cols * world.rows;
  const startIdx = indexOf(world, startX, startY);
  const visited = new Uint8Array(total);
  const prev = new Int32Array(total);
  prev.fill(-1);
  const queue = [startIdx];
  visited[startIdx] = 1;
  let qHead = 0;
  let foundIdx = -1;

  while (qHead < queue.length) {
    const cur = queue[qHead++];
    const cx = cur % world.cols;
    const cy = Math.floor(cur / world.cols);

    if (cur !== startIdx && pathMask[cur]) {
      foundIdx = cur;
      break;
    }

    const neighbors = [
      [cx, cy - 1],
      [cx + 1, cy],
      [cx, cy + 1],
      [cx - 1, cy],
    ];

    for (let i = 0; i < neighbors.length; i += 1) {
      const [nx, ny] = neighbors[i];
      if (!inBounds(world, nx, ny)) continue;
      const nIdx = indexOf(world, nx, ny);
      if (visited[nIdx]) continue;
      const nTile = tiles[nIdx];
      const traversable = pathMask[nIdx] || canRouteThroughTileType(nTile);
      if (!traversable) continue;
      visited[nIdx] = 1;
      prev[nIdx] = cur;
      queue.push(nIdx);
    }
  }

  if (foundIdx === -1) return;
  let cur = foundIdx;
  while (cur !== -1) {
    pathMask[cur] = 1;
    if (cur === startIdx) break;
    cur = prev[cur];
  }
}

function isPathTile(type) {
  return (
    type === TILE_TYPES.PATH_H ||
    type === TILE_TYPES.PATH_V ||
    type === TILE_TYPES.PATH_CORNER_SE ||
    type === TILE_TYPES.PATH_CORNER_SW ||
    type === TILE_TYPES.PATH_CORNER_NW ||
    type === TILE_TYPES.PATH_CORNER_NE ||
    type === TILE_TYPES.PATH_CORNER_T
  );
}

function isCastleTile(type) {
  return (
    type === TILE_TYPES.CASTLE_RED ||
    type === TILE_TYPES.CASTLE_YELLOW ||
    type === TILE_TYPES.CASTLE_RED_FOOTPRINT ||
    type === TILE_TYPES.CASTLE_YELLOW_FOOTPRINT
  );
}

function isCastleAnchorTile(type) {
  return type === TILE_TYPES.CASTLE_RED || type === TILE_TYPES.CASTLE_YELLOW;
}

function isResourceTile(type) {
  return (
    type === TILE_TYPES.SAWMILL ||
    type === TILE_TYPES.GOLD_MINE ||
    type === TILE_TYPES.IRON_MINE ||
    type === TILE_TYPES.GLASS_MINE ||
    type === TILE_TYPES.ALCHEMY_LAB ||
    type === TILE_TYPES.GEM_MINE
  );
}

function hasNearbyType(tiles, world, minX, minY, maxX, maxY, radius, predicate) {
  const scanMinX = Math.max(0, minX - radius);
  const scanMaxX = Math.min(world.cols - 1, maxX + radius);
  const scanMinY = Math.max(0, minY - radius);
  const scanMaxY = Math.min(world.rows - 1, maxY + radius);

  for (let y = scanMinY; y <= scanMaxY; y += 1) {
    for (let x = scanMinX; x <= scanMaxX; x += 1) {
      const dx = x < minX ? minX - x : x > maxX ? x - maxX : 0;
      const dy = y < minY ? minY - y : y > maxY ? y - maxY : 0;
      if (Math.max(dx, dy) > radius) continue;
      if (predicate(tiles[indexOf(world, x, y)])) return true;
    }
  }
  return false;
}

function hasNearbyCastleOrResource(tiles, world, minX, minY, maxX, maxY, radius) {
  return hasNearbyType(
    tiles,
    world,
    minX,
    minY,
    maxX,
    maxY,
    radius,
    (type) => isCastleTile(type) || isResourceTile(type)
  );
}

function hasNearbyCastle(tiles, world, minX, minY, maxX, maxY, radius) {
  return hasNearbyType(tiles, world, minX, minY, maxX, maxY, radius, isCastleTile);
}

function hasNearbyResource(tiles, world, minX, minY, maxX, maxY, radius) {
  return hasNearbyType(tiles, world, minX, minY, maxX, maxY, radius, isResourceTile);
}

function isStructureTile(type) {
  return (
    isResourceTile(type) ||
    isCastleTile(type)
  );
}

function isWaterEdgeTile(type) {
  return (
    type === TILE_TYPES.WATER_BORDER_N ||
    type === TILE_TYPES.WATER_BORDER_E ||
    type === TILE_TYPES.WATER_BORDER_S ||
    type === TILE_TYPES.WATER_BORDER_W ||
    type === TILE_TYPES.WATER_CORNER_OUT_NE ||
    type === TILE_TYPES.WATER_CORNER_OUT_SE ||
    type === TILE_TYPES.WATER_CORNER_OUT_SW ||
    type === TILE_TYPES.WATER_CORNER_OUT_NW ||
    type === TILE_TYPES.WATER_CORNER_IN_NE ||
    type === TILE_TYPES.WATER_CORNER_IN_SE ||
    type === TILE_TYPES.WATER_CORNER_IN_SW ||
    type === TILE_TYPES.WATER_CORNER_IN_NW
  );
}

function canRouteThroughTileType(type) {
  if (type === TILE_TYPES.WATER) return false;
  if (isWaterEdgeTile(type)) return false;
  if (isStructureTile(type)) return false;
  return true;
}

function canPaintPathOverTile(type) {
  if (isStructureTile(type)) return false;
  if (type === TILE_TYPES.WATER) return false;
  if (isWaterEdgeTile(type)) return false;
  return true;
}

function enforceCastleDoorOrientation(pathMask, tiles, world, castles) {
  for (let i = 0; i < castles.length; i += 1) {
    const c = castles[i];
    const sy = c.y + 2;
    if (sy >= world.rows) continue;
    const doorTiles = [
      { x: c.x, y: sy },
      { x: c.x + 1, y: sy },
    ];
    for (let j = 0; j < doorTiles.length; j += 1) {
      const d = doorTiles[j];
      if (!inBounds(world, d.x, d.y)) continue;
      const southIdx = indexOf(world, d.x, d.y);
      if (!isPathTile(tiles[southIdx])) continue;
      tiles[southIdx] = classifyPathTileWithCastleNorth(pathMask, world, d.x, d.y);
    }
  }
}

function getCastleAnchors(tiles, world) {
  const anchors = [];
  for (let y = 0; y < world.rows; y += 1) {
    for (let x = 0; x < world.cols; x += 1) {
      const tile = tiles[indexOf(world, x, y)];
      if (!isCastleAnchorTile(tile)) continue;
      if (x + 1 >= world.cols || y + 1 >= world.rows) continue;
      anchors.push({ x, y });
    }
  }
  return anchors;
}

function classifyPathTileWithCastleNorth(pathMask, world, x, y) {
  const n = true;
  const e = inBounds(world, x + 1, y) && pathMask[indexOf(world, x + 1, y)] === 1;
  const s = inBounds(world, x, y + 1) && pathMask[indexOf(world, x, y + 1)] === 1;
  const w = inBounds(world, x - 1, y) && pathMask[indexOf(world, x - 1, y)] === 1;
  const neighborCount = Number(n) + Number(e) + Number(s) + Number(w);

  if (n && e && !s && !w) return TILE_TYPES.PATH_CORNER_NW;
  if (w && n && !e && !s) return TILE_TYPES.PATH_CORNER_SW;
  if (neighborCount >= 3) return TILE_TYPES.PATH_CORNER_T;
  if ((n || s) && !(e || w)) return TILE_TYPES.PATH_V;
  if (n && s) return TILE_TYPES.PATH_V;
  return TILE_TYPES.PATH_V;
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

function hasWaterInfluence(tiles, world, x, y) {
  for (let ny = y - 1; ny <= y + 1; ny += 1) {
    for (let nx = x - 1; nx <= x + 1; nx += 1) {
      if (nx === x && ny === y) continue;
      if (!inBounds(world, nx, ny)) continue;
      if (tiles[indexOf(world, nx, ny)] === TILE_TYPES.WATER) return true;
    }
  }
  return false;
}

function isWaterTile(tiles, world, x, y) {
  if (!inBounds(world, x, y)) return false;
  return tiles[indexOf(world, x, y)] === TILE_TYPES.WATER;
}

function classifyWaterShoreTile(tiles, world, x, y) {
  const n = isWaterTile(tiles, world, x, y - 1);
  const e = isWaterTile(tiles, world, x + 1, y);
  const s = isWaterTile(tiles, world, x, y + 1);
  const w = isWaterTile(tiles, world, x - 1, y);
  const ne = isWaterTile(tiles, world, x + 1, y - 1);
  const se = isWaterTile(tiles, world, x + 1, y + 1);
  const sw = isWaterTile(tiles, world, x - 1, y + 1);
  const nw = isWaterTile(tiles, world, x - 1, y - 1);

  // Inward (concave) corners: diagonal water while both touching cardinals are land.
  if (!n && !e && ne) return TILE_TYPES.WATER_CORNER_IN_NE;
  if (!e && !s && se) return TILE_TYPES.WATER_CORNER_IN_SE;
  if (!s && !w && sw) return TILE_TYPES.WATER_CORNER_IN_SW;
  if (!w && !n && nw) return TILE_TYPES.WATER_CORNER_IN_NW;

  // Outward (convex) corners: two adjacent cardinal water neighbors.
  if (n && e && !s && !w) return TILE_TYPES.WATER_CORNER_OUT_NE;
  if (e && s && !n && !w) return TILE_TYPES.WATER_CORNER_OUT_SE;
  if (s && w && !n && !e) return TILE_TYPES.WATER_CORNER_OUT_SW;
  if (w && n && !e && !s) return TILE_TYPES.WATER_CORNER_OUT_NW;

  // Three-sided water coverage: border points to the only dry side.
  if (!n && e && s && w) return TILE_TYPES.WATER_BORDER_N;
  if (!e && n && s && w) return TILE_TYPES.WATER_BORDER_E;
  if (!s && n && e && w) return TILE_TYPES.WATER_BORDER_S;
  if (!w && n && e && s) return TILE_TYPES.WATER_BORDER_W;

  // Straight borders.
  if (n && !e && !s && !w) return TILE_TYPES.WATER_BORDER_N;
  if (e && !n && !s && !w) return TILE_TYPES.WATER_BORDER_E;
  if (s && !n && !e && !w) return TILE_TYPES.WATER_BORDER_S;
  if (w && !n && !e && !s) return TILE_TYPES.WATER_BORDER_W;

  // Mixed patterns fallback: prioritize directional borders, then diagonal corners.
  if (n) return TILE_TYPES.WATER_BORDER_N;
  if (e) return TILE_TYPES.WATER_BORDER_E;
  if (s) return TILE_TYPES.WATER_BORDER_S;
  if (w) return TILE_TYPES.WATER_BORDER_W;
  if (ne) return TILE_TYPES.WATER_CORNER_IN_NE;
  if (se) return TILE_TYPES.WATER_CORNER_IN_SE;
  if (sw) return TILE_TYPES.WATER_CORNER_IN_SW;
  if (nw) return TILE_TYPES.WATER_CORNER_IN_NW;
  return TILE_TYPES.WATER_BORDER_N;
}

export function getWorldSize(world) {
  return {
    width: world.cols * world.tileSize,
    height: world.rows * world.tileSize,
  };
}
