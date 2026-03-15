function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readBody(req, maxBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("Request body too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readJsonBody(req) {
  const raw = await readBody(req);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const err = new Error("Invalid JSON body.");
    err.statusCode = 400;
    throw err;
  }
}

async function handleAuthApi(req, res, authService, host, port) {
  const url = new URL(req.url, `http://${req.headers.host || `${host}:${port}`}`);
  const { pathname } = url;

  if (pathname === "/api/auth/login" && req.method === "POST") {
    const body = await readJsonBody(req);
    const result = await authService.loginOrRegister(body.username, body.password);
    sendJson(res, 200, { ok: true, ...result });
    return true;
  }

  if (pathname === "/api/auth/register" && req.method === "POST") {
    const body = await readJsonBody(req);
    const result = await authService.register(body.username, body.password);
    sendJson(res, 201, { ok: true, ...result });
    return true;
  }

  if (pathname === "/api/auth/logout" && req.method === "POST") {
    const body = await readJsonBody(req);
    authService.revokeToken(body.token);
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}

function sendAuthError(res, error) {
  const statusCode = Number(error?.statusCode) || 500;
  const message = statusCode === 500 ? "Internal Server Error" : String(error.message || "Request failed.");
  sendJson(res, statusCode, { ok: false, message });
}

module.exports = {
  handleAuthApi,
  sendAuthError,
};
