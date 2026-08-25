const DEFAULT_API_BASE = "https://lessul-go-atendimento-2p7t.onrender.com";

async function getConfig() {
  const { apiBase, token } = await chrome.storage.local.get(["apiBase", "token"]);
  return { apiBase: apiBase || DEFAULT_API_BASE, token: token || null };
}

async function importOrder(payload) {
  const { apiBase, token } = await getConfig();

  if (!token) {
    return { ok: false, error: "Configure o token da extensão nas opções." };
  }

  let response;
  try {
    response = await fetch(`${apiBase}/api/extension/tickets/prefill`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
  } catch {
    return { ok: false, error: "Não foi possível conectar ao Lessul Go. Verifique sua conexão." };
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      return { ok: false, error: "Token inválido ou revogado. Gere um novo em Extensão no sistema." };
    }
    return { ok: false, error: body?.message ?? "Falha ao importar pedido." };
  }

  await chrome.tabs.create({ url: `${apiBase}${body.data.prefillPath}` });
  return { ok: true };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "IMPORT_ORDER") {
    importOrder(message.payload).then(sendResponse);
    return true;
  }
  return false;
});
