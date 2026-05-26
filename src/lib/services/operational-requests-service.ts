import { Prisma, Perfil, StatusOperacional, TipoAcaoOperacional } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

type AppUser = { id: string; perfil: Perfil; empresaVinculada: Prisma.$Enums.Empresa | null };

export async function listOperationalRequests(user: AppUser) {
  const where: Prisma.OperationalRequestWhereInput = user.perfil === "LOJA" ? { empresa: user.empresaVinculada ?? undefined } : {};
  if (user.perfil === "LOJA" && !user.empresaVinculada) throw new ForbiddenError("Usuário loja sem empresa vinculada");
  return prisma.operationalRequest.findMany({ where, include: { ticket: true, anexos: true }, orderBy: { updatedAt: "desc" } });
}

export async function createFromTicket(ticketId: string, tipoAcao: TipoAcaoOperacional, actor: AppUser) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new NotFoundError("Ticket não encontrado");
  const existing = await prisma.operationalRequest.findFirst({ where: { ticketId, tipoAcao, status: { not: "CONCLUIDA" } } });
  if (existing) return existing;

  const created = await prisma.operationalRequest.create({
    data: {
      ticketId,
      empresa: ticket.empresa,
      tipoAcao,
      createdBy: actor.id,
      updatedBy: actor.id,
      comentarioAtendente: ticket.comentarioInterno ?? null,
      prazoOperacional: ticket.prazoConclusao ?? null
    }
  });
  return created;
}

export async function updateOperationalRequest(id: string, actor: AppUser, payload: Partial<{status: StatusOperacional; comentarioLoja: string; codigoRastreio: string; valorReembolso: number; valorCte: number; valorColetaEnvioPecas: number; prazoOperacional: string;}>) {
  const current = await prisma.operationalRequest.findUnique({ where: { id } });
  if (!current) throw new NotFoundError("Solicitação não encontrada");
  if (actor.perfil === "LOJA" && current.empresa !== actor.empresaVinculada) throw new ForbiddenError();
  return prisma.operationalRequest.update({ where: { id }, data: { ...payload, updatedBy: actor.id, completedAt: payload.status === "CONCLUIDA" ? new Date() : undefined } });
}
