import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { registerTicketAudit } from "@/lib/audit/ticket-audit";
<<<<<<< HEAD
import { TicketFiltersInput, TicketInput } from "@/lib/validation/ticket";
import { getTicketScopeWhere } from "@/lib/rbac/permissions";
import { calculateSla } from "@/lib/utils/sla";

export async function listTickets(
  query: TicketFiltersInput,
  user: { id: string; perfil: "ATENDENTE" | "SUPERVISOR" | "ADMIN" }
) {
  const where: Prisma.TicketWhereInput = {
    ativo: true,
    ...getTicketScopeWhere(user),
=======
import { TicketInput } from "@/lib/validation/ticket";

export async function listTickets(query: { page?: number; pageSize?: number; search?: string }) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const where: Prisma.TicketWhereInput = {
    ativo: true,
>>>>>>> origin/main
    ...(query.search
      ? {
          OR: [
            { nomeCliente: { contains: query.search, mode: "insensitive" } },
            { numeroVenda: { contains: query.search, mode: "insensitive" } },
            { canalMarketplace: { contains: query.search, mode: "insensitive" } }
          ]
        }
<<<<<<< HEAD
      : {}),
    ...(query.empresa ? { empresa: query.empresa } : {}),
    ...(query.canalMarketplace ? { canalMarketplace: query.canalMarketplace } : {}),
    ...(query.statusTicket ? { statusTicket: query.statusTicket } : {}),
    ...(query.statusReclamacao ? { statusReclamacao: query.statusReclamacao } : {}),
    ...(query.motivo ? { motivo: query.motivo } : {}),
    ...(query.responsavelId ? { responsavelId: query.responsavelId } : {}),
    ...(query.startDate || query.endDate
      ? {
          dataReclamacao: {
            ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
            ...(query.endDate ? { lte: new Date(query.endDate) } : {})
          }
        }
=======
>>>>>>> origin/main
      : {})
  };

  const [items, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
<<<<<<< HEAD
      orderBy: { [query.orderBy]: query.orderDir },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
=======
      orderBy: { criadoEm: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
>>>>>>> origin/main
      include: { criadoPor: true, atualizadoPor: true }
    }),
    prisma.ticket.count({ where })
  ]);

<<<<<<< HEAD
  return {
    items: items.map((item) => ({ ...item, slaStatus: calculateSla(item.statusTicket, item.prazoConclusao) })),
    total,
    page: query.page,
    pageSize: query.pageSize
  };
=======
  return { items, total, page, pageSize };
>>>>>>> origin/main
}

export async function createTicket(input: TicketInput, userId: string) {
  const ticket = await prisma.ticket.create({
    data: {
      ...input,
      dataCompra: new Date(input.dataCompra),
      dataReclamacao: new Date(input.dataReclamacao),
<<<<<<< HEAD
      mesReclamacao: new Date(input.dataReclamacao).getUTCMonth() + 1,
      anoReclamacao: new Date(input.dataReclamacao).getUTCFullYear(),
=======
>>>>>>> origin/main
      prazoConclusao: input.prazoConclusao ? new Date(input.prazoConclusao) : null,
      valorReembolso: new Prisma.Decimal(input.valorReembolso),
      valorColeta: new Prisma.Decimal(input.valorColeta),
      custosTotais: new Prisma.Decimal(input.valorReembolso + input.valorColeta),
      criadoPorId: userId,
<<<<<<< HEAD
      atualizadoPorId: userId,
      slaStatus: calculateSla(input.statusTicket, input.prazoConclusao ? new Date(input.prazoConclusao) : null)
=======
      atualizadoPorId: userId
>>>>>>> origin/main
    }
  });

  const user = await prisma.usuario.findUniqueOrThrow({ where: { id: userId } });
  await registerTicketAudit({ ticketId: ticket.id, user, action: "CREATE", after: ticket as unknown as Prisma.JsonObject });
  return ticket;
}
