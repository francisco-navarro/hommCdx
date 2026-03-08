const path = require("path");

const HOST = "127.0.0.1";
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function parseTickMs(value, fallback = 33) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(16, Math.min(100, parsed));
}

const TICK_MS = parseTickMs(process.env.TICK_MS);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

module.exports = {
  HOST,
  PORT,
  PUBLIC_DIR,
  WS_GUID,
  TICK_MS,
  MIME_TYPES,
};
