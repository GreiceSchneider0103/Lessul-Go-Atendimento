import { Perfil, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getTicketScopeWhere } from "@/lib/rbac/permissions";
import { type TicketFiltersInput } from "@/lib/validation/ticket";

type ReportFilters = Partial<Pick<TicketFiltersInput, "empresa" | "canalMarketplace" | "statusTicket" | "statusReclamacao" | "motivo" | "responsavelId" | "sku" | "startDate" | "endDate">>;

function getDateRange(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return undefined;
  return {
    ...(startDate ? { gte: new Date(startDate) } : {}),
    ...(endDate ? { lte: new Date(endDate) } : {})
  };
}

function sumBy(rows: Array<{ _sum?: { custosTotais?: unknown } | null }>, key: (row: any) => string) {
  return rows.map((row: any) => ({ name: key(row), custo: Number(row?._sum?.custosTotais ?? 0) }));
}

export async function getReportsData(filters: ReportFilters, user: { id: string; perfil: Perfil }) {
  const dateRange = getDateRange(filters.startDate, filters.endDate);

  const baseWhere: Prisma.TicketWhereInput = {
    ativo: true,
    AND: [getTicketScopeWhere(user)],
    ...(filters.empresa ? { empresa: filters.empresa } : {}),
    ...(filters.canalMarketplace ? { canalMarketplace: filters.canalMarketplace } : {}),
    ...(filters.statusTicket ? { statusTicket: filters.statusTicket } : {}),
    ...(filters.statusReclamacao ? { statusReclamacao: filters.statusReclamacao } : {}),
    ...(filters.motivo ? { motivo: filters.motivo } : {}),
    ...(filters.responsavelId ? { responsavelId: filters.responsavelId } : {}),
    ...(filters.sku ? { sku: { contains: filters.sku, mode: "insensitive" } } : {})
  };

  const where: Prisma.TicketWhereInput = {
    ...baseWhere,
    ...(dateRange ? { dataReclamacao: dateRange } : {})
  };

  // Mirrors the dashboard's cost logic: an open ticket's cost counts toward
  // the period it was reported in, but a closed ticket's cost counts toward
  // the period it was closed in (falling back to dataReclamacao for legacy
  // tickets closed before concluidoEm existed).
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

  const limit = 500;
  const [items, totals, custoAgregado, custosPorMarketplace, custosPorEmpresa, custosPorMotivo, custosPorSku] = await Promise.all([
    prisma.ticket.findMany({ where, orderBy: { criadoEm: "desc" }, take: limit }),
    prisma.ticket.aggregate({
      where,
      _sum: { valorColetaEnvioPecas: true, valorReembolso: true, valorRecuperado: true },
      _count: { _all: true }
    }),
    prisma.ticket.aggregate({ where: custoWhere, _sum: { custosTotais: true } }),
    prisma.ticket.groupBy({ by: ["canalMarketplace"], where: custoWhere, _sum: { custosTotais: true } }),
    prisma.ticket.groupBy({ by: ["empresa"], where: custoWhere, _sum: { custosTotais: true } }),
    prisma.ticket.groupBy({ by: ["motivo"], where: custoWhere, _sum: { custosTotais: true } }),
    prisma.ticket.groupBy({ by: ["sku"], where: custoWhere, _sum: { custosTotais: true } })
  ]);

  const totalCount = Number((totals as any)?._count?._all ?? 0);
  return {
    items,
    totals: {
      totalTickets: totalCount,
      totalCustos: Number((custoAgregado as any)?._sum?.custosTotais ?? 0),
      totalReembolso: Number((totals as any)?._sum?.valorReembolso ?? 0),
      totalColeta: Number((totals as any)?._sum?.valorColetaEnvioPecas ?? 0),
      totalRecuperado: Number((totals as any)?._sum?.valorRecuperado ?? 0)
    },
    breakdowns: {
      porMarketplace: sumBy(custosPorMarketplace, (row) => row.canalMarketplace),
      porEmpresa: sumBy(custosPorEmpresa, (row) => row.empresa),
      porMotivo: sumBy(custosPorMotivo, (row) => row.motivo),
      porSku: sumBy(custosPorSku, (row) => row.sku)
    },
    meta: {
      limit,
      returned: items.length,
      totalAvailable: totalCount,
      truncated: totalCount > items.length
    }
  };
}
