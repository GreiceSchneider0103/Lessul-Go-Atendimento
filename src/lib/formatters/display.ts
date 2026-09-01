const LABEL_MAP: Record<string, string> = {
  MERCADO_LIVRE: "Mercado Livre",
  MAGALU: "Magalu",
  AMAZON: "Amazon",
  SHOPEE: "Shopee",
  SITE_PROPRIO: "Site próprio",
  OUTRO: "Outro",
  AGUARDANDO_CLIENTE: "Aguardando cliente",
  AGUARDANDO_DEVOLUCAO: "Aguardando devolução",
  AGUARDANDO_ASSISTENCIA: "Aguardando assistência",
  AGUARDANDO_MARKETPLACE: "Aguardando marketplace",
  NAO_AFETANDO: "Não afetando",
  DEFEITO_FABRICACAO: "Defeito de fabricação",
  PRODUTO_INCORRETO: "Produto incorreto",
  FALTANDO_ITENS: "Faltando itens",
  PRODUTO_DANIFICADO: "Produto danificado",
  NO_PRAZO: "No prazo",
  PROXIMO_VENCIMENTO: "Próximo do vencimento",
  ATRASADO: "Atrasado",
  NENHUMA: "Nenhuma",
  ASSISTENCIA: "Assistência",
  COLETA: "Coleta",
  DEVOLUCAO: "Devolução",
  REEMBOLSO: "Reembolso",
  RESOLVIDO: "Resolvido",
  CONCLUIDO: "Concluído",
  ABERTO: "Aberto",
  EM_ABERTO: "Em aberto",
  ENVIAR_ASSISTENCIA: "Enviar assistência",
  ASSISTENCIA_ENVIADA: "Assistência enviada",
  COLETAR: "Coletar",
  COLETA_SOLICITADA: "Coleta solicitada",
  COLETA_FEITA: "Coleta feita",
  DEVOLUCAO_RECEBIDA: "Devolução recebida aguardando cobrança",
  REEMBOLSO_PENDENTE: "Reembolsar",
  REEMBOLSO_REALIZADO: "Reembolso feito",
  AGUARDANDO_ATENDENTE: "Aguardando informações",
  CONCLUIDA: "Concluído",
  AFETANDO: "Afetando",
  REMOVIDA: "Removida",
  MASTER: "Master",
  DESISTENCIA: "Desistência",
  PROBLEMA: "Problema",
  LESSUL: "Lessul",
  MS_DECOR: "MS Decor",
  VIVA_VIDA: "Viva Vida",
  MOVELBENTO: "Movelbento",
  MODIFIKA: "Modifika",
  CREATE: "Criação",
  UPDATE: "Atualização",
  STATUS_CHANGE: "Alteração de status",
  SOFT_DELETE: "Exclusão lógica",
  ticket: "Ticket",
  nomeCliente: "Nome do cliente",
  dataCompra: "Data da compra",
  numeroVenda: "Número da venda",
  linkPedido: "Link do pedido",
  uf: "UF",
  cpf: "CPF",
  canalMarketplace: "Canal / Marketplace",
  empresa: "Empresa",
  produto: "Produto",
  sku: "SKU",
  fabricante: "Fabricante",
  transportadora: "Transportadora",
  statusReclamacao: "Status da reclamação",
  dataReclamacao: "Data da reclamação",
  motivo: "Motivo",
  detalhesCliente: "Detalhes do cliente",
  comentarioInterno: "Comentário interno",
  resolucao: "Resolução",
  valorReembolso: "Valor de reembolso",
  valorColeta: "Valor de coleta (legado)",
  valorColetaEnvioPecas: "Valor de coleta, envio ou peças",
  valorAssistencia: "Valor de envio assistência",
  valorRecuperado: "Valor recuperado do marketplace",
  custosTotais: "Custos totais",
  statusTicket: "Status do ticket",
  prazoConclusao: "Prazo de conclusão",
  concluidoEm: "Concluído em",
  responsavelId: "Responsável",
  slaStatus: "SLA",
  acaoOperacionalLoja: "Ação operacional da loja",
  statusOperacionalLoja: "Status operacional da loja",
  comentarioLoja: "Comentário da loja",
  codigoRastreio: "Código de rastreio",
  GERAL: "Geral",
  ALTERACAO: "Alteração",
  DUVIDA: "Dúvida",
  EM_ANDAMENTO: "Em andamento",
  AGUARDANDO_LOJA: "Aguardando loja",
  IMAGEM: "Imagem",
  PDF: "PDF"
};

export function formatEnumLabel(value?: string | null): string {
  if (!value) return "-";
  const key = String(value).trim();
  if (!key) return "-";
  if (LABEL_MAP[key]) return LABEL_MAP[key];
  return key
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/(^|\s)\p{L}/gu, (char) => char.toUpperCase());
}

export function formatDateBR(value?: string | Date | null): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

export function formatDateTimeBR(value?: string | Date | null): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

export function formatCurrencyBR(value?: number | string | null): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(amount) ? amount : 0);
}
