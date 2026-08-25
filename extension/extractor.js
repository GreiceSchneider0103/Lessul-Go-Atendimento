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

  function todayIsoDate() {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  const UF_CODES = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
    "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
  ];

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

  function findBuyerLine(lines) {
    return lines.find((line) => /\b(CNPJ|CPF)\b/i.test(line));
  }

  // The buyer card has no "Comprador:" label — it's rendered as the name on
  // one line, followed by "<cidade> | CPF/CNPJ ... | ..." on the next.
  function extractNomeCliente(lines) {
    const buyerLineIndex = lines.findIndex((line) => /\b(CNPJ|CPF)\b/i.test(line));
    if (buyerLineIndex <= 0) return undefined;

    const candidate = lines[buyerLineIndex - 1];
    return candidate && candidate.length <= 120 ? candidate : undefined;
  }

  // Same buyer line as nomeCliente ("... | CNPJ 00522849000125 | Negócio" or
  // "... | CPF 000.000.000-00 | ..."); pulls just the digits.
  function extractDocumento(lines) {
    const buyerLine = findBuyerLine(lines);
    if (!buyerLine) return undefined;

    const match = buyerLine.match(/(?:CNPJ|CPF)\s*([\d.\/-]{11,18})/i);
    return match ? match[1].replace(/\D/g, "") : undefined;
  }

  // Best-effort only: looks for a valid UF code in the text surrounding the
  // shipping address' "CEP" mention (e.g. "Cidade - UF - CEP 12345-678").
  // Review this field before saving the ticket — false positives are
  // possible if another two-letter code appears near "CEP" on the page.
  function extractUf(fullText) {
    const cepIndex = fullText.search(/CEP/i);
    if (cepIndex === -1) return undefined;

    const window = fullText.slice(Math.max(0, cepIndex - 80), cepIndex + 80);
    const candidates = window.match(/\b[A-Z]{2}\b/g) || [];
    return candidates.find((code) => UF_CODES.includes(code));
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
      dataReclamacao: todayIsoDate(),
      cpf: extractDocumento(lines),
      uf: extractUf(fullText),
      linkPedido: location.href
    };
  }

  global.LessulML = { isOrderPage, extractOrder, parseDatePtBR };
})(self);
