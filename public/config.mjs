export const WORLD_CONFIG = {
  cols: 80,
  rows: 80,
  tileSize: 32,
  isoTileWidth: 160,
  isoTileHeight: 80,
  spriteDrawWidth: 160,
  spriteDrawHeight: 140,
};

export const PLAYER_CONFIG = {
  size: 18,
  speed: 300,
};

export { TILE_TYPES, TILE_COLORS, TILE_CATALOG, GENERATION_RULES, tileIsWalkable } from "./map-config.mjs";
