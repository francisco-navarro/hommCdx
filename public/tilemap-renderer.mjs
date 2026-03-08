import { TILE_CATALOG, TILE_TYPES } from "./map-config.mjs";
import { worldToIsometric } from "./game-logic.mjs";

export async function loadTileSprites() {
  const entries = Object.values(TILE_CATALOG).map((tile) => [tile.id, tile.image]);

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
  return function render(camera, chunk) {
    ctx.clearRect(0, 0, view.width, view.height);
    if (!chunk || !chunk.tiles || chunk.cols <= 0 || chunk.rows <= 0) return;

    const maxDiag = chunk.cols + chunk.rows - 2;
    for (let diag = 0; diag <= maxDiag; diag += 1) {
      const minCol = Math.max(0, diag - (chunk.rows - 1));
      const maxCol = Math.min(chunk.cols - 1, diag);
      for (let col = minCol; col <= maxCol; col += 1) {
        const row = diag - col;
        const idx = row * chunk.cols + col;
        const tileType = chunk.tiles[idx];
        const sprite = sprites[tileType] || sprites[TILE_TYPES.GRASS];
        const worldCol = chunk.startCol + col;
        const worldRow = chunk.startRow + row;
        const iso = worldToIsometric(
          worldCol * world.tileSize,
          worldRow * world.tileSize,
          world,
          camera,
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
  };
}
