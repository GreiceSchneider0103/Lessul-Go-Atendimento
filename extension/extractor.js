// Extraction logic for Mercado Livre seller order pages
// (vendedores.mercadolivre.com.br/vendas/<id>/detalhe).
//
// Tuned against a real logged-in seller page (screenshot-verified): the sale
// number lives in the URL, not a labeled field; the buyer name has no
// "Comprador:" label, it's the line right above the CNPJ/CPF line; the SKU
// appears inline as "SKU 12345" (no colon); and the sale date is often shown
// without a year ("25 de agosto"). If Mercado Livre changes this layout,
// this is the one file that needs adjusting.
(function (global) {
  const MONTHS_PT = {
    janeiro: "01", jan: "01",
    fevereiro: "02", fev: "02",
    marco: "03", mar: "03",
    abril: "04", abr: "04",
    maio: "05", mai: "05",
    junho: "06", jun: "06",
    julho: "07", jul: "07",
    agosto: "08", ago: "08",
    setembro: "09", set: "09",
    outubro: "10", out: "10",
    novembro: "11", nov: "11",
    dezembro: "12", dez: "12"
  };

  function normalize(text) {
    return (text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim();
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  // Mercado Livre often omits the year for recent sales ("25 de agosto").
  // Assume the current year, unless that would place the sale in the
  // future, in which case it must have been the previous year.
  function resolveYear(day, month) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const candidate = new Date(`${currentYear}-${month}-${pad(day)}T00:00:00`);
    const oneDayMs = 24 * 60 * 60 * 1000;
    return candidate.getTime() - now.getTime() > oneDayMs ? currentYear - 1 : currentYear;
  }

  function parseDatePtBR(raw) {
    if (!raw) return undefined;
    const text = raw.trim();

    const longForm = text.match(/(\d{1,2})\s+de\s+([a-zçã]+)(?:\s+de\s+(\d{4}))?/i);
    if (longForm) {
      const [, day, monthName, year] = longForm;
      const month = MONTHS_PT[normalize(monthName)];
      if (month) return `${year || resolveYear(day, month)}-${month}-${pad(day)}`;
    }

    const shortForm = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (shortForm) {
      const [, day, month, year] = shortForm;
      return `${year}-${pad(month)}-${pad(day)}`;
    }

    return undefined;
  }

  function extractNumeroVenda(fullText) {
    const fromUrl = location.pathname.match(/\/vendas\/(\d+)/);
    if (fromUrl) return fromUrl[1];

    const fromText = fullText.match(/venda\s*#\s*(\d+)/i);
    return fromText ? fromText[1] : undefined;
  }

  function extractSku(fullText) {
    const match = fullText.match(/SKU[:\s]+([A-Za-z0-9._-]{3,})/i);
    return match ? match[1] : undefined;
  }

  function extractDataCompra(fullText) {
    const match = fullText.match(/(\d{1,2}\s+de\s+[a-zçã]+(?:\s+de\s+\d{4})?)/i);
    return match ? parseDatePtBR(match[1]) : undefined;
  }

  // The buyer card has no "Comprador:" label — it's rendered as the name on
  // one line, followed by "<cidade> | CPF/CNPJ ... | ..." on the next.
  function extractNomeCliente(lines) {
    const buyerLineIndex = lines.findIndex((line) => /\b(CNPJ|CPF)\b/i.test(line));
    if (buyerLineIndex <= 0) return undefined;

    const candidate = lines[buyerLineIndex - 1];
    return candidate && candidate.length <= 120 ? candidate : undefined;
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
    const fullText = document.body.innerText || "";
    const lines = fullText.split("\n").map((line) => line.trim()).filter(Boolean);
    const produto = document.querySelector("h1")?.textContent?.trim();

    return {
      canalMarketplace: "MERCADO_LIVRE",
      nomeCliente: extractNomeCliente(lines) || undefined,
      numeroVenda: extractNumeroVenda(fullText) || undefined,
      produto: produto || undefined,
      sku: extractSku(fullText) || undefined,
      dataCompra: extractDataCompra(fullText),
      linkPedido: location.href
    };
  }

  global.LessulML = { isOrderPage, extractOrder, parseDatePtBR };
})(self);
