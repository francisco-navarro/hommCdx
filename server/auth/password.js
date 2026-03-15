const crypto = require("crypto");

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const HASH_PREFIX = "scrypt";

function hashPassword(password) {
  const raw = String(password || "");
  if (!raw) {
    throw new Error("Password is required.");
  }
  const salt = crypto.randomBytes(SALT_BYTES).toString("hex");
  const hash = crypto.scryptSync(raw, salt, KEY_BYTES).toString("hex");
  return `${HASH_PREFIX}:${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const raw = String(password || "");
  if (!raw || typeof storedHash !== "string") return false;

  const [prefix, salt, expectedHex] = storedHash.split(":");
  if (prefix !== HASH_PREFIX || !salt || !expectedHex) return false;

  try {
    const actual = crypto.scryptSync(raw, salt, KEY_BYTES);
    const expected = Buffer.from(expectedHex, "hex");
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
};
