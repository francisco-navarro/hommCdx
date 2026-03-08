import {
  clamp,
  updatePlayerTowardsTarget,
  clampPlayerToWorld,
  computeCamera,
  screenClickToWorld,
} from "./game-logic.mjs";

const gameCanvas = document.getElementById("gameCanvas");
const minimapCanvas = document.getElementById("minimapCanvas");
const gl = gameCanvas.getContext("webgl");
const miniCtx = minimapCanvas.getContext("2d");

if (!gl || !miniCtx) {
  throw new Error("WebGL or 2D canvas is not supported in this browser.");
}

const WORLD = {
  cols: 80,
  rows: 80,
  tileSize: 32,
};

const VIEW = {
  width: gameCanvas.width,
  height: gameCanvas.height,
};

const player = {
  x: (WORLD.cols * WORLD.tileSize) / 2,
  y: (WORLD.rows * WORLD.tileSize) / 2,
  size: 18,
  speed: 300,
};

const camera = {
  x: 0,
  y: 0,
};

const moveTarget = {
  active: false,
  x: player.x,
  y: player.y,
};

const tiles = new Uint8Array(WORLD.cols * WORLD.rows);

function seededValue(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function buildWorld() {
  for (let y = 0; y < WORLD.rows; y += 1) {
    for (let x = 0; x < WORLD.cols; x += 1) {
      const n = seededValue(x, y);
      const idx = y * WORLD.cols + x;
      if (n < 0.16) {
        tiles[idx] = 0; // water
      } else if (n < 0.58) {
        tiles[idx] = 1; // grass
      } else if (n < 0.82) {
        tiles[idx] = 2; // forest
      } else {
        tiles[idx] = 3; // mountain
      }
    }
  }
}

const tileColors = [
  [0.12, 0.3, 0.58],
  [0.19, 0.58, 0.2],
  [0.05, 0.38, 0.09],
  [0.42, 0.42, 0.42],
];

const vertexShaderSource = `
  attribute vec2 aPosition;
  attribute vec3 aColor;
  varying vec3 vColor;

  void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
    vColor = aColor;
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  varying vec3 vColor;

  void main() {
    gl_FragColor = vec4(vColor, 1.0);
  }
`;

function createShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

function createProgram(vsSource, fsSource) {
  const vs = createShader(gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }
  return program;
}

const program = createProgram(vertexShaderSource, fragmentShaderSource);
const aPosition = gl.getAttribLocation(program, "aPosition");
const aColor = gl.getAttribLocation(program, "aColor");
const positionBuffer = gl.createBuffer();
const colorBuffer = gl.createBuffer();

function worldToClipX(worldX) {
  return ((worldX - camera.x) / VIEW.width) * 2 - 1;
}

function worldToClipY(worldY) {
  return 1 - ((worldY - camera.y) / VIEW.height) * 2;
}

function pushRect(positions, colors, x, y, w, h, color) {
  const x1 = worldToClipX(x);
  const y1 = worldToClipY(y);
  const x2 = worldToClipX(x + w);
  const y2 = worldToClipY(y + h);

  positions.push(
    x1, y1, x2, y1, x1, y2,
    x1, y2, x2, y1, x2, y2
  );

  for (let i = 0; i < 6; i += 1) {
    colors.push(color[0], color[1], color[2]);
  }
}

function renderWorld() {
  const positions = [];
  const colors = [];
  const tileSize = WORLD.tileSize;
  const startCol = clamp(Math.floor(camera.x / tileSize), 0, WORLD.cols - 1);
  const endCol = clamp(Math.ceil((camera.x + VIEW.width) / tileSize), 0, WORLD.cols);
  const startRow = clamp(Math.floor(camera.y / tileSize), 0, WORLD.rows - 1);
  const endRow = clamp(Math.ceil((camera.y + VIEW.height) / tileSize), 0, WORLD.rows);

  for (let row = startRow; row < endRow; row += 1) {
    for (let col = startCol; col < endCol; col += 1) {
      const idx = row * WORLD.cols + col;
      const t = tiles[idx];
      pushRect(
        positions,
        colors,
        col * tileSize,
        row * tileSize,
        tileSize,
        tileSize,
        tileColors[t]
      );
    }
  }

  pushRect(
    positions,
    colors,
    player.x - player.size / 2,
    player.y - player.size / 2,
    player.size,
    player.size,
    [1, 0.92, 0.15]
  );

  gl.viewport(0, 0, VIEW.width, VIEW.height);
  gl.clearColor(0.05, 0.07, 0.1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STREAM_DRAW);
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STREAM_DRAW);
  gl.enableVertexAttribArray(aColor);
  gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, positions.length / 2);
}

function renderMinimap() {
  const mmW = minimapCanvas.width;
  const mmH = minimapCanvas.height;
  miniCtx.clearRect(0, 0, mmW, mmH);

  const tileW = mmW / WORLD.cols;
  const tileH = mmH / WORLD.rows;

  for (let row = 0; row < WORLD.rows; row += 1) {
    for (let col = 0; col < WORLD.cols; col += 1) {
      const t = tiles[row * WORLD.cols + col];
      const [r, g, b] = tileColors[t];
      miniCtx.fillStyle = `rgb(${Math.floor(r * 255)}, ${Math.floor(g * 255)}, ${Math.floor(b * 255)})`;
      miniCtx.fillRect(col * tileW, row * tileH, tileW + 1, tileH + 1);
    }
  }

  const px = (player.x / (WORLD.cols * WORLD.tileSize)) * mmW;
  const py = (player.y / (WORLD.rows * WORLD.tileSize)) * mmH;
  miniCtx.fillStyle = "#ffe743";
  miniCtx.beginPath();
  miniCtx.arc(px, py, 4, 0, Math.PI * 2);
  miniCtx.fill();

  const vx = (camera.x / (WORLD.cols * WORLD.tileSize)) * mmW;
  const vy = (camera.y / (WORLD.rows * WORLD.tileSize)) * mmH;
  const vw = (VIEW.width / (WORLD.cols * WORLD.tileSize)) * mmW;
  const vh = (VIEW.height / (WORLD.rows * WORLD.tileSize)) * mmH;

  miniCtx.strokeStyle = "#ffffff";
  miniCtx.lineWidth = 1.5;
  miniCtx.strokeRect(vx, vy, vw, vh);
}

function update(dt) {
  const movement = updatePlayerTowardsTarget(player, moveTarget, dt);
  Object.assign(player, movement.player);
  Object.assign(moveTarget, movement.moveTarget);

  const worldW = WORLD.cols * WORLD.tileSize;
  const worldH = WORLD.rows * WORLD.tileSize;
  const clampedPlayer = clampPlayerToWorld(player, worldW, worldH);
  Object.assign(player, clampedPlayer);

  const nextCamera = computeCamera(player, VIEW, worldW, worldH);
  Object.assign(camera, nextCamera);
}

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  update(dt);
  renderWorld();
  renderMinimap();
  requestAnimationFrame(frame);
}

gameCanvas.addEventListener("click", (event) => {
  const rect = gameCanvas.getBoundingClientRect();
  const worldW = WORLD.cols * WORLD.tileSize;
  const worldH = WORLD.rows * WORLD.tileSize;
  const clickTarget = screenClickToWorld(
    event,
    rect,
    VIEW,
    camera,
    worldW,
    worldH
  );

  moveTarget.x = clickTarget.x;
  moveTarget.y = clickTarget.y;
  moveTarget.active = true;
});

buildWorld();
requestAnimationFrame(frame);
