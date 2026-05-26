import { AcaoAuditoria, BackupSyncStatus, Prisma, Usuario } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { registerTicketAudit } from "@/lib/audit/ticket-audit";
import { TicketFiltersInput, TicketInput } from "@/lib/validation/ticket";
import { getTicketScopeWhere, hasPermission } from "@/lib/rbac/permissions";
import { assertSlaConsistency, calculateSla } from "@/lib/utils/sla";
import { ForbiddenError } from "@/lib/errors";
import { appendTicketBackupRow, getGoogleSheetsBackupConfigError, isGoogleSheetsBackupEnabled, updateTicketBackupRow } from "@/lib/integrations/google-sheets-backup";
import { logError } from "@/lib/logger";

const sensitiveFields = ["valorReembolso", "valorColeta", "prazoConclusao", "resolucao"] as const;

function normalizeOptionalText(value?: string | null) {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function assertCanEditFields(user: Usuario, payload: Partial<TicketInput>) {
  const touchingSensitive = sensitiveFields.some((field) => payload[field] !== undefined);
  if (touchingSensitive && !hasPermission(user.perfil, "ticket.update_sensitive")) {
    throw new ForbiddenError("Seu perfil não pode editar campos sensíveis");
  }
}

function getDateRange(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return undefined;
  return {
    ...(startDate ? { gte: new Date(startDate) } : {}),
    ...(endDate ? { lte: new Date(endDate) } : {})
  };
}

function toTicketBackupRow(ticket: {
  id: string;
  nomeCliente: string;
  numeroVenda: string;
  empresa: string;
  canalMarketplace: string;
  motivo: string;
  statusTicket: string;
  statusReclamacao: string;
  valorReembolso: Prisma.Decimal;
  valorColeta: Prisma.Decimal;
  custosTotais: Prisma.Decimal;
  criadoEm: Date;
  atualizadoEm: Date;
}) {
  return {
    id: ticket.id,
    nomeCliente: ticket.nomeCliente,
    numeroVenda: ticket.numeroVenda,
    empresa: ticket.empresa,
    canalMarketplace: ticket.canalMarketplace,
    motivo: ticket.motivo,
    statusTicket: ticket.statusTicket,
    statusReclamacao: ticket.statusReclamacao,
    valorReembolso: Number(ticket.valorReembolso),
    valorColeta: Number(ticket.valorColeta),
    custosTotais: Number(ticket.custosTotais),
    criadoEm: ticket.criadoEm.toISOString(),
    atualizadoEm: ticket.atualizadoEm.toISOString()
  };
}

async function markBackupSyncFailure(ticketId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  logError("Falha ao sincronizar backup Google Sheets", { ticketId, error: message });

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      backupSyncStatus: BackupSyncStatus.FAILED,
      backupSyncError: message.slice(0, 2000)
    }
  });
}

async function syncTicketCreateBackup(ticketId: string) {
  if (!isGoogleSheetsBackupEnabled()) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        backupSyncStatus: BackupSyncStatus.FAILED,
        backupSyncError: getGoogleSheetsBackupConfigError() ?? "Integração Google Sheets não configurada"
      }
    });
    return;
  }

  try {
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    const { rowNumber } = await appendTicketBackupRow(toTicketBackupRow(ticket));
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        backupSheetRowNumber: rowNumber,
        backupSyncStatus: BackupSyncStatus.SYNCED,
        backupLastSyncedAt: new Date(),
        backupSyncError: null
      }
    });
  } catch (error) {
    await markBackupSyncFailure(ticketId, error);
  }
}

async function syncTicketUpdateBackup(ticketId: string) {
  if (!isGoogleSheetsBackupEnabled()) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        backupSyncStatus: BackupSyncStatus.FAILED,
        backupSyncError: getGoogleSheetsBackupConfigError() ?? "Integração Google Sheets não configurada"
      }
    });
    return;
  }

  try {
    const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    const { rowNumber } = await updateTicketBackupRow(toTicketBackupRow(ticket), ticket.backupSheetRowNumber);

    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        backupSheetRowNumber: rowNumber,
        backupSyncStatus: BackupSyncStatus.SYNCED,
        backupLastSyncedAt: new Date(),
        backupSyncError: null
      }
    });
  } catch (error) {
    await markBackupSyncFailure(ticketId, error);
  }
}

export async function listTickets(
  query: TicketFiltersInput,
  user: { id: string; perfil: "ATENDENTE" | "SUPERVISOR" | "ADMIN" | "LOJA"; empresaVinculada?: "LESSUL"|"MS_DECOR"|"VIVA_VIDA"|"MOVELBENTO"|"MODIFIKA"|null }
) {
  const where: Prisma.TicketWhereInput = {
    ativo: true,
    ...getTicketScopeWhere(user),
    ...(query.search
      ? {
          OR: [
            { nomeCliente: { contains: query.search, mode: "insensitive" } },
            { numeroVenda: { contains: query.search, mode: "insensitive" } },
            { canalMarketplace: { contains: query.search, mode: "insensitive" } },
            { produto: { contains: query.search, mode: "insensitive" } }
          ]
        }
      : {}),
    ...(query.sku ? { sku: { contains: query.sku, mode: "insensitive" } } : {}),
    ...(query.empresa ? { empresa: query.empresa } : {}),
    ...(query.canalMarketplace ? { canalMarketplace: query.canalMarketplace } : {}),
    ...(query.statusTicket
      ? { statusTicket: query.statusTicket }
      : (!query.includeConcluidos ? { statusTicket: { not: "CONCLUIDO" } } : {})),
    ...(query.statusReclamacao ? { statusReclamacao: query.statusReclamacao } : {}),
    ...(query.motivo ? { motivo: query.motivo } : {}),
    ...(query.responsavelId ? { responsavelId: query.responsavelId } : {}),
    ...(query.criadoPorId ? { criadoPorId: query.criadoPorId } : {}),
    ...(getDateRange(query.startDate, query.endDate) ? { dataReclamacao: getDateRange(query.startDate, query.endDate) } : {})
  };

  const [items, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: { [query.orderBy]: query.orderDir },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { criadoPor: true, atualizadoPor: true, responsavel: { select: { id: true, nome: true } } }
    }),
    prisma.ticket.count({ where })
  ]);

  return {
    data: items.map((item) => ({ ...item, slaStatus: calculateSla(item.statusTicket, item.prazoConclusao) })),
    pagination: {
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize)
    },
    meta: {
      orderBy: query.orderBy,
      orderDir: query.orderDir
    }
  };
}

export async function createTicket(input: TicketInput, userId: string) {
  const { acaoOperacionalLoja: _acaoOperacionalLoja, ...ticketInput } = input;
  const prazoConclusao = ticketInput.prazoConclusao ? new Date(ticketInput.prazoConclusao) : null;
  assertSlaConsistency(ticketInput.statusTicket, prazoConclusao);

  const ticket = await prisma.ticket.create({
    data: {
      ...ticketInput,
      dataCompra: new Date(ticketInput.dataCompra),
      dataReclamacao: new Date(ticketInput.dataReclamacao),
      mesReclamacao: new Date(ticketInput.dataReclamacao).getUTCMonth() + 1,
      anoReclamacao: new Date(ticketInput.dataReclamacao).getUTCFullYear(),
      prazoConclusao,
      valorReembolso: new Prisma.Decimal(ticketInput.valorReembolso),
      valorColeta: new Prisma.Decimal(ticketInput.valorColeta),
      custosTotais: new Prisma.Decimal(ticketInput.valorReembolso + ticketInput.valorColeta),
      criadoPorId: userId,
      atualizadoPorId: userId,
      linkPedido: normalizeOptionalText(ticketInput.linkPedido),
      fabricante: normalizeOptionalText(ticketInput.fabricante),
      transportadora: normalizeOptionalText(ticketInput.transportadora),
      detalhesCliente: normalizeOptionalText(ticketInput.detalhesCliente),
      comentarioInterno: normalizeOptionalText(ticketInput.comentarioInterno),
      responsavelId: normalizeOptionalText(ticketInput.responsavelId),
      resolucao: ticketInput.resolucao ?? null,
      slaStatus: calculateSla(ticketInput.statusTicket, prazoConclusao)
    }
  });

  const user = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
  await registerTicketAudit({ ticketId: ticket.id, user, action: "CREATE", after: ticket as unknown as Prisma.JsonObject });
  await syncTicketCreateBackup(ticket.id);
  return ticket;
}

export async function getTicketById(id: string, user: Usuario) {
  const ticket = await prisma.ticket.findFirst({
    where: { id, ativo: true, ...getTicketScopeWhere(user) },
    include: { auditoria: { orderBy: { dataHora: "desc" }, take: 100 }, responsavel: { select: { id: true, nome: true } } }
  });

  if (!ticket) throw new ForbiddenError("Ticket não encontrado ou sem acesso");
  return ticket;
}

export async function updateTicket(id: string, payload: Partial<TicketInput>, user: Usuario) {
  const { acaoOperacionalLoja: _acaoOperacionalLoja, ...ticketPayload } = payload;
  const before = await prisma.ticket.findFirstOrThrow({ where: { id, ativo: true, ...getTicketScopeWhere(user) } });
  assertCanEditFields(user, ticketPayload);

  const resolvedPrazoConclusao = ticketPayload.prazoConclusao !== undefined
    ? (ticketPayload.prazoConclusao ? new Date(ticketPayload.prazoConclusao) : null)
    : before.prazoConclusao;
  const resolvedStatusTicket = ticketPayload.statusTicket ?? before.statusTicket;
  assertSlaConsistency(resolvedStatusTicket, resolvedPrazoConclusao);

  const updated = await prisma.ticket.update({
    where: { id },
    data: {
      ...ticketPayload,
      atualizadoPorId: user.id,
      ...(ticketPayload.dataReclamacao
        ? {
            mesReclamacao: new Date(ticketPayload.dataReclamacao).getUTCMonth() + 1,
            anoReclamacao: new Date(ticketPayload.dataReclamacao).getUTCFullYear()
          }
        : {}),
      linkPedido: ticketPayload.linkPedido !== undefined ? normalizeOptionalText(ticketPayload.linkPedido) : undefined,
      fabricante: ticketPayload.fabricante !== undefined ? normalizeOptionalText(ticketPayload.fabricante) : undefined,
      transportadora: ticketPayload.transportadora !== undefined ? normalizeOptionalText(ticketPayload.transportadora) : undefined,
      detalhesCliente: ticketPayload.detalhesCliente !== undefined ? normalizeOptionalText(ticketPayload.detalhesCliente) : undefined,
      comentarioInterno: ticketPayload.comentarioInterno !== undefined ? normalizeOptionalText(ticketPayload.comentarioInterno) : undefined,
      responsavelId: ticketPayload.responsavelId !== undefined ? normalizeOptionalText(ticketPayload.responsavelId) : undefined,
      resolucao: ticketPayload.resolucao !== undefined ? (ticketPayload.resolucao ?? null) : undefined,
      prazoConclusao: resolvedPrazoConclusao,
      slaStatus: calculateSla(resolvedStatusTicket, resolvedPrazoConclusao),
      ...(ticketPayload.valorReembolso !== undefined || ticketPayload.valorColeta !== undefined
        ? {
            custosTotais: new Prisma.Decimal(
              Number(ticketPayload.valorReembolso ?? before.valorReembolso) + Number(ticketPayload.valorColeta ?? before.valorColeta)
            )
          }
        : {})
    }
  });

  const action: AcaoAuditoria = ticketPayload.statusTicket && ticketPayload.statusTicket !== before.statusTicket ? "STATUS_CHANGE" : "UPDATE";
  await registerTicketAudit({
    ticketId: id,
    user,
    action,
    before: before as unknown as Prisma.JsonObject,
    after: updated as unknown as Prisma.JsonObject
  });

  await syncTicketUpdateBackup(id);
  return updated;
}

export async function softDeleteTicket(id: string, user: Usuario) {
  const before = await prisma.ticket.findFirstOrThrow({ where: { id, ...getTicketScopeWhere(user) } });
  const updated = await prisma.ticket.update({ where: { id }, data: { ativo: false, atualizadoPorId: user.id } });

  await registerTicketAudit({
    ticketId: id,
    user,
    action: "SOFT_DELETE",
    before: before as unknown as Prisma.JsonObject,
    after: updated as unknown as Prisma.JsonObject
  });

  await syncTicketUpdateBackup(id);
  return { ok: true };
}
