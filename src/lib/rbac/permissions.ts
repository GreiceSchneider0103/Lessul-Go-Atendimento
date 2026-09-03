import { Perfil, Prisma, Empresa } from "@prisma/client";
import { ForbiddenError } from "@/lib/errors";

export type Permission =
  | "ticket.create" | "ticket.update" | "ticket.update_sensitive" | "ticket.soft_delete"
  | "user.manage" | "reports.full" | "reports.export" | "audit.read"
  | "operational.view" | "operational.update" | "master.manage"
  | "support.view" | "support.update"
  | "devolucoes_internas.view" | "devolucoes_internas.update";

const matrix: Record<Perfil, Permission[]> = {
  ATENDENTE: ["ticket.create", "ticket.update", "operational.view", "support.view", "support.update", "devolucoes_internas.view", "devolucoes_internas.update"],
  SUPERVISOR: ["ticket.create", "ticket.update", "ticket.update_sensitive", "reports.full", "reports.export", "operational.view", "support.view", "support.update", "devolucoes_internas.view", "devolucoes_internas.update"],
  ADMIN: ["ticket.create", "ticket.update", "ticket.update_sensitive", "ticket.soft_delete", "user.manage", "reports.full", "reports.export", "audit.read", "operational.view", "operational.update", "support.view", "support.update", "devolucoes_internas.view", "devolucoes_internas.update"],
  LOJA: ["operational.view", "operational.update", "ticket.update", "support.view", "support.update"],
  MASTER: ["ticket.create", "ticket.update", "ticket.update_sensitive", "ticket.soft_delete", "user.manage", "reports.full", "reports.export", "audit.read", "operational.view", "operational.update", "master.manage", "support.view", "support.update", "devolucoes_internas.view", "devolucoes_internas.update"]
};

export const hasPermission = (perfil: Perfil, permission: Permission) => matrix[perfil].includes(permission);
export const assertPermission = (perfil: Perfil, permission: Permission) => { if (!hasPermission(perfil, permission)) throw new ForbiddenError(); };

export function getTicketScopeWhere(user: {
  id: string;
  perfil: Perfil;
  empresaVinculada?: Empresa | null;
  empresasVinculadas?: Empresa[];
}): Prisma.TicketWhereInput {
  if (user.perfil === "LOJA") {
    const empresas = user.empresasVinculadas?.length
      ? user.empresasVinculadas
      : user.empresaVinculada
        ? [user.empresaVinculada]
        : [];
    return { empresa: { in: empresas } };
  }
  if (user.perfil === "ATENDENTE") return { OR: [{ criadoPorId: user.id }, { atualizadoPorId: user.id }, { responsavelId: user.id }] };
  return {};
}
