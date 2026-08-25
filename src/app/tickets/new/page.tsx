import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/require-user";
import { TicketForm } from "@/components/forms/ticket-form";
import { hasPermission } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db/prisma";
import { decodeTicketPrefill } from "@/lib/services/ticket-prefill";

type Props = {
  searchParams: Promise<{ prefill?: string }>;
};

export default async function NewTicketPage({ searchParams }: Props) {
  const user = await requireCurrentUser();

  if (!hasPermission(user.perfil, "ticket.create")) {
    redirect("/loja/solicitacoes");
  }

  const { prefill } = await searchParams;
  const initialValues = prefill ? decodeTicketPrefill(prefill) ?? undefined : undefined;

  const assignableUsers = await prisma.usuario.findMany({
    where: {
      ativo: true,
      perfil: {
        in: ["ATENDENTE", "SUPERVISOR", "ADMIN", "MASTER"]
      }
    },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true }
  });

  return (
    <section className="page">
      <div className="page-header">
        <h1>Criar ticket</h1>
        <p className="muted">Preencha os dados para registrar uma nova reclamação.</p>
      </div>
      <TicketForm
        canEditSensitive={hasPermission(user.perfil, "ticket.update_sensitive")}
        assignableUsers={assignableUsers}
        initialValues={initialValues}
      />
    </section>
  );
}
