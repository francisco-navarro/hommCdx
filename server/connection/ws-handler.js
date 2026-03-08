const { TICK_MS } = require("../config");
const { clampView, isNonEmptyString } = require("../utils");
const { wsAcceptKey, encodeWsText, decodeClientFrames } = require("./ws-protocol");

function attachWebSocketServer(server, game, host, port) {
  const clients = new Set();

  function send(client, payload) {
    client.socket.write(encodeWsText(JSON.stringify(payload)));
  }

  function broadcastState() {
    for (const client of clients) {
      if (!client.sessionId) continue;
      const snap = game.getSnapshotFor(client.sessionId, client.view);
      if (snap) send(client, { type: "state", ...snap });
    }
  }

  const ticker = setInterval(() => {
    game.tick();
    broadcastState();
  }, TICK_MS);

  server.on("upgrade", (req, socket) => {
    try {
      const pathname = new URL(req.url, `http://${req.headers.host || `${host}:${port}`}`).pathname;
      if (pathname !== "/ws") {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
      }

      const key = req.headers["sec-websocket-key"];
      if (!key) {
        socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
        socket.destroy();
        return;
      }

      const accept = wsAcceptKey(key);
      const responseHeaders = [
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${accept}`,
        "\r\n",
      ];
      socket.write(responseHeaders.join("\r\n"));

      const client = {
        socket,
        buffer: Buffer.alloc(0),
        sessionId: null,
        name: null,
        view: { width: 960, height: 540 },
        closed: false,
      };
      clients.add(client);

      socket.on("data", (chunk) => {
        try {
          client.buffer = Buffer.concat([client.buffer, chunk]);
          const parsed = decodeClientFrames(client.buffer);
          client.buffer = parsed.remaining;

          for (const msg of parsed.messages) {
            if (msg.type === "close") {
              socket.end();
              return;
            }
            if (msg.type !== "text") continue;

            const data = JSON.parse(msg.text);
            if (data.type === "hello") {
              if (!isNonEmptyString(data.sessionId) || !isNonEmptyString(data.name)) {
                send(client, { type: "error", message: "Missing session or name." });
                socket.end();
                return;
              }

              client.sessionId = data.sessionId.trim();
              client.name = data.name.trim().slice(0, 24);
              client.view = clampView(data.viewWidth, data.viewHeight);
              game.ensurePlayer(client.sessionId, client.name);
              console.log(`Player connected: ${client.name} (${client.sessionId})`);

              const snap = game.getSnapshotFor(client.sessionId, client.view);
              send(client, { type: "bootstrap", world: game.world, ...snap });
              continue;
            }

            if (!client.sessionId) continue;

            if (data.type === "view") {
              client.view = clampView(data.viewWidth, data.viewHeight);
              const snap = game.getSnapshotFor(client.sessionId, client.view);
              send(client, { type: "state", ...snap });
              continue;
            }

            if (data.type === "move") {
              client.view = clampView(data.viewWidth, data.viewHeight);
              game.applyMove(client.sessionId, Number(data.canvasX), Number(data.canvasY), client.view);
              const snap = game.getSnapshotFor(client.sessionId, client.view);
              send(client, { type: "state", ...snap });
              continue;
            }

            if (data.type === "plan_move") {
              client.view = clampView(data.viewWidth, data.viewHeight);
              game.planMove(client.sessionId, Number(data.canvasX), Number(data.canvasY), client.view);
              const snap = game.getSnapshotFor(client.sessionId, client.view);
              send(client, { type: "state", ...snap });
              continue;
            }

            if (data.type === "confirm_move") {
              client.view = clampView(data.viewWidth, data.viewHeight);
              game.confirmMove(client.sessionId);
              const snap = game.getSnapshotFor(client.sessionId, client.view);
              send(client, { type: "state", ...snap });
            }
          }
        } catch {
          socket.destroy();
        }
      });

      function handleDisconnect() {
        if (client.closed) return;
        client.closed = true;
        if (client.sessionId) {
          console.log(`Player disconnected: ${client.name} (${client.sessionId})`);
        }
        clients.delete(client);
      }

      socket.on("close", handleDisconnect);
      socket.on("error", handleDisconnect);
      socket.on("end", handleDisconnect);
    } catch {
      socket.destroy();
    }
  });

  return () => clearInterval(ticker);
}

module.exports = {
  attachWebSocketServer,
};
