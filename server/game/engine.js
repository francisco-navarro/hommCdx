const crypto = require("crypto");
const path = require("path");
const { pathToFileURL } = require("url");
const {
  worldToTile,
  tileToCenter,
  clampMovementToWalkableSegment,
} = require("./collision");
const { findPathAStar } = require("./pathfinding");

function toModuleUrl(filePath) {
  return pathToFileURL(filePath).href;
}

function buildPlayerColor(sessionId) {
  const hash = crypto.createHash("sha1").update(sessionId).digest();
  const hue = Math.floor((hash[0] / 255) * 360);
  return `hsl(${hue} 85% 58%)`;
}

async function createGameEngine(publicDir) {
  const configMod = await import(toModuleUrl(path.join(publicDir, "config.mjs")));
  const worldMod = await import(toModuleUrl(path.join(publicDir, "world.mjs")));
  const logicMod = await import(toModuleUrl(path.join(publicDir, "game-logic.mjs")));

  const { WORLD_CONFIG, PLAYER_CONFIG } = configMod;
  const { createWorldTiles, getWorldSize } = worldMod;
  const { updatePlayerTowardsTarget, clampPlayerToWorld, computeCamera, screenClickToWorld } = logicMod;
  const { tileIsWalkable } = configMod;

  const world = { ...WORLD_CONFIG };
  const worldSize = getWorldSize(world);
  const tiles = Array.from(createWorldTiles(world));
  const players = new Map();
  let lastTickTime = Date.now();
  const MIN_ZOOM = 0.75;
  const MAX_ZOOM = 2.5;

  function getTileId(col, row) {
    if (col < 0 || row < 0 || col >= world.cols || row >= world.rows) return null;
    return tiles[row * world.cols + col];
  }

  function isWalkableTile(col, row) {
    const id = getTileId(col, row);
    if (id === null) return false;
    return tileIsWalkable(id);
  }

  function isWalkableWorld(x, y) {
    const t = worldToTile(world, x, y);
    return isWalkableTile(t.col, t.row);
  }

  function worldToNearestTile(worldX, worldY) {
    const col = Math.max(0, Math.min(world.cols - 1, Math.round(worldX / world.tileSize)));
    const row = Math.max(0, Math.min(world.rows - 1, Math.round(worldY / world.tileSize)));
    return { col, row };
  }

  function clampCameraToWorld(x, y) {
    const nx = Number(x);
    const ny = Number(y);
    return {
      x: Number.isFinite(nx) ? Math.max(0, Math.min(worldSize.width, nx)) : worldSize.width / 2,
      y: Number.isFinite(ny) ? Math.max(0, Math.min(worldSize.height, ny)) : worldSize.height / 2,
    };
  }

  function clampZoom(value, fallback = 1) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, parsed));
  }

  function findNearestWalkableCenter(worldX, worldY) {
    const start = worldToTile(world, worldX, worldY);
    if (isWalkableTile(start.col, start.row)) {
      return tileToCenter(world, start.col, start.row);
    }

    const maxRadius = Math.max(world.cols, world.rows);
    for (let r = 1; r <= maxRadius; r += 1) {
      const minCol = Math.max(0, start.col - r);
      const maxCol = Math.min(world.cols - 1, start.col + r);
      const minRow = Math.max(0, start.row - r);
      const maxRow = Math.min(world.rows - 1, start.row + r);

      for (let col = minCol; col <= maxCol; col += 1) {
        if (isWalkableTile(col, minRow)) return tileToCenter(world, col, minRow);
        if (isWalkableTile(col, maxRow)) return tileToCenter(world, col, maxRow);
      }
      for (let row = minRow + 1; row < maxRow; row += 1) {
        if (isWalkableTile(minCol, row)) return tileToCenter(world, minCol, row);
        if (isWalkableTile(maxCol, row)) return tileToCenter(world, maxCol, row);
      }
    }

    return tileToCenter(world, Math.floor(world.cols / 2), Math.floor(world.rows / 2));
  }

  function createSpawnPoint(sessionId) {
    const seed = crypto.createHash("sha1").update(sessionId).digest();
    const rx = (seed[0] / 255 - 0.5) * world.tileSize * 6;
    const ry = (seed[1] / 255 - 0.5) * world.tileSize * 6;
    const preferred = {
      x: Math.max(0, Math.min(worldSize.width, worldSize.width / 2 + rx)),
      y: Math.max(0, Math.min(worldSize.height, worldSize.height / 2 + ry)),
    };
    return findNearestWalkableCenter(preferred.x, preferred.y);
  }

  function ensurePlayer(sessionId, name) {
    if (!players.has(sessionId)) {
      const spawn = createSpawnPoint(sessionId);
      players.set(sessionId, {
        id: sessionId,
        name,
        color: buildPlayerColor(sessionId),
        player: {
          x: spawn.x,
          y: spawn.y,
          size: PLAYER_CONFIG.size,
          speed: PLAYER_CONFIG.speed,
        },
        moveTarget: { x: spawn.x, y: spawn.y, active: false },
        plannedPath: [],
        activePath: [],
        traveledDistance: 0,
      });
    } else {
      players.get(sessionId).name = name;
    }
    return players.get(sessionId);
  }

  function tick() {
    const now = Date.now();
    const dt = Math.min((now - lastTickTime) / 1000, 0.08);
    lastTickTime = now;

    for (const p of players.values()) {
      if (!p.moveTarget.active && p.activePath.length > 0) {
        const next = p.activePath.shift();
        p.moveTarget = { x: next.x, y: next.y, active: true };
      }

      const prevX = p.player.x;
      const prevY = p.player.y;
      const movement = updatePlayerTowardsTarget(p.player, p.moveTarget, dt);
      const clampedCandidate = clampPlayerToWorld(movement.player, worldSize.width, worldSize.height);
      const corrected = clampMovementToWalkableSegment(
        world,
        { x: prevX, y: prevY },
        clampedCandidate,
        isWalkableWorld
      );
      p.player = { ...p.player, x: corrected.x, y: corrected.y };
      if (corrected.blocked) {
        p.moveTarget = { ...p.moveTarget, x: corrected.x, y: corrected.y, active: false };
        p.activePath = [];
      } else {
        p.moveTarget = movement.moveTarget;
      }
      p.traveledDistance += Math.hypot(p.player.x - prevX, p.player.y - prevY);
    }
  }

  function getChunkForView(camera, view, zoom = 1) {
    const z = clampZoom(zoom);
    const centerCol = Math.floor(camera.x / world.tileSize);
    const centerRow = Math.floor(camera.y / world.tileSize);
    const halfCols = Math.ceil(view.width / (world.isoTileWidth * z)) + 8;
    const halfRows = Math.ceil(view.height / (world.isoTileHeight * z)) + 8;

    const startCol = Math.max(0, centerCol - halfCols);
    const endCol = Math.min(world.cols - 1, centerCol + halfCols);
    const startRow = Math.max(0, centerRow - halfRows);
    const endRow = Math.min(world.rows - 1, centerRow + halfRows);

    const cols = endCol - startCol + 1;
    const rows = endRow - startRow + 1;
    const chunkTiles = new Array(cols * rows);

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const worldCol = startCol + col;
        const worldRow = startRow + row;
        const worldIdx = worldRow * world.cols + worldCol;
        chunkTiles[row * cols + col] = tiles[worldIdx];
      }
    }

    return { startCol, startRow, cols, rows, tiles: chunkTiles };
  }

  function getSnapshotFor(sessionId, view, cameraOverride = null, zoom = 1) {
    const me = players.get(sessionId);
    if (!me) return null;
    const z = clampZoom(zoom);

    const camera = cameraOverride
      ? clampCameraToWorld(cameraOverride.x, cameraOverride.y)
      : computeCamera(me.player, view, worldSize.width, worldSize.height);
    const others = [];
    for (const p of players.values()) {
      others.push({ id: p.id, name: p.name, x: p.player.x, y: p.player.y, color: p.color });
    }

    return {
      state: {
        player: me.player,
        moveTarget: me.moveTarget,
        camera,
        plannedPath: me.plannedPath,
        zoom: z,
      },
      players: others,
      selfSessionId: sessionId,
      steps: Math.floor(me.traveledDistance / world.tileSize),
      chunk: getChunkForView(camera, view, z),
    };
  }

  function worldPathFromClick(sessionId, canvasX, canvasY, view) {
    const me = players.get(sessionId);
    if (!me) return [];
    const camera = computeCamera(me.player, view, worldSize.width, worldSize.height);
    const target = screenClickToWorld(
      { clientX: canvasX, clientY: canvasY },
      { left: 0, top: 0, width: view.width, height: view.height },
      view,
      camera,
      world,
      worldSize.width,
      worldSize.height
    );
    const startTile = worldToNearestTile(me.player.x, me.player.y);
    const goalTile = worldToNearestTile(target.x, target.y);
    const tilePath = findPathAStar(startTile, goalTile, world, isWalkableTile);
    if (tilePath.length <= 1) return [];

    const worldPath = [];
    for (let i = 1; i < tilePath.length; i += 1) {
      worldPath.push(tileToCenter(world, tilePath[i].col, tilePath[i].row));
    }
    return worldPath;
  }

  function worldPathFromTargetWorld(sessionId, targetX, targetY) {
    const me = players.get(sessionId);
    if (!me) return [];
    const clamped = clampCameraToWorld(targetX, targetY);
    const startTile = worldToNearestTile(me.player.x, me.player.y);
    const goalTile = worldToNearestTile(clamped.x, clamped.y);
    const tilePath = findPathAStar(startTile, goalTile, world, isWalkableTile);
    if (tilePath.length <= 1) return [];

    const worldPath = [];
    for (let i = 1; i < tilePath.length; i += 1) {
      worldPath.push(tileToCenter(world, tilePath[i].col, tilePath[i].row));
    }
    return worldPath;
  }

  function planMove(sessionId, canvasX, canvasY, view) {
    const me = players.get(sessionId);
    if (!me) return;
    me.plannedPath = worldPathFromClick(sessionId, canvasX, canvasY, view);
  }

  function planMoveToWorld(sessionId, worldX, worldY) {
    const me = players.get(sessionId);
    if (!me) return;
    me.plannedPath = worldPathFromTargetWorld(sessionId, Number(worldX), Number(worldY));
  }

  function confirmMove(sessionId) {
    const me = players.get(sessionId);
    if (!me || me.plannedPath.length === 0) return;
    me.activePath = me.plannedPath.map((step) => ({ x: step.x, y: step.y }));
    me.plannedPath = [];
    me.moveTarget = { ...me.moveTarget, active: false };
  }

  function applyMove(sessionId, canvasX, canvasY, view) {
    planMove(sessionId, canvasX, canvasY, view);
    confirmMove(sessionId);
  }

  function applyMoveToWorld(sessionId, worldX, worldY) {
    planMoveToWorld(sessionId, worldX, worldY);
    confirmMove(sessionId);
  }

  return {
    world,
    players,
    tick,
    ensurePlayer,
    getSnapshotFor,
    clampCameraToWorld,
    clampZoom,
    planMove,
    planMoveToWorld,
    confirmMove,
    applyMove,
    applyMoveToWorld,
    isWalkableAtWorld: isWalkableWorld,
  };
}

module.exports = {
  createGameEngine,
};
