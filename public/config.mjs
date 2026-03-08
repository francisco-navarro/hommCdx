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

export const TILE_TYPES = {
  GRASS: 0,
  PATH_H: 1,
  PATH_V: 2,
  WATER: 3,
  WATER_BORDER: 4,
  CORNER_1: 5,
  CORNER_2: 6,
};

export const TILE_COLORS = [
  [0.19, 0.58, 0.2],
  [0.74, 0.62, 0.43],
  [0.74, 0.62, 0.43],
  [0.12, 0.37, 0.7],
  [0.53, 0.71, 0.86],
  [0.76, 0.64, 0.46],
  [0.76, 0.64, 0.46],
];
