import { TILE_TYPES } from "./config.mjs";
import { worldToIsometric } from "./game-logic.mjs";

export async function loadTileSprites() {
  const entries = [
    [TILE_TYPES.GRASS, "/img/map/grass.png"],
    [TILE_TYPES.PATH_H, "/img/map/path-h.png"],
    [TILE_TYPES.PATH_V, "/img/map/path-v.png"],
    [TILE_TYPES.WATER, "/img/map/water.png"],
    [TILE_TYPES.WATER_BORDER, "/img/map/water-border.png"],
    [TILE_TYPES.CORNER_1, "/img/map/corner1.png"],
    [TILE_TYPES.CORNER_2, "/img/map/corner2.png"],
  ];

  const sprites = {};
  await Promise.all(
    entries.map(async ([tileType, src]) => {
      sprites[tileType] = await loadImage(src);
    })
  );

  return sprites;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load sprite: ${src}`));
    img.src = src;
  });
}

export function createTileMapRenderer(ctx, world, view, sprites) {
  return function render(state, tiles) {
    ctx.clearRect(0, 0, view.width, view.height);
    const maxDiag = world.cols + world.rows - 2;
    for (let diag = 0; diag <= maxDiag; diag += 1) {
      const minCol = Math.max(0, diag - (world.rows - 1));
      const maxCol = Math.min(world.cols - 1, diag);
      for (let col = minCol; col <= maxCol; col += 1) {
        const row = diag - col;
        const idx = row * world.cols + col;
        const tileType = tiles[idx];
        const sprite = sprites[tileType] || sprites[TILE_TYPES.GRASS];
        const iso = worldToIsometric(
          col * world.tileSize,
          row * world.tileSize,
          world,
          state.camera,
          view
        );
        const x = iso.x - world.spriteDrawWidth / 2;
        const y = iso.y - world.spriteDrawHeight / 2;
        if (
          x > view.width ||
          y > view.height ||
          x + world.spriteDrawWidth < 0 ||
          y + world.spriteDrawHeight < 0
        ) {
          continue;
        }
        ctx.drawImage(sprite, x, y, world.spriteDrawWidth, world.spriteDrawHeight);
      }
    }

    const playerIso = worldToIsometric(
      state.player.x,
      state.player.y,
      world,
      state.camera,
      view
    );
    ctx.fillStyle = "#ffe743";
    ctx.beginPath();
    ctx.arc(playerIso.x, playerIso.y, state.player.size / 2, 0, Math.PI * 2);
    ctx.fill();
  };
}
