const http = require("http");
const { HOST, PORT, PUBLIC_DIR } = require("./config");
const { handleStatic } = require("./connection/static-handler");
const { createGameEngine } = require("./game/engine");
const { attachWebSocketServer } = require("./connection/ws-handler");

async function startServer() {
  const game = await createGameEngine(PUBLIC_DIR);
  const server = http.createServer((req, res) => {
    handleStatic(req, res, PUBLIC_DIR, HOST, PORT);
  });

  const stopTicker = attachWebSocketServer(server, game, HOST, PORT);

  server.listen(PORT, HOST, () => {
    console.log(`Game server running at http://${HOST}:${PORT}`);
  });

  process.on("SIGINT", () => {
    stopTicker();
    server.close();
  });
}

module.exports = {
  startServer,
};
