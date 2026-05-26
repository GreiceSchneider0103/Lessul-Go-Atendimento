import { Prisma, Perfil, StatusOperacional, TipoAcaoOperacional, TipoAnexoOperacional } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, ForbiddenError } from "@/lib/errors";
import { registerTicketAudit } from "@/lib/audit/ticket-audit";
import { sendEmail } from "@/lib/services/email-service";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";
import { getAppBaseUrl } from "@/lib/supabase/config";

type AppUser = { id: string; perfil: Perfil; empresaVinculada: import("@prisma/client").Empresa | null; email?: string; nome?: string };

const LOJA_ALLOWED_STATUS: StatusOperacional[] = [
  "ASSISTENCIA_A_CAMINHO",
  "ASSISTENCIA_ENTREGUE",
  "COLETA_SOLICITADA",
  "COLETA_FEITA",
  "DEVOLUCAO_SOLICITADA",
  "DEVOLUCAO_REALIZADA",
  "REEMBOLSO_PENDENTE",
  "REEMBOLSO_REALIZADO",
  "AGUARDANDO_ATENDENTE"
];

export async function listOperationalRequests(user: AppUser) {
  const where: Prisma.OperationalRequestWhereInput = user.perfil === "LOJA" ? { empresa: user.empresaVinculada ?? undefined } : {};
  if (user.perfil === "LOJA" && !user.empresaVinculada) throw new ForbiddenError("Usuário loja sem empresa vinculada");
  return prisma.operationalRequest.findMany({ where, include: { ticket: true, anexos: true }, orderBy: { updatedAt: "desc" } });
}

export async function createFromTicket(ticketId: string, tipoAcao: TipoAcaoOperacional, actor: AppUser) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new AppError("Ticket não encontrado", 404, "NOT_FOUND");
  const existing = await prisma.operationalRequest.findFirst({ where: { ticketId, tipoAcao, status: { not: "CONCLUIDA" } } });
  if (existing) return existing;

  const created = await prisma.operationalRequest.create({ data: { ticketId, empresa: ticket.empresa, tipoAcao, createdBy: actor.id, updatedBy: actor.id, comentarioAtendente: ticket.comentarioInterno ?? null, prazoOperacional: ticket.prazoConclusao ?? null } });

  await registerTicketAudit({ ticketId: ticket.id, user: actor as any, action: "UPDATE", before: { operationalRequest: null } as any, after: { operationalRequest: created.id, tipoAcao } as any });

  const lojaUsers = await prisma.usuario.findMany({ where: { perfil: "LOJA", ativo: true, empresaVinculada: ticket.empresa }, select: { email: true } });
  const link = `${getAppBaseUrl()}/loja/solicitacoes`;
  const body = `Olá,\n\nUma nova tarefa operacional foi criada para sua loja.\n\nTicket: ${ticket.id}\nCliente: ${ticket.nomeCliente}\nPedido: ${ticket.numeroVenda}\nEmpresa: ${ticket.empresa}\nAção solicitada: ${tipoAcao}\nPrazo: ${ticket.prazoConclusao?.toISOString().slice(0, 10) ?? "-"}\n\nAcesse o painel da loja para atualizar o andamento:\n${link}`;

  for (const loja of lojaUsers) {
    const result = await sendEmail({ to: loja.email, subject: "Atenção, nova tarefa operacional", text: body });
    await registerTicketAudit({ ticketId: ticket.id, user: actor as any, action: "UPDATE", before: {} as any, after: { operationalEmail: result.ok ? "sent" : "failed", to: loja.email } as any });
  }

  return created;
}

export async function updateOperationalRequest(id: string, actor: AppUser, payload: Partial<{ status: StatusOperacional; comentarioLoja: string; comentarioAtendente: string; codigoRastreio: string; valorReembolso: number; valorCte: number; valorColetaEnvioPecas: number; prazoOperacional: string; empresa: string; }>) {
  const current = await prisma.operationalRequest.findUnique({ where: { id } });
  if (!current) throw new AppError("Solicitação não encontrada", 404, "NOT_FOUND");
  if (actor.perfil === "LOJA" && current.empresa !== actor.empresaVinculada) throw new ForbiddenError();

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
  if (actor.perfil === "LOJA" && req.empresa !== actor.empresaVinculada) throw new ForbiddenError();
  return prisma.operationalRequestAttachment.findMany({ where: { operationalRequestId: requestId }, orderBy: { uploadedAt: "desc" }, take: 1 });
}

export async function uploadAttachment(requestId: string, file: File, tipoAnexo: TipoAnexoOperacional, actor: AppUser) {
  const req = await prisma.operationalRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new AppError("Solicitação não encontrada", 404, "NOT_FOUND");
  if (actor.perfil === "LOJA" && req.empresa !== actor.empresaVinculada) throw new ForbiddenError();
  if (actor.perfil === "LOJA" && req.status === "CONCLUIDA") throw new ForbiddenError("Solicitação concluída não permite novo anexo para LOJA");
  const allowed = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
  if (!allowed.includes(file.type)) throw new AppError("Tipo de arquivo não permitido", 400, "INVALID_FILE_TYPE");
  if (file.size > 10 * 1024 * 1024) throw new AppError("Arquivo acima de 10MB", 400, "FILE_TOO_LARGE");

  const supabase = await createSupabaseRouteClient();
  const existing = await prisma.operationalRequestAttachment.findFirst({ where: { operationalRequestId: requestId }, orderBy: { uploadedAt: "desc" } });
  if (existing?.storagePath) {
    await supabase.storage.from("operational-attachments").remove([existing.storagePath]);
    await prisma.operationalRequestAttachment.delete({ where: { id: existing.id } });
  }

  const path = `operational/${req.empresa}/${requestId}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
  const { error } = await supabase.storage.from("operational-attachments").upload(path, file, { upsert: false, contentType: file.type });
  if (error) { logError("Falha upload supabase storage", { error: error.message, path }); throw new Error("Falha no upload do arquivo"); }

  const { data } = supabase.storage.from("operational-attachments").getPublicUrl(path);
  const saved = await prisma.operationalRequestAttachment.create({ data: { operationalRequestId: requestId, ticketId: req.ticketId, empresa: req.empresa, tipoAnexo, fileUrl: data.publicUrl, storagePath: path, fileName: file.name, mimeType: file.type, sizeBytes: file.size, uploadedBy: actor.id } });
  await registerTicketAudit({ ticketId: req.ticketId, user: actor as any, action: "UPDATE", before: {} as any, after: { operationalAttachment: saved.id, tipoAnexo } as any });
  return saved;
}

export async function deleteAttachment(requestId: string, actor: AppUser) {
  if (actor.perfil === "LOJA") throw new ForbiddenError("Perfil LOJA não pode remover anexo");
  const req = await prisma.operationalRequest.findUnique({ where: { id: requestId } });
  if (!req) throw new AppError("Solicitação não encontrada", 404, "NOT_FOUND");
  const existing = await prisma.operationalRequestAttachment.findFirst({ where: { operationalRequestId: requestId }, orderBy: { uploadedAt: "desc" } });
  if (!existing) return { ok: true };
  const supabase = await createSupabaseRouteClient();
  if (existing.storagePath) await supabase.storage.from("operational-attachments").remove([existing.storagePath]);
  await prisma.operationalRequestAttachment.delete({ where: { id: existing.id } });
  return { ok: true };
}
