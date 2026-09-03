import { Empresa, Perfil, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getTicketScopeWhere } from "@/lib/rbac/permissions";
import { type TicketFiltersInput } from "@/lib/validation/ticket";
import { getDevolucoesInternasRecuperadoTotal } from "@/lib/services/devolucoes-internas-service";

type DashboardFilters = Partial<Pick<TicketFiltersInput, "empresa" | "canalMarketplace" | "statusTicket" | "statusReclamacao" | "motivo" | "sku" | "startDate" | "endDate">>;

/**
 * DevolucaoInterna is Lessul-only and isn't attributed to any particular
 * attendant's tickets, so it only makes sense to fold its recovered total
 * into the dashboard/reports "Valor recuperado" card for views that already
 * show a company-wide (or Lessul-scoped) picture — not an ATENDENTE's
 * own-tickets-only view, and not when a company filter excludes Lessul.
 */
export function shouldIncludeDevolucoesInternas(
  filters: { empresa?: Empresa },
  user: { perfil: Perfil; empresasVinculadas?: Empresa[] }
) {
  if (user.perfil === "ATENDENTE") return false;
  if (filters.empresa && filters.empresa !== "LESSUL") return false;
  if (user.perfil === "LOJA") return Boolean(user.empresasVinculadas?.includes("LESSUL"));
  return true;
}

function getDateRange(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return undefined;
  return {
    ...(startDate ? { gte: new Date(startDate) } : {}),
    ...(endDate ? { lte: new Date(endDate) } : {})
  };
}

export async function getDashboardData(filters: DashboardFilters, user: { id: string; perfil: Perfil; empresasVinculadas?: Empresa[] }) {
  const dateRange = getDateRange(filters.startDate, filters.endDate);

  const baseWhere: Prisma.TicketWhereInput = {
    ativo: true,
    AND: [getTicketScopeWhere(user)],
    ...(filters.empresa ? { empresa: filters.empresa } : {}),
    ...(filters.canalMarketplace ? { canalMarketplace: filters.canalMarketplace } : {}),
    ...(filters.statusTicket ? { statusTicket: filters.statusTicket } : {}),
    ...(filters.statusReclamacao ? { statusReclamacao: filters.statusReclamacao } : {}),
    ...(filters.motivo ? { motivo: filters.motivo } : {}),
    ...(filters.sku ? { sku: { contains: filters.sku, mode: "insensitive" } } : {})
  };

  const where: Prisma.TicketWhereInput = {
    ...baseWhere,
    ...(dateRange ? { dataReclamacao: dateRange } : {})
  };

  const custoWhere: Prisma.TicketWhereInput = {
    ...baseWhere,
    OR: [
      {
        statusTicket: { not: "CONCLUIDO" },
        ...(dateRange ? { dataReclamacao: dateRange } : {})
      },
      {
        statusTicket: "CONCLUIDO",
        concluidoEm: { not: null },
        ...(dateRange ? { concluidoEm: dateRange } : {})
      },
      {
        statusTicket: "CONCLUIDO",
        concluidoEm: null,
        ...(dateRange ? { dataReclamacao: dateRange } : {})
      }
    ]
  };

  const [
    total,
    abertos,
    atrasados,
    custoAgregado,
    reembolsoAgregado,
    coletaAgregado,
    recuperadoAgregado,
    porEmpresa,
    porMotivo,
    porStatus,
    porMarketplace,
    custosPorMarketplace,
    custosPorProduto,
    reembolsosPorEmpresa,
    ticketsPorMes,
    ticketsPorSkuRaw,
    custosBySkuRaw,
    motivosPorSkuRaw,
    devolucoesInternasRecuperado
  ] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.count({ where: { ...where, statusTicket: { not: "CONCLUIDO" } } }),
    prisma.ticket.count({ where: { ...where, statusTicket: { not: "CONCLUIDO" }, prazoConclusao: { lt: new Date() } } }),
    prisma.ticket.aggregate({ _sum: { custosTotais: true }, where: custoWhere }),
    prisma.ticket.aggregate({ _sum: { valorReembolso: true }, where }),
    prisma.ticket.aggregate({ _sum: { valorColetaEnvioPecas: true }, where }),
    prisma.ticket.aggregate({ _sum: { valorRecuperado: true }, where }),
    prisma.ticket.groupBy({ by: ["empresa"], where, _count: true }),
    prisma.ticket.groupBy({ by: ["motivo"], where, _count: true }),
    prisma.ticket.groupBy({ by: ["statusTicket"], where, _count: true }),
    prisma.ticket.groupBy({ by: ["canalMarketplace"], where, _count: true }),
    prisma.ticket.groupBy({ by: ["canalMarketplace"], where: custoWhere, _sum: { custosTotais: true } }),
    prisma.ticket.groupBy({ by: ["produto"], where: custoWhere, _sum: { custosTotais: true } }),
    prisma.ticket.groupBy({ by: ["empresa"], where, _sum: { valorReembolso: true } }),
    prisma.ticket.groupBy({ by: ["anoReclamacao", "mesReclamacao"], where, _count: true }),
    prisma.ticket.groupBy({ by: ["sku"], where, _count: true }),
    prisma.ticket.groupBy({ by: ["sku"], where: custoWhere, _sum: { custosTotais: true } }),
    prisma.ticket.groupBy({ by: ["sku", "motivo"], where, _count: true }),
    shouldIncludeDevolucoesInternas(filters, user)
      ? getDevolucoesInternasRecuperadoTotal(filters.startDate, filters.endDate)
      : Promise.resolve(0)
  ]);

  const custosBySkuMap = (custosBySkuRaw as any[]).reduce<Record<string, number>>((acc, row) => {
    acc[String(row.sku)] = Number(row?._sum?.custosTotais ?? 0);
    return acc;
  }, {});

  const ticketsPorSku = ticketsPorSkuRaw
    .map((item: any) => ({
      name: item.sku,
      tickets: Number(item?._count?._all ?? item?._count ?? 0),
      custo: custosBySkuMap[String(item.sku)] ?? 0,
      abertos: 0,
      concluidos: 0,
      atrasados: 0,
      incidencia: 0,
      motivoTop: "-"
    }))
    .sort((a, b) => b.tickets - a.tickets);

  const totalTicketsSku = ticketsPorSku.reduce((acc, item) => acc + item.tickets, 0);
  const motivosTopPorSku = motivosPorSkuRaw.reduce<Record<string, { motivo: string; total: number }>>((acc, item: any) => {
    const sku = String(item.sku);
    const total = Number(item?._count?._all ?? item?._count ?? 0);
    if (!acc[sku] || acc[sku].total < total) acc[sku] = { motivo: item.motivo, total };
    return acc;
  }, {});

  const [abertosPorSku, concluidosPorSku, atrasadosPorSku] = await Promise.all([
    prisma.ticket.groupBy({ by: ["sku"], where: { ...where, statusTicket: { not: "CONCLUIDO" } }, _count: true }),
    prisma.ticket.groupBy({ by: ["sku"], where: { ...where, statusTicket: "CONCLUIDO" }, _count: true }),
    prisma.ticket.groupBy({ by: ["sku"], where: { ...where, statusTicket: { not: "CONCLUIDO" }, prazoConclusao: { lt: new Date() } }, _count: true })
  ]);

  const mapCountBySku = (rows: Array<any>) =>
    rows.reduce<Record<string, number>>((acc, row) => {
      acc[String(row.sku)] = Number(row?._count?._all ?? row?._count ?? 0);
      return acc;
    }, {});

  const abertosMap = mapCountBySku(abertosPorSku);
  const concluidosMap = mapCountBySku(concluidosPorSku);
  const atrasadosMap = mapCountBySku(atrasadosPorSku);
  const ticketsPorSkuEnriched = ticketsPorSku.map((item) => ({
    ...item,
    abertos: abertosMap[item.name] ?? 0,
    concluidos: concluidosMap[item.name] ?? 0,
    atrasados: atrasadosMap[item.name] ?? 0,
    incidencia: totalTicketsSku ? Number((((item.tickets / totalTicketsSku) * 100)).toFixed(2)) : 0,
    motivoTop: motivosTopPorSku[item.name]?.motivo ?? "-"
  }));

  return {
    cards: {
      totalTickets: total,
      ticketsAbertos: abertos,
      ticketsAtrasados: atrasados,
      custoTotal: Number((custoAgregado as any)?._sum?.custosTotais ?? 0),
      reembolsoTotal: Number((reembolsoAgregado as any)?._sum?.valorReembolso ?? 0),
      coletaTotal: Number((coletaAgregado as any)?._sum?.valorColetaEnvioPecas ?? 0),
      recuperadoTotal: Number((recuperadoAgregado as any)?._sum?.valorRecuperado ?? 0) + devolucoesInternasRecuperado
    },
    charts: {
      porEmpresa: porEmpresa.map((item: any) => ({ name: item.empresa, value: Number(item?._count?._all ?? item?._count ?? 0) })),
      porMotivo: porMotivo.map((item: any) => ({ name: item.motivo, value: Number(item?._count?._all ?? item?._count ?? 0) })),
      porStatus: porStatus.map((item: any) => ({ name: item.statusTicket, value: Number(item?._count?._all ?? item?._count ?? 0) })),
      porMarketplace: porMarketplace.map((item: any) => ({ name: item.canalMarketplace, value: Number(item?._count?._all ?? item?._count ?? 0) })),
      custosPorMarketplace: custosPorMarketplace.map((item: any) => ({ name: item.canalMarketplace, value: Number(item?._sum?.custosTotais ?? 0) })),
      custosPorProduto: custosPorProduto.map((item: any) => ({ name: item.produto, value: Number(item?._sum?.custosTotais ?? 0) })),
      reembolsosPorEmpresa: reembolsosPorEmpresa.map((item: any) => ({ name: item.empresa, value: Number(item?._sum?.valorReembolso ?? 0) })),
      ticketsPorSku: ticketsPorSkuEnriched.map((item) => ({ name: item.name, value: item.tickets })),
      ticketsPorMes: ticketsPorMes
        .map((item: any) => ({ name: `${item.anoReclamacao}-${String(item.mesReclamacao).padStart(2, "0")}`, value: Number(item?._count?._all ?? item?._count ?? 0) }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },
    skuMetrics: ticketsPorSkuEnriched.slice(0, 20)
  };
}
