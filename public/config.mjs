const RENDER_SCALE = 2;
const ISO_BASE_WIDTH = 128;
const ISO_BASE_HEIGHT = 64;
const SPRITE_BASE_WIDTH = 128;
const SPRITE_BASE_HEIGHT = 110;

export const WORLD_CONFIG = {
  cols: 80,
  rows: 80,
  tileSize: 32,
  isoTileWidth: ISO_BASE_WIDTH * RENDER_SCALE,
  isoTileHeight: ISO_BASE_HEIGHT * RENDER_SCALE,
  spriteDrawWidth: SPRITE_BASE_WIDTH * RENDER_SCALE,
  spriteDrawHeight: SPRITE_BASE_HEIGHT * RENDER_SCALE,
};

export const PLAYER_CONFIG = {
  size: 18,
  speed: 300,
};

export { TILE_TYPES, TILE_COLORS, TILE_CATALOG, GENERATION_RULES, tileIsWalkable } from "./map-config.mjs";
