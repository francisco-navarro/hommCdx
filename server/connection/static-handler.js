const fs = require("fs");
const path = require("path");
const { MIME_TYPES } = require("../config");
const { getSafePath } = require("../utils");

function handleStatic(req, res, publicDir, host, port) {
  const pathname = new URL(req.url, `http://${req.headers.host || `${host}:${port}`}`).pathname;
  const filePath = getSafePath(pathname, publicDir);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not Found");
        return;
      }
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Internal Server Error");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

module.exports = {
  handleStatic,
};
