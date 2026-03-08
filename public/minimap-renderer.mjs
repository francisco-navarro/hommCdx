import { TILE_CATALOG, TILE_COLORS } from "./map-config.mjs";
import { getWorldSize } from "./world.mjs";

function drawCompass(ctx, mmW, mmH) {
  ctx.save();
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#000000";
  ctx.fillStyle = "#ffffff";

  const margin = 10;
  const markers = [
    { label: "N", x: mmW / 2, y: margin },
    { label: "S", x: mmW / 2, y: mmH - margin },
    { label: "W", x: margin, y: mmH / 2 },
    { label: "E", x: mmW - margin, y: mmH / 2 },
  ];

  for (let i = 0; i < markers.length; i += 1) {
    const m = markers[i];
    ctx.strokeText(m.label, m.x, m.y);
    ctx.fillText(m.label, m.x, m.y);
  }
  ctx.restore();
}

export function renderMinimap(ctx, canvas, state, world, view) {
  const mmW = canvas.width;
  const mmH = canvas.height;
  ctx.clearRect(0, 0, mmW, mmH);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, 0, mmW, mmH);

  const tileW = mmW / world.cols;
  const tileH = mmH / world.rows;
  const chunk = state.chunk;
  if (chunk && chunk.tiles) {
    for (let row = 0; row < chunk.rows; row += 1) {
      for (let col = 0; col < chunk.cols; col += 1) {
        const idx = row * chunk.cols + col;
        const t = chunk.tiles[idx];
        const [r, g, b] = TILE_CATALOG[t]?.minimapColor || TILE_COLORS[0];
        const worldCol = chunk.startCol + col;
        const worldRow = chunk.startRow + row;
        ctx.fillStyle = `rgb(${Math.floor(r * 255)}, ${Math.floor(g * 255)}, ${Math.floor(b * 255)})`;
        ctx.fillRect(worldCol * tileW, worldRow * tileH, tileW + 1, tileH + 1);
      }
    }
  }

  const worldSize = getWorldSize(world);
  const players = state.players || [];
  for (let i = 0; i < players.length; i += 1) {
    const p = players[i];
    const px = (p.x / worldSize.width) * mmW;
    const py = (p.y / worldSize.height) * mmH;
    ctx.fillStyle = p.id === state.selfSessionId ? "#ffe743" : p.color || "#ffffff";
    ctx.beginPath();
    ctx.arc(px, py, p.id === state.selfSessionId ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const topLeftX = Math.max(0, Math.min(worldSize.width - view.width, state.camera.x - view.width / 2));
  const topLeftY = Math.max(0, Math.min(worldSize.height - view.height, state.camera.y - view.height / 2));
  const vx = (topLeftX / worldSize.width) * mmW;
  const vy = (topLeftY / worldSize.height) * mmH;
  const vw = (view.width / worldSize.width) * mmW;
  const vh = (view.height / worldSize.height) * mmH;

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(vx, vy, vw, vh);

  drawCompass(ctx, mmW, mmH);
}
