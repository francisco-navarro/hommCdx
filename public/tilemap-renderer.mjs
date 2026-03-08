import { TILE_CATALOG, TILE_TYPES } from "./map-config.mjs";
import { worldToIsometric } from "./game-logic.mjs";

const DEBUG_TILES = true;
const NORMALIZED_SOURCE_WIDTH = 1024;
const NORMALIZED_SOURCE_HEIGHT = 885;
const TILE_DEBUG_NAMES = Object.fromEntries(
  Object.entries(TILE_CATALOG).map(([id, tile]) => [Number(id), tile.image.split("/").pop() || ""])
);
const STRUCTURE_TILES = new Set([
  TILE_TYPES.SAWMILL,
  TILE_TYPES.GOLD_MINE,
  TILE_TYPES.CASTLE_RED,
  TILE_TYPES.CASTLE_YELLOW,
]);

export async function loadTileSprites() {
  const entries = Object.values(TILE_CATALOG).map((tile) => [tile.id, tile.image]);

  const sprites = {};
  await Promise.all(
    entries.map(async ([tileType, src]) => {
      const img = await loadImage(src);
      sprites[tileType] = normalizeSprite(img, NORMALIZED_SOURCE_WIDTH, NORMALIZED_SOURCE_HEIGHT);
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

function normalizeSprite(image, targetWidth, targetHeight) {
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return image;

  // Center-crop to a consistent source rectangle for all tile assets.
  const srcX = Math.max(0, Math.floor((image.width - targetWidth) / 2));
  const srcY = Math.max(0, Math.floor((image.height - targetHeight) / 2));
  const srcW = Math.min(targetWidth, image.width);
  const srcH = Math.min(targetHeight, image.height);
  const dstX = Math.floor((targetWidth - srcW) / 2);
  const dstY = Math.floor((targetHeight - srcH) / 2);

  ctx.clearRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(image, srcX, srcY, srcW, srcH, dstX, dstY, srcW, srcH);
  return canvas;
}

export function createTileMapRenderer(ctx, world, view, sprites) {
  return function render(camera, chunk) {
    ctx.clearRect(0, 0, view.width, view.height);
    if (!chunk || !chunk.tiles || chunk.cols <= 0 || chunk.rows <= 0) return;

    const deferredStructures = [];
    const debugLabels = [];
    const maxDiag = chunk.cols + chunk.rows - 2;
    for (let diag = 0; diag <= maxDiag; diag += 1) {
      const minCol = Math.max(0, diag - (chunk.rows - 1));
      const maxCol = Math.min(chunk.cols - 1, diag);
      for (let col = minCol; col <= maxCol; col += 1) {
        const row = diag - col;
        const idx = row * chunk.cols + col;
        const tileType = chunk.tiles[idx];
        const sprite = sprites[tileType] || sprites[TILE_TYPES.GRASS];
        const isStructureTile = STRUCTURE_TILES.has(tileType);
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

        if (isStructureTile) {
          const baseSprite = sprites[TILE_TYPES.GRASS] || sprite;
          ctx.drawImage(baseSprite, x, y, world.spriteDrawWidth, world.spriteDrawHeight);
          deferredStructures.push({ sprite, x, y });
        } else {
          ctx.drawImage(sprite, x, y, world.spriteDrawWidth, world.spriteDrawHeight);
        }

        if (DEBUG_TILES) {
          debugLabels.push({ iso, tileType });
        }
      }
    }

    // Draw structures in a second pass so they stay above adjacent terrain tiles.
    for (let i = 0; i < deferredStructures.length; i += 1) {
      const s = deferredStructures[i];
      ctx.drawImage(s.sprite, s.x, s.y, world.spriteDrawWidth, world.spriteDrawHeight);
    }

    if (DEBUG_TILES) {
      for (let i = 0; i < debugLabels.length; i += 1) {
        const label = debugLabels[i];
        ctx.save();
        ctx.fillStyle = "#f8d1d1";
        ctx.font = "8px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "#000000";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillText(TILE_DEBUG_NAMES[label.tileType] || String(label.tileType), label.iso.x, label.iso.y);
        ctx.restore();
      }
    }
  };
}
