import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { DevolucaoInternaFiltersInput, DevolucaoInternaInput } from "@/lib/validation/devolucao-interna";

function toDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildDateRangeWhere(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return undefined;
  return {
    ...(startDate ? { gte: new Date(startDate) } : {}),
    ...(endDate ? { lte: new Date(endDate) } : {})
  };
}

export function getDevolucoesInternasWhere(filters: DevolucaoInternaFiltersInput): Prisma.DevolucaoInternaWhereInput {
  const dateRange = buildDateRangeWhere(filters.startDate, filters.endDate);

  return {
    ...(filters.canalMarketplace ? { canalMarketplace: filters.canalMarketplace } : {}),
    ...(filters.defeito ? { defeito: filters.defeito } : {}),
    ...(filters.solucao ? { solucao: filters.solucao } : {}),
    ...(dateRange ? { dataRecebimento: dateRange } : {})
  };
}

export async function listDevolucoesInternas(filters: DevolucaoInternaFiltersInput) {
  return prisma.devolucaoInterna.findMany({
    where: getDevolucoesInternasWhere(filters),
    include: {
      criadoPor: { select: { id: true, nome: true } },
      atualizadoPor: { select: { id: true, nome: true } }
    },
    orderBy: { numero: "desc" }
  });
}

export async function getDevolucaoInternaById(id: string) {
  const item = await prisma.devolucaoInterna.findUnique({
    where: { id },
    include: {
      criadoPor: { select: { id: true, nome: true } },
      atualizadoPor: { select: { id: true, nome: true } }
    }
  });

  if (!item) throw new AppError("Registro não encontrado", 404, "NOT_FOUND");
  return item;
}

export async function createDevolucaoInterna(input: DevolucaoInternaInput, userId: string) {
  return prisma.devolucaoInterna.create({
    data: {
      codigoVenda: input.codigoVenda,
      cliente: input.cliente,
      canalMarketplace: input.canalMarketplace,
      produto: input.produto,
      sku: input.sku || null,
      defeito: input.defeito,
      dataRecebimento: toDate(input.dataRecebimento),
      dataRevisao: toDate(input.dataRevisao),
      solucao: input.solucao || null,
      solicitadoReembolso: input.solicitadoReembolso,
      valorRecuperado: new Prisma.Decimal(input.valorRecuperado),
      observacao: input.observacao || null,
      criadoPorId: userId,
      atualizadoPorId: userId
    }
  });
}

export async function updateDevolucaoInterna(id: string, input: Partial<DevolucaoInternaInput>, userId: string) {
  const existing = await prisma.devolucaoInterna.findUnique({ where: { id } });
  if (!existing) throw new AppError("Registro não encontrado", 404, "NOT_FOUND");

  return prisma.devolucaoInterna.update({
    where: { id },
    data: {
      ...(input.codigoVenda !== undefined ? { codigoVenda: input.codigoVenda } : {}),
      ...(input.cliente !== undefined ? { cliente: input.cliente } : {}),
      ...(input.canalMarketplace !== undefined ? { canalMarketplace: input.canalMarketplace } : {}),
      ...(input.produto !== undefined ? { produto: input.produto } : {}),
      ...(input.sku !== undefined ? { sku: input.sku || null } : {}),
      ...(input.defeito !== undefined ? { defeito: input.defeito } : {}),
      ...(input.dataRecebimento !== undefined ? { dataRecebimento: toDate(input.dataRecebimento) } : {}),
      ...(input.dataRevisao !== undefined ? { dataRevisao: toDate(input.dataRevisao) } : {}),
      ...(input.solucao !== undefined ? { solucao: input.solucao || null } : {}),
      ...(input.solicitadoReembolso !== undefined ? { solicitadoReembolso: input.solicitadoReembolso } : {}),
      ...(input.valorRecuperado !== undefined ? { valorRecuperado: new Prisma.Decimal(input.valorRecuperado) } : {}),
      ...(input.observacao !== undefined ? { observacao: input.observacao || null } : {}),
      atualizadoPorId: userId
    }
  });
}

export async function deleteDevolucaoInterna(id: string) {
  const existing = await prisma.devolucaoInterna.findUnique({ where: { id } });
  if (!existing) throw new AppError("Registro não encontrado", 404, "NOT_FOUND");

  await prisma.devolucaoInterna.delete({ where: { id } });
  return { ok: true };
}

/**
 * Sum of DevolucaoInterna.valorRecuperado for a date range — the single
 * place dashboard-service and reports-service pull from to fold these
 * Lessul-only recoveries into "Valor recuperado de marketplaces" alongside
 * Ticket.valorRecuperado.
 */
export async function getDevolucoesInternasRecuperadoTotal(startDate?: string, endDate?: string) {
  const dateRange = buildDateRangeWhere(startDate, endDate);

  const result = await prisma.devolucaoInterna.aggregate({
    where: dateRange ? { dataRecebimento: dateRange } : {},
    _sum: { valorRecuperado: true }
  });

  return Number(result._sum.valorRecuperado ?? 0);
}
