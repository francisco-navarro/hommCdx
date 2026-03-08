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
    x: clamp(player.x - view.width / 2, 0, Math.max(0, worldW - view.width)),
    y: clamp(player.y - view.height / 2, 0, Math.max(0, worldH - view.height)),
  };
}

export function screenClickToWorld(click, rect, view, camera, worldW, worldH) {
  const scaleX = view.width / rect.width;
  const scaleY = view.height / rect.height;
  const canvasX = (click.clientX - rect.left) * scaleX;
  const canvasY = (click.clientY - rect.top) * scaleY;

  return {
    x: clamp(camera.x + canvasX, 0, worldW),
    y: clamp(camera.y + canvasY, 0, worldH),
  };
}
