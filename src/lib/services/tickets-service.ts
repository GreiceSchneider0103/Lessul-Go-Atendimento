import { BackupSyncStatus, Prisma, Usuario } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { registerTicketAudit } from "@/lib/audit/ticket-audit";
import { TicketFiltersInput, TicketInput } from "@/lib/validation/ticket";
import { getTicketScopeWhere, hasPermission } from "@/lib/rbac/permissions";
import { assertSlaConsistency, calculateSla } from "@/lib/utils/sla";
import { AppError, ForbiddenError } from "@/lib/errors";
import { appendTicketBackupRow, getGoogleSheetsBackupConfigError, isGoogleSheetsBackupEnabled, updateTicketBackupRow } from "@/lib/integrations/google-sheets-backup";
import { logError } from "@/lib/logger";
import { createSupabaseRouteClient } from "@/lib/supabase/server";

const sensitiveFields = ["valorColeta", "prazoConclusao", "resolucao"] as const;

function normalizeOptionalText(value?: string | null) {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function assertCanEditFields(user: Usuario, payload: Partial<TicketInput>) {
  if (user.perfil === "LOJA") {
    const forbidden = ["valorColeta", "prazoConclusao", "resolucao"] as const;
    if (forbidden.some((field) => payload[field] !== undefined)) {
      throw new ForbiddenError("Perfil LOJA não pode editar campos administrativos");
    }
    if ((payload as any).statusOperacionalLoja === "CONCLUIDA") {
      throw new ForbiddenError("LOJA não pode concluir operação");
    }
    return;
  }

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
  const prazoConclusao = input.prazoConclusao ? new Date(input.prazoConclusao) : null;
  assertSlaConsistency(input.statusTicket, prazoConclusao);

  const valorReembolso = Number(input.valorReembolso ?? 0);
  const valorColeta = Number(input.valorColeta ?? 0);
  const valorAssistencia = Number((input as any).valorAssistencia ?? 0);
  const valorColetaEnvioPecas = Number((input as any).valorColetaEnvioPecas ?? 0);
  const custosTotais = valorReembolso + valorColeta + valorAssistencia + valorColetaEnvioPecas;

  const ticket = await prisma.ticket.create({
    data: {
      ...input,
      dataCompra: new Date(input.dataCompra),
      dataReclamacao: new Date(input.dataReclamacao),
      mesReclamacao: new Date(input.dataReclamacao).getUTCMonth() + 1,
      anoReclamacao: new Date(input.dataReclamacao).getUTCFullYear(),
      prazoConclusao,
      valorReembolso: new Prisma.Decimal(valorReembolso),
      valorColeta: new Prisma.Decimal(valorColeta),
      valorAssistencia: new Prisma.Decimal(valorAssistencia),
      valorColetaEnvioPecas: new Prisma.Decimal(valorColetaEnvioPecas),
      custosTotais: new Prisma.Decimal(custosTotais),
      acaoOperacionalLoja: input.acaoOperacionalLoja ?? "NENHUMA",
      statusOperacionalLoja: (input as any).statusOperacionalLoja ?? "EM_ABERTO",
      codigoRastreio: (input as any).codigoRastreio || null,
      comentarioLoja: normalizeOptionalText(input.comentarioLoja),
      criadoPorId: userId,
      atualizadoPorId: userId,
      linkPedido: normalizeOptionalText(input.linkPedido),
      fabricante: normalizeOptionalText(input.fabricante),
      transportadora: normalizeOptionalText(input.transportadora),
      detalhesCliente: normalizeOptionalText(input.detalhesCliente),
      comentarioInterno: normalizeOptionalText(input.comentarioInterno),
      responsavelId: normalizeOptionalText(input.responsavelId),
      resolucao: input.resolucao ?? null,
      slaStatus: calculateSla(input.statusTicket, prazoConclusao)
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
    include: { auditoria: { orderBy: { dataHora: "desc" }, take: 100 }, responsavel: { select: { id: true, nome: true } }, comentariosOperacionais: { orderBy: { criadoEm: "desc" } } }
  });

  if (!ticket) throw new ForbiddenError("Ticket não encontrado ou sem acesso");
  return ticket;
}

export async function updateTicket(id: string, payload: Partial<TicketInput>, user: Usuario) {
  const before = await prisma.ticket.findFirstOrThrow({ where: { id, ativo: true, ...getTicketScopeWhere(user) } });
  assertCanEditFields(user, payload);

  const resolvedPrazoConclusao = payload.prazoConclusao !== undefined
    ? (payload.prazoConclusao ? new Date(payload.prazoConclusao) : null)
    : before.prazoConclusao;
  const resolvedStatusTicket = payload.statusTicket ?? before.statusTicket;
  assertSlaConsistency(resolvedStatusTicket, resolvedPrazoConclusao);

  // Cálculos de custos com fallbacks corretos
  const nextValorReembolso = payload.valorReembolso !== undefined ? Number(payload.valorReembolso) : Number(before.valorReembolso);
  const nextValorColeta = payload.valorColeta !== undefined ? Number(payload.valorColeta) : Number(before.valorColeta);
  const nextValorAssistencia = (payload as any).valorAssistencia !== undefined ? Number((payload as any).valorAssistencia) : Number(before.valorAssistencia);
  const nextValorColetaEnvioPecas = (payload as any).valorColetaEnvioPecas !== undefined ? Number((payload as any).valorColetaEnvioPecas) : Number(before.valorColetaEnvioPecas);

  const isMonetaryUpdated = 
    payload.valorReembolso !== undefined || 
    payload.valorColeta !== undefined || 
    (payload as any).valorAssistencia !== undefined || 
    (payload as any).valorColetaEnvioPecas !== undefined;

  const updated = await prisma.ticket.update({
    where: { id },
    data: {
      ...payload,
      atualizadoPorId: user.id,
      ...(payload.dataReclamacao
        ? {
            mesReclamacao: new Date(payload.dataReclamacao).getUTCMonth() + 1,
            anoReclamacao: new Date(payload.dataReclamacao).getUTCFullYear()
          }
        : {}),
      linkPedido: payload.linkPedido !== undefined ? normalizeOptionalText(payload.linkPedido) : undefined,
      fabricante: payload.fabricante !== undefined ? normalizeOptionalText(payload.fabricante) : undefined,
      transportadora: payload.transportadora !== undefined ? normalizeOptionalText(payload.transportadora) : undefined,
      detalhesCliente: payload.detalhesCliente !== undefined ? normalizeOptionalText(payload.detalhesCliente) : undefined,
      comentarioInterno: payload.comentarioInterno !== undefined ? normalizeOptionalText(payload.comentarioInterno) : undefined,
      comentarioLoja: payload.comentarioLoja !== undefined ? normalizeOptionalText(payload.comentarioLoja) : undefined,
      responsavelId: payload.responsavelId !== undefined ? normalizeOptionalText(payload.responsavelId) : undefined,
      resolucao: payload.resolucao !== undefined ? (payload.resolucao ?? null) : undefined,
      prazoConclusao: resolvedPrazoConclusao,
      slaStatus: calculateSla(resolvedStatusTicket, resolvedPrazoConclusao),
      codigoRastreio: (payload as any).codigoRastreio !== undefined ? ((payload as any).codigoRastreio || null) : undefined,
      statusOperacionalLoja: (payload as any).statusOperacionalLoja !== undefined ? (payload as any).statusOperacionalLoja : undefined,
      acaoOperacionalLoja: payload.acaoOperacionalLoja !== undefined ? payload.acaoOperacionalLoja : undefined,
      ...(isMonetaryUpdated
        ? {
            valorReembolso: new Prisma.Decimal(nextValorReembolso),
            valorColeta: new Prisma.Decimal(nextValorColeta),
            valorAssistencia: new Prisma.Decimal(nextValorAssistencia),
            valorColetaEnvioPecas: new Prisma.Decimal(nextValorColetaEnvioPecas),
            custosTotais: new Prisma.Decimal(nextValorReembolso + nextValorColeta + nextValorAssistencia + nextValorColetaEnvioPecas)
          }
        : {})
    }
  });

  const action = payload.statusTicket && payload.statusTicket !== before.statusTicket ? "STATUS_CHANGE" : "UPDATE";
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


export async function uploadTicketAttachment(id: string, user: Usuario, file: File) {
  const ticket = await prisma.ticket.findFirst({ where: { id, ativo: true, ...getTicketScopeWhere(user) } });
  if (!ticket) throw new ForbiddenError("Ticket não encontrado ou sem acesso");
  if (user.perfil === "LOJA" && ticket.statusTicket === "CONCLUIDO") throw new ForbiddenError("LOJA não pode anexar em ticket concluído");

  const allowed = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
  if (!allowed.includes(file.type)) throw new AppError("Tipo de arquivo não permitido", 400, "INVALID_FILE_TYPE");
  if (file.size > 10 * 1024 * 1024) throw new AppError("Arquivo acima de 10MB", 400, "FILE_TOO_LARGE");

  const supabase = await createSupabaseRouteClient();

  if (ticket.anexoPath) {
    await supabase.storage.from("ticket-anexos").remove([ticket.anexoPath]);
  }

  const path = `tickets/${ticket.empresa}/${id}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
  const { error } = await supabase.storage.from("ticket-anexos").upload(path, file, { upsert: false, contentType: file.type });
  if (error) {
    logError("Falha upload ticket anexo", { error: error.message, path, ticketId: id });
    throw new AppError("Falha no upload do anexo", 500, "UPLOAD_FAILED");
  }

  const { data } = supabase.storage.from("ticket-anexos").getPublicUrl(path);

  const updated = await prisma.ticket.update({
    where: { id },
    data: {
      anexoUrl: data.publicUrl,
      anexoPath: path,
      anexoNome: file.name,
      anexoMimeType: file.type,
      anexoSizeBytes: BigInt(file.size),
      anexoUploadedAt: new Date(),
      anexoUploadedBy: user.id,
      atualizadoPorId: user.id
    }
  });

  await registerTicketAudit({
    ticketId: id,
    user,
    action: "UPDATE",
    before: { anexoPath: ticket.anexoPath } as unknown as Prisma.JsonObject,
    after: { anexoPath: path } as unknown as Prisma.JsonObject
  });

  return updated;
}

export async function removeTicketAttachment(id: string, user: Usuario) {
  if (user.perfil === "LOJA") throw new ForbiddenError("LOJA não pode remover anexo");

  const ticket = await prisma.ticket.findFirst({ where: { id, ativo: true, ...getTicketScopeWhere(user) } });
  if (!ticket) throw new ForbiddenError("Ticket não encontrado ou sem acesso");

  const supabase = await createSupabaseRouteClient();
  if (ticket.anexoPath) {
    await supabase.storage.from("ticket-anexos").remove([ticket.anexoPath]);
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: {
      anexoUrl: null,
      anexoPath: null,
      anexoNome: null,
      anexoMimeType: null,
      anexoSizeBytes: null,
      anexoUploadedAt: null,
      anexoUploadedBy: null,
      atualizadoPorId: user.id
    }
  });

  await registerTicketAudit({
    ticketId: id,
    user,
    action: "UPDATE",
    before: { anexoPath: ticket.anexoPath } as unknown as Prisma.JsonObject,
    after: { anexoPath: null } as unknown as Prisma.JsonObject
  });

  return updated;
}
