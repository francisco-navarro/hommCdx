# Procedural Map + Minimap Prototype

Simple Node + browser project for a web-based game prototype with:

- Procedural tile map rendered with PNG sprites
- Camera following a player
- Minimap with viewport rectangle

## Run

```bash
npm start
```

Open `http://127.0.0.1:3000`.

## Test

```bash
npm test
```

## Controls

- Click on the map to move

## Project Layout

- `server.js`: static file server
- `public/index.html`: game page
- `public/index.js`: game entrypoint
- `public/state.mjs`: game state transitions
- `public/world.mjs`: world generation
- `public/tilemap-renderer.mjs`: sprite-based map rendering
- `public/minimap-renderer.mjs`: minimap rendering
- `public/styles.css`: basic layout and HUD styles
