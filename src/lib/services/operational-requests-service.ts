import { Prisma, Perfil, Empresa, StatusOperacional, TipoAcaoOperacional, TipoAnexoOperacional } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import { registerTicketAudit } from "@/lib/audit/ticket-audit";
import { sendEmail } from "@/lib/services/email-service";
import { createSupabaseAdmin } from "@/lib/supabase/service-role";
import { logError } from "@/lib/logger";
import { getAppBaseUrl } from "@/lib/supabase/config";
import { getTicketScopeWhere } from "@/lib/rbac/permissions";

type AppUser = {
  id: string;
  perfil: Perfil;
  empresaVinculada: Empresa | null;
  empresasVinculadas?: Empresa[];
  email?: string;
  nome?: string;
};

export function empresasFor(user: AppUser): Empresa[] {
  if (user.empresasVinculadas?.length) return user.empresasVinculadas;
  return user.empresaVinculada ? [user.empresaVinculada] : [];
}

/**
 * Powers the Operacional Loja nav dot: true when "the other side" (loja vs.
 * atendimento/admin) touched an active operational request since this
 * user's last visit to the page.
 */
export async function hasUnreadOperacionalLoja(params: {
  perfil: Perfil;
  empresasVinculadas: Empresa[];
  visitadoEm: Date | null;
}) {
  const since = params.visitadoEm ?? new Date(0);

  if (params.perfil === "LOJA") {
    if (params.empresasVinculadas.length === 0) return false;

    const count = await prisma.operationalRequest.count({
      where: {
        empresa: { in: params.empresasVinculadas },
        ticket: { ativo: true },
        updatedAt: { gt: since },
        atualizador: { perfil: { not: "LOJA" } }
      }
    });

    return count > 0;
  }

  const count = await prisma.operationalRequest.count({
    where: {
      ticket: { ativo: true },
      updatedAt: { gt: since },
      atualizador: { perfil: "LOJA" }
    }
  });

  return count > 0;
}

export async function markOperacionalLojaVisitado(userId: string) {
  await prisma.usuario.update({
    where: { id: userId },
    data: { operacionalLojaVisitadoEm: new Date() }
  });
}



async function appendComentarioOperacional(ticketId: string, actor: AppUser, comentario?: string | null) {
  const texto = (comentario ?? "").trim();
  if (!texto) return;
  await prisma.ticketComentarioOperacional.create({
    data: {
      ticketId,
      autorId: actor.id,
      autorNome: actor.nome ?? actor.email ?? "Usuário",
      autorPerfil: actor.perfil,
      comentario: texto
    }
  });
}

const LOJA_ALLOWED_STATUS: StatusOperacional[] = [
  "ENVIAR_ASSISTENCIA",
  "ASSISTENCIA_ENVIADA",
  "COLETAR",
  "COLETA_SOLICITADA",
  "COLETA_FEITA",
  "DEVOLUCAO_RECEBIDA",
  "REEMBOLSO_PENDENTE",
  "REEMBOLSO_REALIZADO",
  "AGUARDANDO_ATENDENTE"
];

export async function listOperationalRequests(user: AppUser) {
  const empresas = empresasFor(user);
  const where: Prisma.OperationalRequestWhereInput = user.perfil === "LOJA" ? { empresa: { in: empresas } } : {};
  if (user.perfil === "LOJA" && empresas.length === 0) throw new ForbiddenError("Usuário loja sem empresa vinculada");
  return prisma.operationalRequest.findMany({ where, include: { ticket: true, anexos: true }, orderBy: { updatedAt: "desc" } });
}

export async function createFromTicket(ticketId: string, tipoAcao: TipoAcaoOperacional, actor: AppUser) {
  // Scoped the same way every other ticket lookup is: without this, any user
  // holding "ticket.update" (including LOJA) could create an operational
  // request against an arbitrary ticket ID outside their own scope — an
  // ATENDENTE's own-tickets-only restriction, or a LOJA user's own-empresa
  // restriction — just by knowing/guessing its id.
  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, ativo: true, ...getTicketScopeWhere(actor) } });
  if (!ticket) throw new AppError("Ticket não encontrado", 404, "NOT_FOUND");
  const existing = await prisma.operationalRequest.findFirst({ where: { ticketId, tipoAcao, status: { not: "CONCLUIDA" } } });
  if (existing) return existing;

  const created = await prisma.operationalRequest.create({ data: { ticketId, empresa: ticket.empresa, tipoAcao, createdBy: actor.id, updatedBy: actor.id, comentarioAtendente: ticket.comentarioInterno ?? null, prazoOperacional: ticket.prazoConclusao ?? null } });

  await registerTicketAudit({ ticketId: ticket.id, user: actor as any, action: "UPDATE", before: { operationalRequest: null } as any, after: { operationalRequest: created.id, tipoAcao } as any });

  const lojaUsers = await prisma.usuario.findMany({
    where: {
      perfil: "LOJA",
      ativo: true,
      OR: [{ empresaVinculada: ticket.empresa }, { usuarioEmpresas: { some: { empresa: ticket.empresa } } }]
    },
    select: { email: true }
  });
  const link = `${getAppBaseUrl()}/loja/solicitacoes`;
  const body = `Olá,\n\nUma nova tarefa operacional foi criada para sua loja.\n\nTicket: ${ticket.id}\nCliente: ${ticket.nomeCliente}\nPedido: ${ticket.numeroVenda}\nEmpresa: ${ticket.empresa}\nAção solicitada: ${tipoAcao}\nPrazo: ${ticket.prazoConclusao?.toISOString().slice(0, 10) ?? "-"}\n\nAcesse o painel da loja para atualizar o andamento:\n${link}`;

  for (const loja of lojaUsers) {
    const result = await sendEmail({ to: loja.email, subject: "Atenção, nova tarefa operacional", text: body });
    await registerTicketAudit({ ticketId: ticket.id, user: actor as any, action: "UPDATE", before: {} as any, after: { operationalEmail: result.ok ? "sent" : "failed", to: loja.email } as any });
  }

  return created;
}

export async function updateOperationalRequest(id: string, actor: AppUser, payload: Partial<{ status: StatusOperacional; comentarioLoja: string; comentarioAtendente: string; codigoRastreio: string; valorReembolso: number; valorCte: number; valorColetaEnvioPecas: number; valorAssistencia: number; prazoOperacional: string; empresa: string; }>) {
  const current = await prisma.operationalRequest.findUnique({ where: { id } });
  if (!current) throw new AppError("Solicitação não encontrada", 404, "NOT_FOUND");
  if (actor.perfil === "LOJA" && !empresasFor(actor).includes(current.empresa)) throw new ForbiddenError();

  if (actor.perfil === "LOJA") {
    if (payload.status === "CONCLUIDA") throw new ForbiddenError("Perfil LOJA não pode concluir solicitação");
    if (payload.empresa && payload.empresa !== current.empresa) throw new ForbiddenError("Perfil LOJA não pode alterar empresa");
    if (payload.status && !LOJA_ALLOWED_STATUS.includes(payload.status)) {
      throw new AppError("Status operacional inválido para LOJA", 400, "INVALID_STATUS");
    }
  }

  const updated = await prisma.operationalRequest.update({
    where: { id },
    data: {
      status: payload.status,
      comentarioLoja: payload.comentarioLoja,
      comentarioAtendente: actor.perfil === "LOJA" ? undefined : payload.comentarioAtendente,
      codigoRastreio: payload.codigoRastreio,
      valorReembolso: payload.valorReembolso,
      valorCte: payload.valorCte,
      valorColetaEnvioPecas: payload.valorColetaEnvioPecas,
      prazoOperacional: payload.prazoOperacional ? new Date(payload.prazoOperacional) : undefined,
      updatedBy: actor.id,
      completedAt: payload.status === "CONCLUIDA" ? new Date() : undefined
    }
  });
  
  await prisma.ticket.update({
    where: { id: current.ticketId },
    data: {
      statusOperacionalLoja: (payload.status as any) ?? undefined,
      codigoRastreio: payload.codigoRastreio !== undefined ? (payload.codigoRastreio || null) : undefined,
      valorReembolso: payload.valorReembolso !== undefined ? new Prisma.Decimal(payload.valorReembolso) : undefined,
      valorAssistencia: payload.valorAssistencia !== undefined ? new Prisma.Decimal(payload.valorAssistencia) : undefined,
      valorColetaEnvioPecas: payload.valorColetaEnvioPecas !== undefined ? new Prisma.Decimal(payload.valorColetaEnvioPecas) : undefined,
      comentarioLoja: payload.comentarioLoja !== undefined ? (payload.comentarioLoja || null) : undefined,
      atualizadoPorId: actor.id
    }
  });

  await appendComentarioOperacional(current.ticketId, actor, payload.comentarioLoja ?? payload.comentarioAtendente);

  await registerTicketAudit({ ticketId: current.ticketId, user: actor as any, action: "UPDATE", before: { operational: current } as any, after: { operational: updated } as any });
  return updated;
}

export async function deleteOperationalRequest(id: string, actor: AppUser) {
  if (actor.perfil === "LOJA") throw new ForbiddenError("Perfil LOJA não pode excluir solicitação");
  const current = await prisma.operationalRequest.findUnique({ where: { id } });
  if (!current) throw new AppError("Solicitação não encontrada", 404, "NOT_FOUND");
  await prisma.operationalRequest.delete({ where: { id } });
  await registerTicketAudit({ ticketId: current.ticketId, user: actor as any, action: "UPDATE", before: { operationalDeleted: id } as any, after: {} as any });
  return { ok: true };
}

export async function listAttachments(requestId: string, actor: AppUser) {
  const req = await prisma.operationalRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new AppError("Solicitação não encontrada", 404, "NOT_FOUND");
  if (actor.perfil === "LOJA" && !empresasFor(actor).includes(req.empresa)) throw new ForbiddenError();
  return prisma.operationalRequestAttachment.findMany({ where: { operationalRequestId: requestId }, orderBy: { uploadedAt: "desc" }, take: 1 });
}

export async function uploadAttachment(requestId: string, file: File, tipoAnexo: TipoAnexoOperacional, actor: AppUser) {
  const req = await prisma.operationalRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new AppError("Solicitação não encontrada", 404, "NOT_FOUND");
  if (actor.perfil === "LOJA" && !empresasFor(actor).includes(req.empresa)) throw new ForbiddenError();
  if (actor.perfil === "LOJA" && req.status === "CONCLUIDA") throw new ForbiddenError("Solicitação concluída não permite novo anexo para LOJA");
  const allowed = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
  if (!allowed.includes(file.type)) throw new AppError("Tipo de arquivo não permitido", 400, "INVALID_FILE_TYPE");
  if (file.size > 10 * 1024 * 1024) throw new AppError("Arquivo acima de 10MB", 400, "FILE_TOO_LARGE");

  // Uses the ticket-anexos bucket (already provisioned in production), same as
  // the loja no-ticket devolução upload path — operational-attachments was
  // never actually set up there, and this bucket requires signed URLs to
  // read back (see the attachments/[id]/view route), not a public URL.
  const supabase = createSupabaseAdmin();
  const bucket = "ticket-anexos";
  const existing = await prisma.operationalRequestAttachment.findFirst({ where: { operationalRequestId: requestId }, orderBy: { uploadedAt: "desc" } });
  if (existing?.storagePath) {
    await supabase.storage.from(bucket).remove([existing.storagePath]);
    await prisma.operationalRequestAttachment.delete({ where: { id: existing.id } });
  }

  const path = `operational/${req.empresa}/${requestId}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type });
  if (error) { logError("Falha upload supabase storage", { error: error.message, path }); throw new Error("Falha no upload do arquivo"); }

  const saved = await prisma.operationalRequestAttachment.create({ data: { operationalRequestId: requestId, ticketId: req.ticketId, empresa: req.empresa, tipoAnexo, storagePath: path, fileName: file.name, mimeType: file.type, sizeBytes: file.size, uploadedBy: actor.id } });
  await registerTicketAudit({ ticketId: req.ticketId, user: actor as any, action: "UPDATE", before: {} as any, after: { operationalAttachment: saved.id, tipoAnexo } as any });
  return saved;
}

export async function deleteAttachment(requestId: string, actor: AppUser) {
  if (actor.perfil === "LOJA") throw new ForbiddenError("Perfil LOJA não pode remover anexo");
  const req = await prisma.operationalRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new AppError("Solicitação não encontrada", 404, "NOT_FOUND");
  const existing = await prisma.operationalRequestAttachment.findFirst({ where: { operationalRequestId: requestId }, orderBy: { uploadedAt: "desc" } });
  if (!existing) return { ok: true };
  const supabase = createSupabaseAdmin();
  if (existing.storagePath) await supabase.storage.from("ticket-anexos").remove([existing.storagePath]);
  await prisma.operationalRequestAttachment.delete({ where: { id: existing.id } });
  return { ok: true };
}
