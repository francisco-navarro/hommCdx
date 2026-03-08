import { TILE_TYPES } from "./config.mjs";

export async function loadTileSprites() {
  const entries = [
    [TILE_TYPES.GRASS, "/img/map/grass.png"],
    [TILE_TYPES.PATH_H, "/img/map/path-h.png"],
    [TILE_TYPES.PATH_V, "/img/map/path-v.png"],
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

    const tileSize = world.tileSize;
    const startCol = Math.max(0, Math.floor(state.camera.x / tileSize));
    const endCol = Math.min(world.cols, Math.ceil((state.camera.x + view.width) / tileSize));
    const startRow = Math.max(0, Math.floor(state.camera.y / tileSize));
    const endRow = Math.min(world.rows, Math.ceil((state.camera.y + view.height) / tileSize));

    for (let row = startRow; row < endRow; row += 1) {
      for (let col = startCol; col < endCol; col += 1) {
        const idx = row * world.cols + col;
        const tileType = tiles[idx];
        const sprite = sprites[tileType];
        const x = col * tileSize - state.camera.x;
        const y = row * tileSize - state.camera.y;
        ctx.drawImage(sprite, x, y, tileSize, tileSize);
      }
    }

    ctx.fillStyle = "#ffe743";
    ctx.fillRect(
      state.player.x - state.camera.x - state.player.size / 2,
      state.player.y - state.camera.y - state.player.size / 2,
      state.player.size,
      state.player.size
    );
  };
}
