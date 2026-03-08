import { WORLD_CONFIG } from "./config.mjs";
import { renderMinimap } from "./minimap-renderer.mjs";
import { createInitialState, setMoveTargetFromClick, updateGameState } from "./state.mjs";
import { createTileMapRenderer, loadTileSprites } from "./tilemap-renderer.mjs";
import { createWorldTiles } from "./world.mjs";

const gameCanvas = document.getElementById("gameCanvas");
const minimapCanvas = document.getElementById("minimapCanvas");
const gameCtx = gameCanvas.getContext("2d");
const miniCtx = minimapCanvas.getContext("2d");

if (!gameCtx || !miniCtx) {
  throw new Error("2D canvas is not supported in this browser.");
}

const view = {
  width: gameCanvas.width,
  height: gameCanvas.height,
};

const world = WORLD_CONFIG;
const tiles = createWorldTiles(world);

async function initGame() {
  const sprites = await loadTileSprites();
  const renderWorld = createTileMapRenderer(gameCtx, world, view, sprites);

  let state = createInitialState(world, view);
  let lastTime = performance.now();

  function frame(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    state = updateGameState(state, world, view, dt);
    renderWorld(state, tiles);
    renderMinimap(miniCtx, minimapCanvas, state, world, view, tiles);
    requestAnimationFrame(frame);
  }

  gameCanvas.addEventListener("click", (event) => {
    const rect = gameCanvas.getBoundingClientRect();
    state = setMoveTargetFromClick(state, event, rect, world, view);
  });

  requestAnimationFrame(frame);
}

initGame().catch((error) => {
  console.error(error);
});
