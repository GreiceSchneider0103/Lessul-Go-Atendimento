<<<<<<< HEAD
import { Perfil, Prisma } from "@prisma/client";
import { ForbiddenError } from "@/lib/errors";
=======
import { Perfil } from "@prisma/client";
>>>>>>> origin/main

export type Permission =
  | "ticket.create"
  | "ticket.update"
  | "ticket.update_sensitive"
  | "ticket.soft_delete"
  | "user.manage"
  | "reports.full"
<<<<<<< HEAD
  | "reports.export"
=======
>>>>>>> origin/main
  | "audit.read";

const matrix: Record<Perfil, Permission[]> = {
  ATENDENTE: ["ticket.create", "ticket.update"],
<<<<<<< HEAD
  SUPERVISOR: [
    "ticket.create",
    "ticket.update",
    "ticket.update_sensitive",
    "reports.full",
    "reports.export"
  ],
=======
  SUPERVISOR: ["ticket.create", "ticket.update", "ticket.update_sensitive", "reports.full"],
>>>>>>> origin/main
  ADMIN: [
    "ticket.create",
    "ticket.update",
    "ticket.update_sensitive",
    "ticket.soft_delete",
    "user.manage",
    "reports.full",
<<<<<<< HEAD
    "reports.export",
=======
>>>>>>> origin/main
    "audit.read"
  ]
};

export function hasPermission(perfil: Perfil, permission: Permission): boolean {
  return matrix[perfil].includes(permission);
}
<<<<<<< HEAD

export function assertPermission(perfil: Perfil, permission: Permission) {
  if (!hasPermission(perfil, permission)) throw new ForbiddenError();
}

export function getTicketScopeWhere(user: { id: string; perfil: Perfil }): Prisma.TicketWhereInput {
  if (user.perfil === "ATENDENTE") {
    return { OR: [{ criadoPorId: user.id }, { atualizadoPorId: user.id }, { responsavelId: user.id }] };
  }

  return {};
}
=======
>>>>>>> origin/main
