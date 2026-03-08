import { WORLD_CONFIG } from "./config.mjs";
import { screenClickToWorld, worldToIsometric } from "./game-logic.mjs";
import { renderMinimap } from "./minimap-renderer.mjs";
import { createTileMapRenderer, loadTileSprites } from "./tilemap-renderer.mjs";

const SESSION_KEY = "homm_session_id";
const NAME_KEY = "homm_player_name";

const gameCanvas = document.getElementById("gameCanvas");
const minimapCanvas = document.getElementById("minimapCanvas");
const stepCountEl = document.getElementById("stepCount");
const gameCtx = gameCanvas.getContext("2d");
const miniCtx = minimapCanvas.getContext("2d");

if (!gameCtx || !miniCtx || !stepCountEl) {
  throw new Error("2D canvas is not supported in this browser.");
}

const view = { width: 1, height: 1 };
let world = WORLD_CONFIG;
let state = null;
let ws = null;
let backendReady = false;
let sessionId = null;
let playerName = null;
let pendingTargetKey = null;
let pendingFollowOnMoveStart = false;

function ensureSession() {
  let id = localStorage.getItem(SESSION_KEY);
  let name = localStorage.getItem(NAME_KEY);

  if (!id) {
    id =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `sess_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
    localStorage.setItem(SESSION_KEY, id);
  }

  if (!name) {
    while (!name) {
      const value = prompt("Escribe tu nombre de jugador:");
      if (value === null) continue;
      const trimmed = value.trim().slice(0, 24);
      if (trimmed) name = trimmed;
    }
    localStorage.setItem(NAME_KEY, name);
  }

  sessionId = id;
  playerName = name;
}

function resizeCanvases() {
  const ratio = window.devicePixelRatio || 1;
  const rect = gameCanvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width * ratio));
  const h = Math.max(1, Math.floor(rect.height * ratio));

  if (gameCanvas.width !== w || gameCanvas.height !== h) {
    gameCanvas.width = w;
    gameCanvas.height = h;
  }

  view.width = gameCanvas.width;
  view.height = gameCanvas.height;
}

function sendWs(payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function renderBackendError(message) {
  stepCountEl.textContent = "Backend error";
  gameCtx.fillStyle = "#121212";
  gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
  gameCtx.fillStyle = "#ff6b6b";
  gameCtx.font = "bold 28px sans-serif";
  gameCtx.fillText("Backend unavailable", 40, 80);
  gameCtx.font = "18px sans-serif";
  gameCtx.fillStyle = "#f4f4f4";
  gameCtx.fillText(message, 40, 120);
}

function getWorldBounds() {
  return {
    width: world.cols * world.tileSize,
    height: world.rows * world.tileSize,
  };
}

function applySnapshot(data) {
  const wasMoving = state?.moveTarget?.active === true;

  state = {
    ...data.state,
    players: data.players || [],
    selfSessionId: data.selfSessionId,
    chunk: data.chunk,
  };
  stepCountEl.textContent = String(data.steps);

  const isMoving = state?.moveTarget?.active === true;
  if (pendingFollowOnMoveStart && !wasMoving && isMoving) {
    pendingFollowOnMoveStart = false;
    sendWs({
      type: "view",
      viewWidth: view.width,
      viewHeight: view.height,
      followPlayer: true,
    });
  }
}

function connectWs() {
  return new Promise((resolve, reject) => {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${protocol}://${location.host}/ws`);

    ws.addEventListener("open", () => {
      sendWs({
        type: "hello",
        sessionId,
        name: playerName,
        viewWidth: view.width,
        viewHeight: view.height,
      });
    });

    ws.addEventListener("message", (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "error") {
        reject(new Error(data.message || "Backend error"));
        return;
      }

      if (data.type === "bootstrap") {
        world = data.world;
        applySnapshot(data);
        backendReady = true;
        resolve();
        return;
      }

      if (data.type === "state") {
        applySnapshot(data);
      }
    });

    ws.addEventListener("close", () => {
      backendReady = false;
      renderBackendError("Game disabled until server recovers.");
    });

    ws.addEventListener("error", () => {
      reject(new Error("WebSocket connection failed"));
    });
  });
}

function renderPlayersOverlay(currentState) {
  if (!currentState || !currentState.players) return;

  for (let i = 0; i < currentState.players.length; i += 1) {
    const p = currentState.players[i];
    const iso = worldToIsometric(p.x, p.y, world, currentState.camera, view);
    const radius = p.id === currentState.selfSessionId ? 10 : 8;

    gameCtx.fillStyle = p.id === currentState.selfSessionId ? "#ffe743" : p.color || "#ffffff";
    gameCtx.beginPath();
    gameCtx.arc(iso.x, iso.y, radius, 0, Math.PI * 2);
    gameCtx.fill();

    gameCtx.font = "14px sans-serif";
    gameCtx.textAlign = "center";
    gameCtx.fillStyle = "#101010";
    gameCtx.fillText(p.name, iso.x + 1, iso.y - 14 + 1);
    gameCtx.fillStyle = "#ffffff";
    gameCtx.fillText(p.name, iso.x, iso.y - 14);
  }
}

function worldToTileKey(worldPos) {
  const col = Math.max(0, Math.min(world.cols - 1, Math.round(worldPos.x / world.tileSize)));
  const row = Math.max(0, Math.min(world.rows - 1, Math.round(worldPos.y / world.tileSize)));
  return `${col},${row}`;
}

function getPlannedTargetKey(currentState) {
  const planned = currentState?.plannedPath;
  if (!planned || planned.length === 0) return null;
  return worldToTileKey(planned[planned.length - 1]);
}

function drawArrow(fromIso, toIso) {
  const dx = toIso.x - fromIso.x;
  const dy = toIso.y - fromIso.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;

  const ux = dx / len;
  const uy = dy / len;
  const headLength = 12;
  const headHalfWidth = 5;
  const baseX = toIso.x - ux * headLength;
  const baseY = toIso.y - uy * headLength;
  const nx = -uy;
  const ny = ux;

  gameCtx.strokeStyle = "#ffffff";
  gameCtx.lineWidth = 8;
  gameCtx.beginPath();
  gameCtx.moveTo(fromIso.x, fromIso.y);
  gameCtx.lineTo(baseX, baseY);
  gameCtx.stroke();

  gameCtx.strokeStyle = "#22c55e";
  gameCtx.lineWidth = 5;
  gameCtx.beginPath();
  gameCtx.moveTo(fromIso.x, fromIso.y);
  gameCtx.lineTo(baseX, baseY);
  gameCtx.stroke();

  gameCtx.fillStyle = "#22c55e";
  gameCtx.strokeStyle = "#ffffff";
  gameCtx.lineWidth = 3;
  gameCtx.lineJoin = "round";
  gameCtx.beginPath();
  gameCtx.moveTo(toIso.x, toIso.y);
  gameCtx.lineTo(baseX + nx * headHalfWidth, baseY + ny * headHalfWidth);
  gameCtx.lineTo(baseX - nx * headHalfWidth, baseY - ny * headHalfWidth);
  gameCtx.closePath();
  gameCtx.stroke();
  gameCtx.fill();
}

function renderPlannedPathOverlay(currentState) {
  if (!currentState || !currentState.plannedPath || currentState.plannedPath.length === 0) return;

  let prevIso = worldToIsometric(
    currentState.player.x,
    currentState.player.y,
    world,
    currentState.camera,
    view
  );

  for (let i = 0; i < currentState.plannedPath.length; i += 1) {
    const step = currentState.plannedPath[i];
    const stepIso = worldToIsometric(step.x, step.y, world, currentState.camera, view);
    drawArrow(prevIso, stepIso);
    prevIso = stepIso;
  }
}

async function initGame() {
  ensureSession();
  resizeCanvases();
  const sprites = await loadTileSprites();
  await connectWs();
  const renderWorld = createTileMapRenderer(gameCtx, world, view, sprites);

  function frame() {
    if (state) {
      renderWorld(state.camera, state.chunk);
      renderPlannedPathOverlay(state);
      renderPlayersOverlay(state);
      renderMinimap(miniCtx, minimapCanvas, state, world, view);
    }
    requestAnimationFrame(frame);
  }

  gameCanvas.addEventListener("click", (event) => {
    if (!backendReady || !state) return;
    const rect = gameCanvas.getBoundingClientRect();
    const worldPos = screenClickToWorld(
      event,
      rect,
      view,
      state.camera,
      world,
      getWorldBounds().width,
      getWorldBounds().height
    );
    const clickedKey = worldToTileKey(worldPos);
    const plannedTargetKey = getPlannedTargetKey(state);

    if (plannedTargetKey && pendingTargetKey === plannedTargetKey && clickedKey === plannedTargetKey) {
      sendWs({
        type: "confirm_move",
        viewWidth: view.width,
        viewHeight: view.height,
      });
      pendingFollowOnMoveStart = true;
      pendingTargetKey = null;
      return;
    }

    sendWs({
      type: "plan_move",
      worldX: worldPos.x,
      worldY: worldPos.y,
      viewWidth: view.width,
      viewHeight: view.height,
    });
    pendingTargetKey = clickedKey;
  });

  minimapCanvas.addEventListener("click", (event) => {
    if (!backendReady || !state) return;
    const rect = minimapCanvas.getBoundingClientRect();
    const mmX = ((event.clientX - rect.left) / rect.width) * minimapCanvas.width;
    const mmY = ((event.clientY - rect.top) / rect.height) * minimapCanvas.height;
    const bounds = getWorldBounds();
    const cameraX = Math.max(0, Math.min(bounds.width, (mmX / minimapCanvas.width) * bounds.width));
    const cameraY = Math.max(0, Math.min(bounds.height, (mmY / minimapCanvas.height) * bounds.height));

    sendWs({
      type: "view",
      viewWidth: view.width,
      viewHeight: view.height,
      cameraX,
      cameraY,
    });
  });

  window.addEventListener("resize", () => {
    resizeCanvases();
    sendWs({ type: "view", viewWidth: view.width, viewHeight: view.height });
  });

  requestAnimationFrame(frame);
}

initGame().catch((error) => {
  console.error(error);
  renderBackendError("WebSocket bootstrap failed.");
});
