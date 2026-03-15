# Procedural Map + Minimap Prototype

Simple Node + browser project for a web-based game prototype with:

- Procedural isometric tile map rendered with overlapping PNG sprites
- Camera following a player
- Minimap with viewport rectangle

## Run

```bash
npm start
```

Open `http://127.0.0.1:3000`.

Before entering the game, use the login/register page at `/`.
After authentication you will be redirected to `/game.html`.

By default, user credentials are stored in MongoDB at:

`mongodb://127.0.0.1:27017/hommcodex`

### Optional performance tuning

- Server tick rate is configurable with `TICK_MS` (default: `33`, min `16`, max `100`).

```bash
TICK_MS=16 npm start
```

- Tile debug labels are disabled by default. Enable only when needed:
  - `http://127.0.0.1:3000/?debugTiles=1`

## Test

```bash
npm test
```

## Controls

- Click on the map to move

## Project Layout

- `server.js`: static file server
- `public/index.html`: login + register page
- `public/auth.js`: auth UI logic
- `public/game.html`: game page
- `public/index.js`: game entrypoint
- `public/state.mjs`: game state transitions
- `public/world.mjs`: world generation
- `public/tilemap-renderer.mjs`: sprite-based map rendering
- `public/minimap-renderer.mjs`: minimap rendering
- `public/styles.css`: basic layout and HUD styles
