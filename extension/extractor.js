// Extraction logic for Mercado Livre order pages.
//
// NOTE: Mercado Livre's DOM/class names were not verified against a live,
// logged-in seller session (not reachable from the build environment), so
// this deliberately avoids brittle CSS-class selectors and instead searches
// for known Portuguese label text and reads the value next to it. If a label
// changes, add its variant to the arrays below rather than rewriting the
// matching logic.
(function (global) {
  const MONTHS_PT = {
    janeiro: "01", fevereiro: "02", março: "03", marco: "03", abril: "04",
    maio: "05", junho: "06", julho: "07", agosto: "08", setembro: "09",
    outubro: "10", novembro: "11", dezembro: "12"
  };

  function normalize(text) {
    return (text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim();
  }

  // Parses "14 de agosto de 2026" or "14/08/2026" into "2026-08-14".
  function parseDatePtBR(raw) {
    if (!raw) return undefined;
    const text = raw.trim();

    const longForm = text.match(/(\d{1,2})\s+de\s+([a-zçã]+)\s+de\s+(\d{4})/i);
    if (longForm) {
      const [, day, monthName, year] = longForm;
      const month = MONTHS_PT[normalize(monthName)];
      if (month) return `${year}-${month}-${day.padStart(2, "0")}`;
    }

    const shortForm = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (shortForm) {
      const [, day, month, year] = shortForm;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    return undefined;
  }

  // Walks all text nodes looking for one of `labels`, then returns the text
  // of the nearest following sibling/element (common "label: value" or
  // "label" then "value" on the next row layout).
  function findValueByLabel(labels) {
    const normalizedLabels = labels.map(normalize);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;

    while ((node = walker.nextNode())) {
      const text = normalize(node.textContent);
      if (!text) continue;

      const matchedLabel = normalizedLabels.find((label) => text === label || text.startsWith(`${label}:`));
      if (!matchedLabel) continue;

      const container = node.parentElement;
      if (!container) continue;

      const inlineValue = node.textContent.split(":").slice(1).join(":").trim();
      if (inlineValue) return inlineValue;

      const nextEl = container.nextElementSibling;
      if (nextEl?.textContent?.trim()) return nextEl.textContent.trim();

      const parentNextEl = container.parentElement?.nextElementSibling;
      if (parentNextEl?.textContent?.trim()) return parentNextEl.textContent.trim();
    }

    return undefined;
  }

  function isOrderPage() {
    const url = location.href;
    return (
      url.includes("/vendas/") ||
      url.includes("/noindex/mvp/orders/") ||
      normalize(document.body?.innerText || "").includes("detalhe da venda")
    );
  }

  function extractOrder() {
    const numeroVenda = findValueByLabel(["numero da venda", "n de venda", "venda", "codigo da venda"]);
    const nomeCliente = findValueByLabel(["comprador", "cliente", "nome do comprador"]);
    const sku = findValueByLabel(["sku", "codigo do anuncio", "numero do anuncio"]);
    const dataCompraRaw = findValueByLabel(["data da venda", "comprado em", "data de compra", "data da compra"]);
    const produto = document.querySelector("h1")?.textContent?.trim();

    return {
      canalMarketplace: "MERCADO_LIVRE",
      nomeCliente: nomeCliente || undefined,
      numeroVenda: numeroVenda || undefined,
      produto: produto || undefined,
      sku: sku || undefined,
      dataCompra: parseDatePtBR(dataCompraRaw),
      linkPedido: location.href
    };
  }

  global.LessulML = { isOrderPage, extractOrder, parseDatePtBR };
})(self);
