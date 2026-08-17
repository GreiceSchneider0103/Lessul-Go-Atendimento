import { Perfil, Prisma, Empresa } from "@prisma/client";
import { ForbiddenError } from "@/lib/errors";

export type Permission =
  | "ticket.create" | "ticket.update" | "ticket.update_sensitive" | "ticket.soft_delete"
  | "user.manage" | "reports.full" | "reports.export" | "audit.read"
  | "operational.view" | "operational.update";

const matrix: Record<Perfil, Permission[]> = {
  ATENDENTE: ["ticket.create", "ticket.update", "operational.view"],
  SUPERVISOR: ["ticket.create", "ticket.update", "ticket.update_sensitive", "reports.full", "reports.export", "operational.view"],
  ADMIN: ["ticket.create", "ticket.update", "ticket.update_sensitive", "ticket.soft_delete", "user.manage", "reports.full", "reports.export", "audit.read", "operational.view", "operational.update"],
  LOJA: ["operational.view", "operational.update", "ticket.update"]
};

export const hasPermission = (perfil: Perfil, permission: Permission) => matrix[perfil].includes(permission);
export const assertPermission = (perfil: Perfil, permission: Permission) => { if (!hasPermission(perfil, permission)) throw new ForbiddenError(); };

export function getTicketScopeWhere(user: { id: string; perfil: Perfil; empresaVinculada?: Empresa | null }): Prisma.TicketWhereInput {
  if (user.perfil === "LOJA") return { empresa: user.empresaVinculada ?? undefined };
  if (user.perfil === "ATENDENTE") return { OR: [{ criadoPorId: user.id }, { atualizadoPorId: user.id }, { responsavelId: user.id }] };
  return {};
}
