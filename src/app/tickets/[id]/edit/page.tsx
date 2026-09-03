import { requireCurrentUser } from "@/lib/auth/require-user";
import { getTicketById } from "@/lib/services/tickets-service";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TicketForm } from "@/components/forms/ticket-form";
import { TicketDeleteButton } from "@/components/tickets/ticket-delete-button";
import { prisma } from "@/lib/db/prisma";
import { Perfil } from "@prisma/client";
import { TicketFormInput } from "@/lib/validation/ticket";
import { hasPermission } from "@/lib/rbac/permissions";

type BackHref = "/loja/solicitacoes" | `/tickets/${string}`;

export default async function TicketEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const ticket = await getTicketById(id, user);

  if (!ticket) notFound();

  const assignableUsers = await prisma.usuario.findMany({
    where: {
      ativo: true,
      perfil: {
        in: ["ATENDENTE", "SUPERVISOR", "ADMIN", "MASTER"]
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

  const backHref: BackHref = isLoja
    ? "/loja/solicitacoes"
    : `/tickets/${id}`;

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
    valorRecuperado: Number(ticket.valorRecuperado ?? 0),

    comentarioLoja: ticket.comentarioLoja ?? "",
    comentarioInterno: ticket.comentarioInterno ?? "",
    codigoRastreio: ticket.codigoRastreio ?? "",

    linkPedido: ticket.linkPedido ?? "",
    fabricante: ticket.fabricante ?? "",
    transportadora: ticket.transportadora ?? "",
    detalhesCliente: ticket.detalhesCliente ?? "",
    responsavelId: ticket.responsavelId ?? "",
    resolucao: ticket.resolucao ?? "",
    acaoOperacionalLoja: ticket.acaoOperacionalLoja ?? "NENHUMA",
    statusOperacionalLoja: ticket.statusOperacionalLoja ?? "EM_ABERTO"
  };

  return (
    <section className="page ticket-edit-page">
      <div className="page-header mb-6">
        <div className="ticket-edit-topbar">
          <Link href={backHref} className="btn btn-secondary">
            <ArrowLeft size={15} strokeWidth={2.25} aria-hidden />
            Voltar
          </Link>

          <div className="ticket-edit-actions">
            <Link href={backHref} className="btn btn-secondary">
              Cancelar
            </Link>

            {hasPermission(user.perfil, "ticket.soft_delete") ? <TicketDeleteButton ticketId={id} /> : null}
          </div>
        </div>

        <p className="muted mt-6">
          Editando ticket
        </p>

        <h1 className="m-0">{ticket.nomeCliente}</h1>

        <p className="muted">ID: {ticket.id}</p>
      </div>

      <TicketForm
        ticketId={id}
        initialValues={initialValues}
        canEditSensitive={hasPermission(user.perfil, "ticket.update_sensitive")}
        assignableUsers={assignableUsers}
        cancelHref={backHref}
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