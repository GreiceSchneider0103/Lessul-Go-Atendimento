import { Perfil, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getTicketScopeWhere } from "@/lib/rbac/permissions";
import { type TicketFiltersInput } from "@/lib/validation/ticket";

type DashboardFilters = Partial<Pick<TicketFiltersInput, "empresa" | "canalMarketplace" | "statusTicket" | "statusReclamacao" | "motivo" | "sku" | "startDate" | "endDate">>;

function getDateRange(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return undefined;
  return {
    ...(startDate ? { gte: new Date(startDate) } : {}),
    ...(endDate ? { lte: new Date(endDate) } : {})
  };
}

export async function getDashboardData(filters: DashboardFilters, user: { id: string; perfil: Perfil }) {
  const where: Prisma.TicketWhereInput = {
    ativo: true,
    ...getTicketScopeWhere(user),
    ...(filters.empresa ? { empresa: filters.empresa } : {}),
    ...(filters.canalMarketplace ? { canalMarketplace: filters.canalMarketplace } : {}),
    ...(filters.statusTicket ? { statusTicket: filters.statusTicket } : {}),
    ...(filters.statusReclamacao ? { statusReclamacao: filters.statusReclamacao } : {}),
    ...(filters.motivo ? { motivo: filters.motivo } : {}),
    ...(filters.sku ? { sku: { contains: filters.sku, mode: "insensitive" } } : {}),
    ...(getDateRange(filters.startDate, filters.endDate) ? { dataReclamacao: getDateRange(filters.startDate, filters.endDate) } : {})
  };

  const [total, abertos, atrasados, agregados, porEmpresa, porMotivo, porStatus, porMarketplace, custosPorMarketplace, custosPorProduto, reembolsosPorEmpresa, ticketsPorMes, ticketsPorSkuRaw, motivosPorSkuRaw] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.count({ where: { ...where, statusTicket: { not: "CONCLUIDO" } } }),
    prisma.ticket.count({ where: { ...where, statusTicket: { not: "CONCLUIDO" }, prazoConclusao: { lt: new Date() } } }),
    prisma.ticket.aggregate({ _sum: { custosTotais: true, valorReembolso: true, valorColeta: true }, where }),
    prisma.ticket.groupBy({ by: ["empresa"], where, _count: true }),
    prisma.ticket.groupBy({ by: ["motivo"], where, _count: true }),
    prisma.ticket.groupBy({ by: ["statusTicket"], where, _count: true }),
    prisma.ticket.groupBy({ by: ["canalMarketplace"], where, _count: true }),
    prisma.ticket.groupBy({ by: ["canalMarketplace"], where, _sum: { custosTotais: true } }),
    prisma.ticket.groupBy({ by: ["produto"], where, _sum: { custosTotais: true } }),
    prisma.ticket.groupBy({ by: ["empresa"], where, _sum: { valorReembolso: true } }),
    prisma.ticket.groupBy({ by: ["anoReclamacao", "mesReclamacao"], where, _count: true }),
    prisma.ticket.groupBy({
      by: ["sku"],
      where,
      _count: true,
      _sum: { custosTotais: true }
    }),
    prisma.ticket.groupBy({
      by: ["sku", "motivo"],
      where,
      _count: true
    })
  ]);

  const ticketsPorSku = ticketsPorSkuRaw
    .map((item: any) => ({
      name: item.sku,
      tickets: Number(item?._count?._all ?? item?._count ?? 0),
      custo: Number(item?._sum?.custosTotais ?? 0),
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
      custoTotal: Number((agregados as any)?._sum?.custosTotais ?? 0),
      reembolsoTotal: Number((agregados as any)?._sum?.valorReembolso ?? 0),
      coletaTotal: Number((agregados as any)?._sum?.valorColeta ?? 0)
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
