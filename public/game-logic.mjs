export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function updatePlayerTowardsTarget(player, moveTarget, dt, snapDistance = 2) {
  if (!moveTarget.active) {
    return {
      player: { ...player },
      moveTarget: { ...moveTarget },
    };
  }

  const dx = moveTarget.x - player.x;
  const dy = moveTarget.y - player.y;
  const distance = Math.hypot(dx, dy);
  const maxStep = player.speed * dt;

  if (distance <= Math.max(snapDistance, maxStep)) {
    return {
      player: { ...player, x: moveTarget.x, y: moveTarget.y },
      moveTarget: { ...moveTarget, active: false },
    };
  }

  return {
    player: {
      ...player,
      x: player.x + (dx / distance) * maxStep,
      y: player.y + (dy / distance) * maxStep,
    },
    moveTarget: { ...moveTarget },
  };
}

export function clampPlayerToWorld(player, worldW, worldH) {
  return {
    ...player,
    x: clamp(player.x, 0, worldW),
    y: clamp(player.y, 0, worldH),
  };
}

export function computeCamera(player, view, worldW, worldH) {
  return {
    x: clamp(player.x, 0, worldW),
    y: clamp(player.y, 0, worldH),
  };
}

export function worldToIsometric(worldX, worldY, world, camera, view) {
  const halfW = world.isoTileWidth / 2;
  const halfH = world.isoTileHeight / 2;
  const gridX = worldX / world.tileSize;
  const gridY = worldY / world.tileSize;
  const camGridX = camera.x / world.tileSize;
  const camGridY = camera.y / world.tileSize;

  return {
    x: (gridX - gridY) * halfW - (camGridX - camGridY) * halfW + view.width / 2,
    y: (gridX + gridY) * halfH - (camGridX + camGridY) * halfH + view.height / 2,
  };
}

export function screenClickToWorld(click, rect, view, camera, world, worldW, worldH) {
  const scaleX = view.width / rect.width;
  const scaleY = view.height / rect.height;
  const canvasX = (click.clientX - rect.left) * scaleX - view.width / 2;
  const canvasY = (click.clientY - rect.top) * scaleY - view.height / 2;
  const halfW = world.isoTileWidth / 2;
  const halfH = world.isoTileHeight / 2;
  const camGridX = camera.x / world.tileSize;
  const camGridY = camera.y / world.tileSize;
  const isoX = canvasX + (camGridX - camGridY) * halfW;
  const isoY = canvasY + (camGridX + camGridY) * halfH;
  const a = isoX / halfW;
  const b = isoY / halfH;
  const gridX = (a + b) / 2;
  const gridY = (b - a) / 2;

  return {
    x: clamp(gridX * world.tileSize, 0, worldW),
    y: clamp(gridY * world.tileSize, 0, worldH),
  };
}
