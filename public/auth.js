const AUTH_TOKEN_KEY = "homm_auth_token";
const AUTH_USER_KEY = "homm_auth_user";

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const authMessageEl = document.getElementById("authMessage");

if (!loginForm || !registerForm || !authMessageEl) {
  throw new Error("Auth UI not found.");
}

function showMessage(text, isError = false) {
  authMessageEl.textContent = text;
  authMessageEl.style.color = isError ? "#ff9d9d" : "#b2bfd1";
}

function goToGame() {
  window.location.href = "/game.html";
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let data = {};
  try {
    data = await response.json();
  } catch {}

  if (!response.ok || data.ok !== true) {
    throw new Error(data.message || "Auth request failed.");
  }
  return data;
}

function persistSession(data) {
  localStorage.setItem(AUTH_TOKEN_KEY, data.token);
  localStorage.setItem(AUTH_USER_KEY, data.username);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(loginForm);
  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "");
  if (!username || !password) return;

  showMessage("Conectando...");
  try {
    const result = await postJson("/api/auth/login", { username, password });
    persistSession(result);
    showMessage(result.created ? "Usuario creado y login correcto." : "Login correcto.");
    goToGame();
  } catch (error) {
    showMessage(error.message, true);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(registerForm);
  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "");
  if (!username || !password) return;

  showMessage("Creando usuario...");
  try {
    const result = await postJson("/api/auth/register", { username, password });
    persistSession(result);
    showMessage("Registro correcto.");
    goToGame();
  } catch (error) {
    showMessage(error.message, true);
  }
});

const existingToken = localStorage.getItem(AUTH_TOKEN_KEY);
const existingUser = localStorage.getItem(AUTH_USER_KEY);
if (existingToken && existingUser) {
  goToGame();
}
