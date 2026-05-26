import { requireCurrentUser } from "@/lib/auth/require-user";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { getTicketById } from "@/lib/services/tickets-service";
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/rbac/permissions";
import { TicketDeleteButton } from "@/components/tickets/ticket-delete-button";
import { formatCurrencyBR, formatDateBR, formatDateTimeBR, formatEnumLabel } from "@/lib/formatters/display";

async function getTicket(id: string, user: Awaited<ReturnType<typeof requireCurrentUser>>) {
  try {
    const ticket = await getTicketById(id, user);
    return { ticket, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar ticket";
    return { ticket: null, error: message };
  }
}

export default async function TicketDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const { ticket, error } = await getTicket(id, user);
  const operacionais = ticket ? await prisma.operationalRequest.findMany({ where: { ticketId: ticket.id }, include: { anexos: true }, orderBy: { createdAt: "desc" } }) : [];

  return (
    <section className="page">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1>Detalhe do ticket</h1>
          <p className="muted">Informações completas e histórico de auditoria.</p>
        </div>
        {!error && ticket ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link className="btn btn-primary" href={`/tickets/${id}/edit`} style={{ whiteSpace: "nowrap" }}>Editar ticket</Link>
            {hasPermission(user.perfil, "ticket.soft_delete") ? <TicketDeleteButton ticketId={id} /> : null}
          </div>
        ) : null}
      </div>

      {error || !ticket ? (
        <div className="alert alert-error">{error ?? "Ticket não encontrado"}</div>
      ) : (
        <>
          <div className="grid" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
            <article className="card">
              <h2>Dados do cliente</h2>
              <p><strong>Nome:</strong> {ticket.nomeCliente}</p>
              <p><strong>CPF:</strong> {ticket.cpf}</p>
              <p><strong>UF:</strong> {ticket.uf}</p>
              <p><strong>Detalhes:</strong> {ticket.detalhesCliente || "-"}</p>
            </article>

            <article className="card">
              <h2>Dados do pedido</h2>
              <p><strong>Número da venda:</strong> {ticket.numeroVenda}</p>
              <p style={{ display: "grid", gap: 4 }}>
                <strong>Link do pedido:</strong>
                {ticket.linkPedido ? (
                  <a href={ticket.linkPedido} target="_blank" rel="noreferrer" style={{ overflowWrap: "anywhere" }}>{ticket.linkPedido}</a>
                ) : "-"}
              </p>
              <p><strong>Data da compra:</strong> {formatDateBR(ticket.dataCompra)}</p>
              <p><strong>Marketplace:</strong> {formatEnumLabel(ticket.canalMarketplace)}</p>
              <p><strong>Empresa:</strong> {formatEnumLabel(ticket.empresa)}</p>
              <p><strong>Produto:</strong> {ticket.produto}</p>
              <p><strong>SKU:</strong> {ticket.sku}</p>
            </article>

            <article className="card">
              <h2>Reclamação e prazo</h2>
              <p><strong>Status do ticket:</strong> <StatusBadge value={ticket.statusTicket} /></p>
              <p><strong>Status da reclamação:</strong> <StatusBadge value={ticket.statusReclamacao} context="statusReclamacao" /></p>
              <p><strong>Motivo:</strong> <StatusBadge value={ticket.motivo} context="motivo" /></p>
              <p><strong>Resolução:</strong> {ticket.resolucao ? formatEnumLabel(ticket.resolucao) : "-"}</p>
              <p><strong>Ação operacional da loja:</strong> {ticket.acaoOperacionalLoja === "NENHUMA" ? "Nenhuma" : ticket.acaoOperacionalLoja === "ASSISTENCIA" ? "Enviar assistência" : ticket.acaoOperacionalLoja === "COLETA" ? "Solicitar coleta" : ticket.acaoOperacionalLoja === "DEVOLUCAO" ? "Devolução" : "Reembolso"}</p>
              <p><strong>Data da reclamação:</strong> {formatDateBR(ticket.dataReclamacao)}</p>
              <p><strong>Prazo de conclusão:</strong> {formatDateBR(ticket.prazoConclusao)}</p>
              <p><strong>SLA:</strong> <StatusBadge value={ticket.slaStatus} /></p>
            </article>

            <article className="card">
              <h2>Valores e rastreabilidade</h2>
              <p><strong>Reembolso:</strong> {formatCurrencyBR(ticket.valorReembolso as unknown as number)}</p>
              <p><strong>Coleta, envio ou peças:</strong> {formatCurrencyBR(ticket.valorColeta as unknown as number)}</p>
              <p><strong>Custos totais:</strong> {formatCurrencyBR(ticket.custosTotais as unknown as number)}</p>
              <p><strong>Responsável:</strong> {ticket.responsavel?.nome ?? "Não atribuído"}</p>
              <p><strong>Criado em:</strong> {formatDateTimeBR(ticket.criadoEm)}</p>
              <p><strong>Atualizado em:</strong> {formatDateTimeBR(ticket.atualizadoEm)}</p>
              <p><strong>Atualizado por:</strong> {ticket.atualizadoPorId ?? "-"}</p>
            </article>
          </div>

          <article className="card">
            <h2>Comentário interno</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{ticket.comentarioInterno || "Sem comentário interno."}</p>
          </article>


          {operacionais.length ? <article className="card"><h2>Solicitação operacional da loja</h2>{operacionais.map((op)=><div key={op.id} style={{border:"1px solid #ddd",padding:12,marginBottom:12,borderRadius:8}}><p><strong>Tipo:</strong> {op.tipoAcao}</p><p><strong>Status:</strong> {op.status}</p><p><strong>Empresa:</strong> {op.empresa}</p><p><strong>Prazo:</strong> {formatDateBR(op.prazoOperacional)}</p><p><strong>Comentário atendente:</strong> {op.comentarioAtendente ?? "-"}</p><p><strong>Comentário loja:</strong> {op.comentarioLoja ?? "-"}</p><p><strong>Reembolso:</strong> {formatCurrencyBR(op.valorReembolso as unknown as number)}</p><p><strong>CTE:</strong> {formatCurrencyBR(op.valorCte as unknown as number)}</p><p><strong>Coleta/envio/peças:</strong> {formatCurrencyBR(op.valorColetaEnvioPecas as unknown as number)}</p><p><strong>Código rastreio:</strong> {op.codigoRastreio ?? "-"}</p><p><strong>Criado em:</strong> {formatDateTimeBR(op.createdAt)}</p><p><strong>Atualizado em:</strong> {formatDateTimeBR(op.updatedAt)}</p><p><strong>Concluído em:</strong> {formatDateTimeBR(op.completedAt)}</p><p><strong>Anexos:</strong></p><ul>{op.anexos.map((a)=><li key={a.id}><a href={a.fileUrl ?? "#"} target="_blank">{a.fileName}</a> ({a.tipoAnexo})</li>)}</ul></div>)}</article> : null}

          <article className="card">
            <h2>Histórico de auditoria</h2>
            <ul>
              {(Array.isArray(ticket.auditoria) ? ticket.auditoria : []).map((item) => (
                <li key={item.id}>{formatDateTimeBR(item.dataHora)} — {formatEnumLabel(item.acao)} — {formatEnumLabel(item.campo)}</li>
              ))}
            </ul>
          </article>
        </>
      )}
    </section>
  );
}
