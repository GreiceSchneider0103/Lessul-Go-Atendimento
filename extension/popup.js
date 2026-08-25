const tokenDot = document.getElementById("tokenDot");
const tokenLabel = document.getElementById("tokenLabel");
const importBtn = document.getElementById("importBtn");
const messageEl = document.getElementById("message");

function setMessage(text, isError) {
  messageEl.textContent = text;
  messageEl.className = isError ? "error" : "ok";
}

async function init() {
  const { token } = await chrome.storage.local.get("token");

  if (token) {
    tokenDot.className = "dot ok";
    tokenLabel.textContent = "Token configurado";
  } else {
    tokenDot.className = "dot error";
    tokenLabel.textContent = "Token não configurado";
    importBtn.disabled = true;
  }
}

async function importFromActiveTab() {
  importBtn.disabled = true;
  setMessage("Extraindo dados da página...", false);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !/mercadolivre\.com\.br/.test(tab.url || "")) {
    setMessage("Abra a página do pedido no Mercado Livre para importar.", true);
    importBtn.disabled = false;
    return;
  }

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["extractor.js"] });
    const [{ result: order }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => self.LessulML.extractOrder()
    });

    const response = await chrome.runtime.sendMessage({ type: "IMPORT_ORDER", payload: order });

    if (!response?.ok) {
      setMessage(response?.error ?? "Falha ao importar pedido.", true);
    } else {
      setMessage("Ticket pré-preenchido aberto em uma nova aba.", false);
    }
  } catch {
    setMessage("Não foi possível ler os dados desta página.", true);
  } finally {
    importBtn.disabled = false;
  }
}

importBtn.addEventListener("click", importFromActiveTab);
document.getElementById("optionsLink").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

init();
