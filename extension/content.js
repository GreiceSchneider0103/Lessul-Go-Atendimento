(function () {
  if (!self.LessulML?.isOrderPage()) return;

  let injected = false;

  function injectButton() {
    if (injected || document.getElementById("lessul-import-root")) return;
    injected = true;

    const host = document.createElement("div");
    host.id = "lessul-import-root";
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      .btn { position: fixed; right: 20px; bottom: 20px; z-index: 999999; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; font-family: system-ui, sans-serif; }
      button { background: #2563eb; color: #fff; border: none; border-radius: 999px; padding: 12px 18px; font-size: 13.5px; font-weight: 700; cursor: pointer; box-shadow: 0 8px 18px rgba(37,99,235,0.35); }
      button:hover { background: #1d4ed8; }
      button:disabled { opacity: 0.6; cursor: not-allowed; }
      .toast { background: #111827; color: #fff; padding: 10px 14px; border-radius: 8px; font-size: 12.5px; max-width: 280px; }
      .toast.error { background: #b91c1c; }
      .toast a { color: #93c5fd; }
    `;

    const wrap = document.createElement("div");
    wrap.className = "btn";

    const button = document.createElement("button");
    button.textContent = "Importar para o Lessul Go";
    button.addEventListener("click", () => handleImport(button, wrap));

    wrap.appendChild(button);
    root.appendChild(style);
    root.appendChild(wrap);
  }

  function showToast(wrap, message, isError) {
    const existing = wrap.querySelector(".toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = `toast${isError ? " error" : ""}`;
    toast.textContent = message;
    wrap.prepend(toast);

    setTimeout(() => toast.remove(), 6000);
  }

  function handleImport(button, wrap) {
    button.disabled = true;
    button.textContent = "Importando...";

    const order = self.LessulML.extractOrder();

    chrome.runtime.sendMessage({ type: "IMPORT_ORDER", payload: order }, (response) => {
      button.disabled = false;
      button.textContent = "Importar para o Lessul Go";

      if (chrome.runtime.lastError) {
        showToast(wrap, "Falha ao comunicar com a extensão.", true);
        return;
      }

      if (!response?.ok) {
        showToast(wrap, response?.error ?? "Falha ao importar pedido.", true);
        return;
      }

      showToast(wrap, "Ticket pré-preenchido aberto em uma nova aba.");
    });
  }

  injectButton();
  new MutationObserver(injectButton).observe(document.body, { childList: true, subtree: true });
})();
