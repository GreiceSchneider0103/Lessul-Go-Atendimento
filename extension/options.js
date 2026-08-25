const DEFAULT_API_BASE = "https://lessul-go-atendimento-2p7t.onrender.com";

const tokenInput = document.getElementById("token");
const apiBaseInput = document.getElementById("apiBase");
const statusEl = document.getElementById("status");

async function load() {
  const { apiBase, token } = await chrome.storage.local.get(["apiBase", "token"]);
  apiBaseInput.value = apiBase || DEFAULT_API_BASE;
  if (token) tokenInput.placeholder = "Token salvo (oculto)";
}

async function save() {
  const token = tokenInput.value.trim();
  const apiBase = apiBaseInput.value.trim().replace(/\/$/, "") || DEFAULT_API_BASE;

  const data = { apiBase };
  if (token) data.token = token;

  await chrome.storage.local.set(data);
  tokenInput.value = "";
  tokenInput.placeholder = token ? "Token salvo (oculto)" : tokenInput.placeholder;

  statusEl.textContent = "Configurações salvas.";
  statusEl.className = "ok";
  setTimeout(() => { statusEl.textContent = ""; }, 3000);
}

document.getElementById("save").addEventListener("click", save);
load();
