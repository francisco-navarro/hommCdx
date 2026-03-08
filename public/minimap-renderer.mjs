import { TILE_COLORS } from "./config.mjs";
import { getWorldSize } from "./world.mjs";

export function renderMinimap(ctx, canvas, state, world, view, tiles) {
  const mmW = canvas.width;
  const mmH = canvas.height;
  ctx.clearRect(0, 0, mmW, mmH);

  const tileW = mmW / world.cols;
  const tileH = mmH / world.rows;

  for (let row = 0; row < world.rows; row += 1) {
    for (let col = 0; col < world.cols; col += 1) {
      const t = tiles[row * world.cols + col];
      const [r, g, b] = TILE_COLORS[t];
      ctx.fillStyle = `rgb(${Math.floor(r * 255)}, ${Math.floor(g * 255)}, ${Math.floor(b * 255)})`;
      ctx.fillRect(col * tileW, row * tileH, tileW + 1, tileH + 1);
    }
  }

  const worldSize = getWorldSize(world);
  const px = (state.player.x / worldSize.width) * mmW;
  const py = (state.player.y / worldSize.height) * mmH;
  ctx.fillStyle = "#ffe743";
  ctx.beginPath();
  ctx.arc(px, py, 4, 0, Math.PI * 2);
  ctx.fill();

  const topLeftX = Math.max(0, Math.min(worldSize.width - view.width, state.camera.x - view.width / 2));
  const topLeftY = Math.max(0, Math.min(worldSize.height - view.height, state.camera.y - view.height / 2));
  const vx = (topLeftX / worldSize.width) * mmW;
  const vy = (topLeftY / worldSize.height) * mmH;
  const vw = (view.width / worldSize.width) * mmW;
  const vh = (view.height / worldSize.height) * mmH;

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(vx, vy, vw, vh);
}
