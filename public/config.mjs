export const WORLD_CONFIG = {
  cols: 80,
  rows: 80,
  tileSize: 32,
  isoTileWidth: 128,
  isoTileHeight: 64,
  spriteDrawWidth: 128,
  spriteDrawHeight: 110,
};

export const PLAYER_CONFIG = {
  size: 18,
  speed: 300,
};

export { TILE_TYPES, TILE_COLORS, TILE_CATALOG, GENERATION_RULES, tileIsWalkable } from "./map-config.mjs";
