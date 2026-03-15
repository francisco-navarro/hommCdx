const http = require("http");
const { HOST, PORT, PUBLIC_DIR, MONGODB_URI } = require("./config");
const { handleStatic } = require("./connection/static-handler");
const { handleAuthApi, sendAuthError } = require("./connection/auth-handler");
const { createGameEngine } = require("./game/engine");
const { attachWebSocketServer } = require("./connection/ws-handler");

async function startServer() {
  const { createAuthService } = require("./auth/service");
  const auth = await createAuthService(MONGODB_URI);
  const game = await createGameEngine(PUBLIC_DIR);
  const server = http.createServer((req, res) => {
    handleAuthApi(req, res, auth, HOST, PORT)
      .then((handled) => {
        if (handled) return;
        handleStatic(req, res, PUBLIC_DIR, HOST, PORT);
      })
      .catch((error) => {
        sendAuthError(res, error);
      });
  });

  const stopRealtime = attachWebSocketServer(server, game, HOST, PORT, auth);
  let shuttingDown = false;

  server.listen(PORT, HOST, () => {
    console.log(`Game server running at http://${HOST}:${PORT}`);
  });

  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[shutdown] Signal received: ${signal}`);
    console.log("[shutdown] Stopping game ticker...");
    stopRealtime();
    console.log("[shutdown] Closing auth database...");
    auth.close().catch((error) => {
      console.error("[shutdown] Error while closing auth database:", error);
    });
    if (typeof server.closeIdleConnections === "function") {
      server.closeIdleConnections();
    }
    if (typeof server.closeAllConnections === "function") {
      server.closeAllConnections();
    }
    console.log("[shutdown] Closing HTTP/WebSocket server...");
    server.close((error) => {
      if (error) {
        console.error("[shutdown] Error while closing server:", error);
        process.exitCode = 1;
      } else {
        console.log("[shutdown] Server closed cleanly.");
      }
    });
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  process.on("exit", (code) => {
    console.log(`[shutdown] Process exiting with code ${code}.`);
  });
}

module.exports = {
  startServer,
};
