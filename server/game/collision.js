function worldToTile(world, x, y) {
  const col = Math.max(0, Math.min(world.cols - 1, Math.floor(x / world.tileSize)));
  const row = Math.max(0, Math.min(world.rows - 1, Math.floor(y / world.tileSize)));
  return { col, row };
}

function tileToCenter(world, col, row) {
  return {
    x: col * world.tileSize,
    y: row * world.tileSize,
  };
}

function bresenhamLine(x0, y0, x1, y1) {
  const points = [];
  let cx = x0;
  let cy = y0;
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  while (true) {
    points.push({ col: cx, row: cy });
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      cx += sx;
    }
    if (e2 <= dx) {
      err += dx;
      cy += sy;
    }
  }
  return points;
}

function findLastWalkableTileOnLine(startTile, endTile, isWalkableTile) {
  const line = bresenhamLine(startTile.col, startTile.row, endTile.col, endTile.row);
  let last = { ...startTile };

  for (let i = 1; i < line.length; i += 1) {
    const p = line[i];
    if (!isWalkableTile(p.col, p.row)) {
      return last;
    }
    last = p;
  }
  return last;
}

function clampMovementToWalkableSegment(world, from, to, isWalkableAtWorld) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(distance / Math.max(1, world.tileSize / 4)));

  let lastX = from.x;
  let lastY = from.y;
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const x = from.x + dx * t;
    const y = from.y + dy * t;
    if (!isWalkableAtWorld(x, y)) {
      return { x: lastX, y: lastY, blocked: true };
    }
    lastX = x;
    lastY = y;
  }
  return { x: to.x, y: to.y, blocked: false };
}

module.exports = {
  worldToTile,
  tileToCenter,
  findLastWalkableTileOnLine,
  clampMovementToWalkableSegment,
};
