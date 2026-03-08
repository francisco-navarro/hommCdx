const path = require("path");

function clampView(rawWidth, rawHeight) {
  return {
    width: Math.max(1, Math.floor(Number(rawWidth) || 960)),
    height: Math.max(1, Math.floor(Number(rawHeight) || 540)),
  };
}

function getSafePath(urlPath, publicDir) {
  const cleanPath = urlPath === "/" ? "/index.html" : urlPath;
  const normalized = path.normalize(cleanPath).replace(/^(\.\.[/\\])+/, "");
  return path.join(publicDir, normalized);
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

module.exports = {
  clampView,
  getSafePath,
  isNonEmptyString,
};
