import { BackupSyncStatus, Prisma, Usuario } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { registerTicketAudit } from "@/lib/audit/ticket-audit";
import { TicketFiltersInput, TicketInput } from "@/lib/validation/ticket";
import { getTicketScopeWhere, hasPermission } from "@/lib/rbac/permissions";
import { assertSlaConsistency, calculateSla } from "@/lib/utils/sla";
import { AppError, ForbiddenError } from "@/lib/errors";
import {
  appendTicketBackupRow,
  getGoogleSheetsBackupConfigError,
  isGoogleSheetsBackupEnabled,
  updateTicketBackupRow
} from "@/lib/integrations/google-sheets-backup";
import { logError } from "@/lib/logger";
import { createSupabaseAdmin } from "@/lib/supabase/service-role";

const sensitiveFields = ["valorColeta", "prazoConclusao", "resolucao"] as const;

function normalizeOptionalText(value?: string | null) {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function assertCanEditFields(user: Usuario, payload: Partial<TicketInput>) {
  if (user.perfil === "LOJA") {
    if (payload.statusOperacionalLoja === "CONCLUIDA") {
      throw new ForbiddenError("LOJA não pode concluir operação");
    }

    return;
  }

  const touchingSensitive = sensitiveFields.some((field) => payload[field] !== undefined);

  if (touchingSensitive && !hasPermission(user.perfil, "ticket.update_sensitive")) {
    throw new ForbiddenError("Seu perfil não pode editar campos sensíveis");
  }
}

function sanitizePayloadForLoja(user: Usuario, payload: Partial<TicketInput>) {
  if (user.perfil !== "LOJA") return payload;

  const sanitized = { ...payload };

  delete sanitized.valorColeta;
  delete sanitized.prazoConclusao;

  return sanitized;
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

function toAuditJson(ticket: Record<string, unknown>): Prisma.JsonObject {
  const output: Record<string, Prisma.JsonValue> = {};

  for (const [key, value] of Object.entries(ticket)) {
    if (value === undefined) continue;

    if (value === null) {
      output[key] = null;
      continue;
    }

    if (value instanceof Date) {
      output[key] = value.toISOString();
      continue;
    }

    if (typeof value === "bigint") {
      output[key] = value.toString();
      continue;
    }

    if (typeof value === "object" && value !== null && "toNumber" in value) {
      const decimalLike = value as { toNumber?: () => number };

      if (typeof decimalLike.toNumber === "function") {
        output[key] = decimalLike.toNumber();
        continue;
      }
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      output[key] = value;
      continue;
    }

    output[key] = String(value);
  }

  return output as Prisma.JsonObject;
}

async function markBackupSyncFailure(ticketId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  logError("Falha ao sincronizar backup Google Sheets", {
    ticketId,
    error: message
  });

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
    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId }
    });

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
    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId }
    });

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
  user: {
    id: string;
    perfil: "ATENDENTE" | "SUPERVISOR" | "ADMIN" | "LOJA" | "MASTER";
    empresaVinculada?: "LESSUL" | "MS_DECOR" | "VIVA_VIDA" | "MOVELBENTO" | "MODIFIKA" | null;
  }
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
      : !query.includeConcluidos
        ? { statusTicket: { not: "CONCLUIDO" } }
        : {}),

    ...(query.statusReclamacao ? { statusReclamacao: query.statusReclamacao } : {}),
    ...(query.motivo ? { motivo: query.motivo } : {}),
    ...(query.responsavelId ? { responsavelId: query.responsavelId } : {}),
    ...(query.criadoPorId ? { criadoPorId: query.criadoPorId } : {}),
    ...(getDateRange(query.startDate, query.endDate)
      ? { dataReclamacao: getDateRange(query.startDate, query.endDate) }
      : {})
  };

  const [items, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: { [query.orderBy]: query.orderDir },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        criadoPor: true,
        atualizadoPor: true,
        responsavel: {
          select: {
            id: true,
            nome: true
          }
        }
      }
    }),

    prisma.ticket.count({ where })
  ]);

  return {
    data: items.map((item) => ({
      ...item,
      slaStatus: calculateSla(item.statusTicket, item.prazoConclusao)
    })),

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
  const valorAssistencia = Number(input.valorAssistencia ?? 0);
  const valorColetaEnvioPecas = Number(input.valorColetaEnvioPecas ?? 0);
  const custosTotais = valorReembolso + valorColeta + valorAssistencia + valorColetaEnvioPecas;

  const ticket = await prisma.ticket.create({
    data: {
      nomeCliente: input.nomeCliente,
      dataCompra: new Date(input.dataCompra),
      numeroVenda: input.numeroVenda,
      linkPedido: normalizeOptionalText(input.linkPedido),
      uf: input.uf.toUpperCase(),
      cpf: input.cpf,
      canalMarketplace: input.canalMarketplace,
      empresa: input.empresa,
      produto: input.produto,
      sku: input.sku,
      fabricante: normalizeOptionalText(input.fabricante),
      transportadora: normalizeOptionalText(input.transportadora),
      statusReclamacao: input.statusReclamacao,
      dataReclamacao: new Date(input.dataReclamacao),
      mesReclamacao: new Date(input.dataReclamacao).getUTCMonth() + 1,
      anoReclamacao: new Date(input.dataReclamacao).getUTCFullYear(),
      motivo: input.motivo,
      detalhesCliente: normalizeOptionalText(input.detalhesCliente),
      comentarioInterno: normalizeOptionalText(input.comentarioInterno),
      resolucao: input.resolucao ?? null,
      valorReembolso: new Prisma.Decimal(valorReembolso),
      valorColeta: new Prisma.Decimal(valorColeta),
      valorAssistencia: new Prisma.Decimal(valorAssistencia),
      valorColetaEnvioPecas: new Prisma.Decimal(valorColetaEnvioPecas),
      custosTotais: new Prisma.Decimal(custosTotais),
      statusTicket: input.statusTicket,
      prazoConclusao,
      responsavelId: normalizeOptionalText(input.responsavelId),
      criadoPorId: userId,
      atualizadoPorId: userId,
      acaoOperacionalLoja: input.acaoOperacionalLoja ?? "NENHUMA",
      statusOperacionalLoja: input.statusOperacionalLoja ?? "EM_ABERTO",
      codigoRastreio: normalizeOptionalText(input.codigoRastreio),
      comentarioLoja: normalizeOptionalText(input.comentarioLoja),
      slaStatus: calculateSla(input.statusTicket, prazoConclusao),
      ...(input.statusTicket === "CONCLUIDO" ? { concluidoEm: new Date() } : {})
    }
  });

  const user = await prisma.usuario.findUniqueOrThrow({
    where: { id: userId }
  });

  await registerTicketAudit({
    ticketId: ticket.id,
    user,
    action: "CREATE",
    after: toAuditJson(ticket as unknown as Record<string, unknown>)
  });

  await syncTicketCreateBackup(ticket.id);

  return ticket;
}

export async function getTicketById(id: string, user: Usuario) {
  const ticket = await prisma.ticket.findFirst({
    where: {
      id,
      ativo: true,
      ...getTicketScopeWhere(user)
    },
    include: {
      auditoria: {
        orderBy: {
          dataHora: "desc"
        },
        take: 100
      },
      responsavel: {
        select: {
          id: true,
          nome: true
        }
      },
      comentariosOperacionais: {
        orderBy: {
          criadoEm: "desc"
        }
      }
    }
  });

  if (!ticket) {
    throw new ForbiddenError("Ticket não encontrado ou sem acesso");
  }

  return ticket;
}

export async function updateTicket(id: string, rawPayload: Partial<TicketInput>, user: Usuario) {
  const before = await prisma.ticket.findFirstOrThrow({
    where: {
      id,
      ativo: true,
      ...getTicketScopeWhere(user)
    }
  });

  const payload = sanitizePayloadForLoja(user, rawPayload);

  assertCanEditFields(user, payload);

  const shouldCloseTicket =
    payload.statusOperacionalLoja === "REEMBOLSO_REALIZADO" ||
    payload.statusOperacionalLoja === "ASSISTENCIA_ENTREGUE";

  const resolvedStatusTicket = shouldCloseTicket ? "CONCLUIDO" : payload.statusTicket ?? before.statusTicket;

  const resolvedPrazoConclusao =
    payload.prazoConclusao !== undefined
      ? payload.prazoConclusao
        ? new Date(payload.prazoConclusao)
        : null
      : before.prazoConclusao;

  assertSlaConsistency(resolvedStatusTicket, resolvedPrazoConclusao);

  const nextValorReembolso =
    payload.valorReembolso !== undefined ? Number(payload.valorReembolso) : Number(before.valorReembolso);

  const nextValorColeta = payload.valorColeta !== undefined ? Number(payload.valorColeta) : Number(before.valorColeta);

  const nextValorAssistencia =
    payload.valorAssistencia !== undefined ? Number(payload.valorAssistencia) : Number(before.valorAssistencia);

  const nextValorColetaEnvioPecas =
    payload.valorColetaEnvioPecas !== undefined
      ? Number(payload.valorColetaEnvioPecas)
      : Number(before.valorColetaEnvioPecas);

  const isMonetaryUpdated =
    payload.valorReembolso !== undefined ||
    payload.valorColeta !== undefined ||
    payload.valorAssistencia !== undefined ||
    payload.valorColetaEnvioPecas !== undefined;

  const nextCustosTotais = nextValorReembolso + nextValorColeta + nextValorAssistencia + nextValorColetaEnvioPecas;

  const data: Prisma.TicketUncheckedUpdateInput = {
    atualizadoPorId: user.id,

    ...(payload.nomeCliente !== undefined ? { nomeCliente: payload.nomeCliente } : {}),
    ...(payload.numeroVenda !== undefined ? { numeroVenda: payload.numeroVenda } : {}),
    ...(payload.produto !== undefined ? { produto: payload.produto } : {}),
    ...(payload.sku !== undefined ? { sku: payload.sku } : {}),
    ...(payload.uf !== undefined ? { uf: payload.uf.toUpperCase() } : {}),
    ...(payload.cpf !== undefined ? { cpf: payload.cpf } : {}),
    ...(payload.canalMarketplace !== undefined ? { canalMarketplace: payload.canalMarketplace } : {}),
    ...(payload.empresa !== undefined ? { empresa: payload.empresa } : {}),
    ...(payload.motivo !== undefined ? { motivo: payload.motivo } : {}),
    ...(payload.statusReclamacao !== undefined ? { statusReclamacao: payload.statusReclamacao } : {}),
    ...(payload.acaoOperacionalLoja !== undefined ? { acaoOperacionalLoja: payload.acaoOperacionalLoja } : {}),
    ...(payload.statusOperacionalLoja !== undefined ? { statusOperacionalLoja: payload.statusOperacionalLoja } : {}),

    statusTicket: resolvedStatusTicket,
    slaStatus: calculateSla(resolvedStatusTicket, resolvedPrazoConclusao),

    ...(payload.dataCompra !== undefined ? { dataCompra: new Date(payload.dataCompra) } : {}),

    ...(payload.dataReclamacao !== undefined
      ? {
          dataReclamacao: new Date(payload.dataReclamacao),
          mesReclamacao: new Date(payload.dataReclamacao).getUTCMonth() + 1,
          anoReclamacao: new Date(payload.dataReclamacao).getUTCFullYear()
        }
      : {}),

    ...(payload.prazoConclusao !== undefined ? { prazoConclusao: resolvedPrazoConclusao } : {}),

    ...(payload.linkPedido !== undefined ? { linkPedido: normalizeOptionalText(payload.linkPedido) } : {}),
    ...(payload.fabricante !== undefined ? { fabricante: normalizeOptionalText(payload.fabricante) } : {}),
    ...(payload.transportadora !== undefined ? { transportadora: normalizeOptionalText(payload.transportadora) } : {}),
    ...(payload.detalhesCliente !== undefined ? { detalhesCliente: normalizeOptionalText(payload.detalhesCliente) } : {}),
    ...(payload.comentarioInterno !== undefined ? { comentarioInterno: normalizeOptionalText(payload.comentarioInterno) } : {}),
    ...(payload.comentarioLoja !== undefined ? { comentarioLoja: normalizeOptionalText(payload.comentarioLoja) } : {}),
    ...(payload.codigoRastreio !== undefined ? { codigoRastreio: normalizeOptionalText(payload.codigoRastreio) } : {}),
    ...(payload.responsavelId !== undefined ? { responsavelId: normalizeOptionalText(payload.responsavelId) } : {}),
    ...(payload.resolucao !== undefined ? { resolucao: payload.resolucao ?? null } : {}),

    ...(isMonetaryUpdated
      ? {
          valorReembolso: new Prisma.Decimal(nextValorReembolso),
          valorColeta: new Prisma.Decimal(nextValorColeta),
          valorAssistencia: new Prisma.Decimal(nextValorAssistencia),
          valorColetaEnvioPecas: new Prisma.Decimal(nextValorColetaEnvioPecas),
          custosTotais: new Prisma.Decimal(nextCustosTotais)
        }
      : {})
  };

  // Se o ticket foi concluído via statusTicket e o payload não setou statusOperacionalLoja,
  // sincroniza o status operacional para `CONCLUIDA` para manter a listagem operacional consistente.
  if (payload.statusOperacionalLoja === undefined && resolvedStatusTicket === "CONCLUIDO") {
    // usar asserção any para evitar conflito de tipos estritos do Prisma aqui
    (data as any).statusOperacionalLoja = "CONCLUIDA";
  }

  // Preencher ou limpar `concluidoEm` conforme transições de status:
  // - Quando passa para CONCLUIDO e anteriormente não estava concluído, setar agora.
  // - Quando sai de CONCLUIDO para outro status, limpar (null).
  const wasConcluded = before.statusTicket === "CONCLUIDO";
  const willBeConcluded = resolvedStatusTicket === "CONCLUIDO";

  if (!wasConcluded && willBeConcluded) {
    (data as any).concluidoEm = new Date();
  } else if (wasConcluded && !willBeConcluded) {
    (data as any).concluidoEm = null;
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data
  });

  const action = resolvedStatusTicket !== before.statusTicket ? "STATUS_CHANGE" : "UPDATE";

  await registerTicketAudit({
    ticketId: id,
    user,
    action,
    before: toAuditJson(before as unknown as Record<string, unknown>),
    after: toAuditJson(updated as unknown as Record<string, unknown>)
  });

  await syncTicketUpdateBackup(id);

  return updated;
}

export async function softDeleteTicket(id: string, user: Usuario) {
  const before = await prisma.ticket.findFirstOrThrow({
    where: {
      id,
      ...getTicketScopeWhere(user)
    }
  });

  const updated = await prisma.ticket.update({
    where: { id },
    data: {
      ativo: false,
      atualizadoPorId: user.id
    }
  });

  await registerTicketAudit({
    ticketId: id,
    user,
    action: "SOFT_DELETE",
    before: toAuditJson(before as unknown as Record<string, unknown>),
    after: toAuditJson(updated as unknown as Record<string, unknown>)
  });

  await syncTicketUpdateBackup(id);

  return { ok: true };
}

function getSafeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

export async function uploadTicketAttachment(id: string, user: Usuario, file: File) {
  const ticket = await prisma.ticket.findFirst({
    where: {
      id,
      ativo: true,
      ...getTicketScopeWhere(user)
    }
  });

  if (!ticket) {
    throw new ForbiddenError("Ticket não encontrado ou sem acesso");
  }

  if (user.perfil === "LOJA" && ticket.statusTicket === "CONCLUIDO") {
    throw new ForbiddenError("LOJA não pode anexar em ticket concluído");
  }

  const allowed = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

  if (!allowed.includes(file.type)) {
    throw new AppError("Tipo de arquivo não permitido", 400, "INVALID_FILE_TYPE");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new AppError("Arquivo acima de 10MB", 400, "FILE_TOO_LARGE");
  }

  const supabase = createSupabaseAdmin();
  const bucket = "ticket-anexos";

  if (ticket.anexoPath) {
    await supabase.storage.from(bucket).remove([ticket.anexoPath]);
  }

  const safeFileName = getSafeFileName(file.name);
  const path = `tickets/${ticket.empresa}/${id}/${Date.now()}-${safeFileName}`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: file.type
  });

  if (uploadError) {
    logError("Falha no upload do anexo do ticket", {
      ticketId: id,
      path,
      message: uploadError.message
    });

    if (uploadError.message.toLowerCase().includes("not found")) {
      throw new AppError("Bucket ticket-anexos não encontrado", 500, "STORAGE_BUCKET_NOT_FOUND");
    }

    throw new AppError("Falha no upload do anexo", 500, "UPLOAD_FAILED");
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: {
      anexoUrl: `/api/tickets/${id}/attachment/view`,
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
    before: toAuditJson({
      anexoPath: ticket.anexoPath,
      anexoNome: ticket.anexoNome,
      anexoMimeType: ticket.anexoMimeType,
      anexoSizeBytes: ticket.anexoSizeBytes
    }),
    after: toAuditJson({
      anexoPath: path,
      anexoNome: file.name,
      anexoMimeType: file.type,
      anexoSizeBytes: BigInt(file.size)
    })
  });

  return updated;
}

export async function removeTicketAttachment(id: string, user: Usuario) {
  if (user.perfil === "LOJA") {
    throw new ForbiddenError("LOJA não pode remover anexo");
  }

  const ticket = await prisma.ticket.findFirst({
    where: {
      id,
      ativo: true,
      ...getTicketScopeWhere(user)
    }
  });

  if (!ticket) {
    throw new ForbiddenError("Ticket não encontrado ou sem acesso");
  }

  const supabase = createSupabaseAdmin();
  const bucket = "ticket-anexos";

  if (ticket.anexoPath) {
    await supabase.storage.from(bucket).remove([ticket.anexoPath]);
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
    before: toAuditJson({
      anexoPath: ticket.anexoPath,
      anexoNome: ticket.anexoNome,
      anexoMimeType: ticket.anexoMimeType,
      anexoSizeBytes: ticket.anexoSizeBytes
    }),
    after: toAuditJson({
      anexoPath: null,
      anexoNome: null,
      anexoMimeType: null,
      anexoSizeBytes: null
    })
  });

  return updated;
}