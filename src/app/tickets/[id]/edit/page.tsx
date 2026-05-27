import { requireCurrentUser } from "@/lib/auth/require-user";
import { getTicketById, softDeleteTicket } from "@/lib/services/tickets-service";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { TicketForm } from "@/components/forms/ticket-form";
import { prisma } from "@/lib/db/prisma";
import { Perfil } from "@prisma/client";
import { TicketFormInput } from "@/lib/validation/ticket";

export default async function TicketEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const ticket = await getTicketById(id, user);

  if (!ticket) notFound();

  const assignableUsers = await prisma.usuario.findMany({
    where: {
      ativo: true,
      perfil: {
        in: ["ATENDENTE", "SUPERVISOR", "ADMIN"]
      }
    },
    orderBy: {
      nome: "asc"
    },
    select: {
      id: true,
      nome: true
    }
  });

  const isLoja = user.perfil === Perfil.LOJA;

  const initialValues: Partial<TicketFormInput> = {
    ...(ticket as unknown as Partial<TicketFormInput>),

    canalMarketplace: ticket.canalMarketplace as TicketFormInput["canalMarketplace"],

    dataCompra: ticket.dataCompra.toISOString().slice(0, 10),
    dataReclamacao: ticket.dataReclamacao.toISOString().slice(0, 10),
    prazoConclusao: ticket.prazoConclusao?.toISOString().slice(0, 10) ?? "",

    valorReembolso: Number(ticket.valorReembolso ?? 0),
    valorColeta: Number(ticket.valorColeta ?? 0),
    valorAssistencia: Number(ticket.valorAssistencia ?? 0),
    valorColetaEnvioPecas: Number(ticket.valorColetaEnvioPecas ?? 0),

    comentarioLoja: ticket.comentarioLoja ?? "",
    comentarioInterno: ticket.comentarioInterno ?? "",
    codigoRastreio: ticket.codigoRastreio ?? "",

    linkPedido: ticket.linkPedido ?? "",
    fabricante: ticket.fabricante ?? "",
    transportadora: ticket.transportadora ?? "",
    detalhesCliente: ticket.detalhesCliente ?? "",
    responsavelId: ticket.responsavelId ?? "",
    resolucao: ticket.resolucao ?? ""
  };

  return (
    <section className="page ticket-edit-page">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div className="ticket-edit-topbar">
          <Link href={`/tickets/${id}`} className="btn btn-secondary">
            ← Voltar para o Ticket
          </Link>

          <div className="ticket-edit-actions">
            <Link href={`/tickets/${id}`} className="btn btn-secondary">
              Cancelar
            </Link>

            {!isLoja ? (
              <form
                action={async () => {
                  "use server";

                  await softDeleteTicket(id, user);
                  redirect("/tickets");
                }}
              >
                <button type="submit" className="btn btn-danger">
                  Excluir ticket
                </button>
              </form>
            ) : null}
          </div>
        </div>

        <p className="muted" style={{ marginTop: 24 }}>
          Editando ticket
        </p>

        <h1 style={{ margin: 0 }}>{ticket.nomeCliente}</h1>

        <p className="muted">ID: {ticket.id}</p>
      </div>

       <TicketForm
        ticketId={id}
        initialValues={initialValues}
        canEditSensitive={!isLoja}
        assignableUsers={assignableUsers}
        cancelHref={`/tickets/${id}`}
        userPerfil={user.perfil}
        ticketAttachment={{
          fileUrl: ticket.anexoUrl,
          fileName: ticket.anexoNome,
          filePath: ticket.anexoPath,
          mimeType: ticket.anexoMimeType,
          sizeBytes: ticket.anexoSizeBytes ? Number(ticket.anexoSizeBytes) : null,
          uploadedAt: ticket.anexoUploadedAt?.toISOString() ?? null,
          uploadedBy: ticket.anexoUploadedBy
        }}
      />
    </section>
  );
}