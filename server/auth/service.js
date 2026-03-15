const crypto = require("crypto");
const { hashPassword, verifyPassword } = require("./password");

const MIN_USERNAME_LENGTH = 3;
const MIN_PASSWORD_LENGTH = 4;
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function validateCredentials(username, password) {
  const normalized = normalizeUsername(username);
  const rawPassword = String(password || "");

  if (normalized.length < MIN_USERNAME_LENGTH) {
    const err = new Error(`Username must have at least ${MIN_USERNAME_LENGTH} characters.`);
    err.statusCode = 400;
    throw err;
  }

  if (rawPassword.length < MIN_PASSWORD_LENGTH) {
    const err = new Error(`Password must have at least ${MIN_PASSWORD_LENGTH} characters.`);
    err.statusCode = 400;
    throw err;
  }

  return { username: normalized, password: rawPassword };
}

async function createAuthService(mongoUri) {
  const mongoose = require("mongoose");
  let mongoEnabled = true;
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  } catch (error) {
    mongoEnabled = false;
    console.warn(`[auth] MongoDB unavailable at ${mongoUri}. Falling back to in-memory auth.`);
    console.warn(`[auth] Reason: ${error.message}`);
  }

  let User = null;
  if (mongoEnabled) {
    const userSchema = new mongoose.Schema(
      {
        username: { type: String, required: true, unique: true, index: true },
        passwordHash: { type: String, required: true },
      },
      { timestamps: true }
    );
    User = mongoose.models.User || mongoose.model("User", userSchema);
  }

  const memoryUsers = new Map();
  const sessions = new Map();

  function issueToken(username) {
    const token = crypto.randomBytes(24).toString("hex");
    sessions.set(token, { username, createdAt: Date.now() });
    return token;
  }

  function getUsernameFromToken(rawToken) {
    const token = String(rawToken || "").trim();
    if (!token) return null;
    const entry = sessions.get(token);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > TOKEN_TTL_MS) {
      sessions.delete(token);
      return null;
    }
    return entry.username;
  }

  function revokeToken(rawToken) {
    const token = String(rawToken || "").trim();
    if (!token) return false;
    return sessions.delete(token);
  }

  async function loginOrRegister(username, password) {
    const creds = validateCredentials(username, password);
    let created = false;
    let user = null;

    if (mongoEnabled) {
      user = await User.findOne({ username: creds.username }).exec();
      if (!user) {
        user = await User.create({
          username: creds.username,
          passwordHash: hashPassword(creds.password),
        });
        created = true;
      } else if (!verifyPassword(creds.password, user.passwordHash)) {
        const err = new Error("Invalid credentials.");
        err.statusCode = 401;
        throw err;
      }
    } else {
      user = memoryUsers.get(creds.username) || null;
      if (!user) {
        user = {
          username: creds.username,
          passwordHash: hashPassword(creds.password),
        };
        memoryUsers.set(creds.username, user);
        created = true;
      } else if (!verifyPassword(creds.password, user.passwordHash)) {
        const err = new Error("Invalid credentials.");
        err.statusCode = 401;
        throw err;
      }
    }

    return {
      username: user.username,
      token: issueToken(user.username),
      created,
    };
  }

  async function register(username, password) {
    const creds = validateCredentials(username, password);
    let user = null;
    if (mongoEnabled) {
      const existing = await User.findOne({ username: creds.username }).exec();
      if (existing) {
        const err = new Error("User already exists.");
        err.statusCode = 409;
        throw err;
      }

      user = await User.create({
        username: creds.username,
        passwordHash: hashPassword(creds.password),
      });
    } else {
      const existing = memoryUsers.get(creds.username);
      if (existing) {
        const err = new Error("User already exists.");
        err.statusCode = 409;
        throw err;
      }
      user = {
        username: creds.username,
        passwordHash: hashPassword(creds.password),
      };
      memoryUsers.set(creds.username, user);
    }

    return {
      username: user.username,
      token: issueToken(user.username),
      created: true,
    };
  }

  async function close() {
    sessions.clear();
    memoryUsers.clear();
    if (mongoEnabled) {
      await mongoose.connection.close();
    }
  }

  return {
    loginOrRegister,
    register,
    getUsernameFromToken,
    revokeToken,
    close,
  };
}

module.exports = {
  createAuthService,
  normalizeUsername,
};
