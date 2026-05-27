import { requireCurrentUser } from "@/lib/auth/require-user";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { getTicketById } from "@/lib/services/tickets-service";
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/rbac/permissions";
import { TicketDeleteButton } from "@/components/tickets/ticket-delete-button";
import { formatCurrencyBR, formatDateBR, formatDateTimeBR, formatEnumLabel } from "@/lib/formatters/display";
import type { ReactNode } from "react";

type CurrentUser = Awaited<ReturnType<typeof requireCurrentUser>>;

type ComentarioOperacional = {
  id: string;
  autorNome?: string | null;
  autorPerfil?: string | null;
  criadoEm: Date | string;
  comentario: string;
};

type AnexoTicket = {
  url: string | null;
  nome: string | null;
  mimeType: string | null;
};

async function getTicket(id: string, user: CurrentUser) {
  try {
    const ticket = await getTicketById(id, user);
    return { ticket, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar ticket";
    return { ticket: null, error: message };
  }
}

function toCurrency(value: unknown) {
  return formatCurrencyBR(Number(value ?? 0));
}

function toDate(value: Date | string | null | undefined) {
  return value ? formatDateBR(value) : "-";
}

function toDateTime(value: Date | string | null | undefined) {
  return value ? formatDateTimeBR(value) : "-";
}

function getAcaoOperacionalLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    NENHUMA: "Nenhuma",
    ASSISTENCIA: "Assistência",
    COLETA: "Coleta",
    DEVOLUCAO: "Devolução",
    REEMBOLSO: "Reembolso"
  };

  return labels[value ?? "NENHUMA"] ?? formatEnumLabel(value ?? "NENHUMA");
}

function getAnexoFromTicket(ticket: {
  anexoUrl?: string | null;
  anexoNome?: string | null;
  anexoMimeType?: string | null;
}): AnexoTicket | null {
  if (!ticket.anexoUrl) return null;

  return {
    url: ticket.anexoUrl,
    nome: ticket.anexoNome ?? "Anexo",
    mimeType: ticket.anexoMimeType ?? null
  };
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="ticket-info-row">
      <span className="ticket-info-label">{label}</span>
      <span className="ticket-info-value">{value || "—"}</span>
    </div>
  );
}

function AttachmentPreview({ anexo }: { anexo: AnexoTicket | null }) {
  if (!anexo?.url) {
    return <span className="muted">Sem anexo.</span>;
  }

  const isImage = anexo.mimeType?.startsWith("image/");

  return (
    <a
      href={anexo.url}
      target="_blank"
      rel="noopener noreferrer"
      title={anexo.nome ?? "Abrir anexo"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        width: "fit-content"
      }}
    >
      {isImage ? (
        <img
          src={anexo.url}
          alt={anexo.nome ?? "Anexo do ticket"}
          style={{
            width: 56,
            height: 56,
            objectFit: "cover",
            borderRadius: 10,
            border: "1px solid #dbe1ea"
          }}
        />
      ) : (
        <span
          style={{
            width: 56,
            height: 56,
            borderRadius: 10,
            border: "1px solid #dbe1ea",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f8fafc",
            fontWeight: 700
          }}
        >
          PDF
        </span>
      )}

      <span className="ticket-info-value">Abrir anexo</span>
    </a>
  );
}

function ComentarioBubble({ comentario }: { comentario: ComentarioOperacional }) {
  const perfil = comentario.autorPerfil ?? "Usuário";

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 12,
        background: perfil === "LOJA" ? "#f8fafc" : "#ffffff"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <strong>{comentario.autorNome ?? "Usuário"}</strong>
        <span className="muted">
          {perfil} • {toDateTime(comentario.criadoEm)}
        </span>
      </div>
      <div style={{ whiteSpace: "pre-wrap" }}>{comentario.comentario}</div>
    </div>
  );
}

export default async function TicketDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const { ticket, error } = await getTicket(id, user);

  const operacionais = ticket
    ? await prisma.operationalRequest.findMany({
        where: { ticketId: ticket.id },
        include: { anexos: true },
        orderBy: { createdAt: "desc" }
      })
    : [];

  if (error || !ticket) {
    throw new Error(error ?? "Ticket não encontrado"); // Deixe o Next.js lidar com error.tsx
  }

  // Sugestão: Tipar o retorno do getTicketById corretamente no service 
  // para evitar o cast 'as typeof ticket & ...'
  const ticketComExtras = ticket as typeof ticket & {
    valorAssistencia?: unknown;
    valorColetaEnvioPecas?: unknown;
    codigoRastreio?: string | null;
    statusOperacionalLoja?: string | null;
    comentarioLoja?: string | null;
    comentariosOperacionais?: ComentarioOperacional[];
    anexoUrl?: string | null;
    anexoNome?: string | null;
    anexoMimeType?: string | null;
  };

  const comentariosOperacionais = ticketComExtras.comentariosOperacionais ?? [];
  const anexo = getAnexoFromTicket(ticketComExtras);

  return (
    <section className="page">
      <Link href="/tickets" className="ticket-back-link">
        ← Voltar para tickets
      </Link>

      <div className="ticket-detail-header">
        <div>
          <h1>Detalhe do ticket</h1>
          <p className="muted">Informações completas e histórico de auditoria.</p>
        </div>

        <div className="ticket-detail-actions">
          <Link className="btn btn-primary" href={`/tickets/${id}/edit`}>
            Editar ticket
          </Link>

          {hasPermission(user.perfil, "ticket.soft_delete") ? <TicketDeleteButton ticketId={id} /> : null}
        </div>
      </div>

      <div className="ticket-detail-grid">
        <article className="card">
          <div style={{ display: 'grid', gap: '24px' }}>
            <section>
              <h2 style={{ marginTop: 0 }}>Dados do cliente</h2>
              <div className="ticket-info-list">
                <InfoRow label="Nome" value={ticket.nomeCliente} />
                <InfoRow label="CPF" value={ticket.cpf} />
                <InfoRow label="UF" value={ticket.uf} />
                <InfoRow label="Detalhes" value={ticket.detalhesCliente || "-"} />
              </div>
            </section>

            <section style={{ paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
              <h2>Valores e rastreabilidade</h2>
              <div className="ticket-info-list">
                <InfoRow label="Reembolso" value={toCurrency(ticket.valorReembolso)} />
                <InfoRow label="Valor de assistência" value={toCurrency(ticketComExtras.valorAssistencia)} />
                <InfoRow label="Coleta, envio ou peças" value={toCurrency(ticketComExtras.valorColetaEnvioPecas ?? ticket.valorColeta)} />
                <InfoRow label="Código de rastreio" value={ticketComExtras.codigoRastreio || "Sem rastreio"} />
                <InfoRow label="Custos totais" value={<strong>{toCurrency(ticket.custosTotais)}</strong>} />
              </div>
            </section>
          </div>
        </article>

        <article className="card">
          <h2>Dados do pedido</h2>

          <div className="ticket-info-list">
            <InfoRow label="Número da venda" value={ticket.numeroVenda} />

            <InfoRow
              label="Pedido no marketplace"
              value={
                ticket.linkPedido ? (
                  <a className="btn btn-secondary" href={ticket.linkPedido} target="_blank" rel="noopener noreferrer">
                    Abrir pedido
                  </a>
                ) : (
                  "Sem link do pedido"
                )
              }
            />

            <InfoRow label="Data da compra" value={toDate(ticket.dataCompra)} />
            <InfoRow label="Marketplace" value={formatEnumLabel(ticket.canalMarketplace)} />
            <InfoRow label="Empresa" value={formatEnumLabel(ticket.empresa)} />
            <InfoRow label="Produto" value={ticket.produto} />
            <InfoRow label="SKU" value={ticket.sku} />
          </div>
        </article>

        <article className="card">
          <h2>Reclamação e prazo</h2>

          <div className="ticket-info-list">
            <InfoRow label="Status do ticket" value={<StatusBadge value={ticket.statusTicket} />} />
            <InfoRow label="Status da reclamação" value={<StatusBadge value={ticket.statusReclamacao} context="statusReclamacao" />} />
            <InfoRow label="Motivo" value={<StatusBadge value={ticket.motivo} context="motivo" />} />
            <InfoRow label="Resolução" value={ticket.resolucao ? formatEnumLabel(ticket.resolucao) : "-"} />
            <InfoRow label="Ação operacional da loja" value={getAcaoOperacionalLabel(ticket.acaoOperacionalLoja)} />
            <InfoRow label="Data da reclamação" value={toDate(ticket.dataReclamacao)} />
            <InfoRow label="Prazo de conclusão" value={toDate(ticket.prazoConclusao)} />
            <InfoRow label="SLA" value={<StatusBadge value={ticket.slaStatus} />} />
          </div>
        </article>

        <article className="card">
          <h2>Anexo do ticket</h2>

          <div className="ticket-info-list">
            <AttachmentPreview anexo={anexo} />
          </div>
        </article>
      </div>

      <article className="card">
        <h2>Comentários</h2>
        
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>Interno</h3>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#f8fafc", whiteSpace: "pre-wrap" }}>
            {ticket.comentarioInterno || "Sem comentário interno."}
          </div>
        </div>

        <h3 style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>Operacionais</h3>
        {comentariosOperacionais.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {comentariosOperacionais.map((comentario) => (
              <ComentarioBubble key={comentario.id} comentario={comentario} />
            ))}
          </div>
        ) : (
          <p className="muted">Nenhum comentário operacional registrado.</p>
        )}
      </article>

      {operacionais.length ? (
        <article className="card">
          <h2>Solicitação operacional da loja</h2>

          <div className="ticket-detail-grid">
            {operacionais.map((op) => (
              <div
                key={op.id}
                style={{
                  border: "1px solid #e2e8f0",
                  padding: 14,
                  borderRadius: 12,
                  background: "#f8fafc"
                }}
              >
                <div className="ticket-info-list">
                  <InfoRow label="Tipo" value={formatEnumLabel(op.tipoAcao)} />
                  <InfoRow label="Status" value={formatEnumLabel(op.status)} />
                  <InfoRow label="Empresa" value={formatEnumLabel(op.empresa)} />
                  <InfoRow label="Prazo" value={toDate(op.prazoOperacional)} />
                  <InfoRow label="Comentário atendente" value={op.comentarioAtendente ?? "-"} />
                  <InfoRow label="Comentário loja" value={op.comentarioLoja ?? "-"} />
                  <InfoRow label="Reembolso" value={toCurrency(op.valorReembolso)} />
                  <InfoRow label="CTE" value={toCurrency(op.valorCte)} />
                  <InfoRow label="Coleta/envio/peças" value={toCurrency(op.valorColetaEnvioPecas)} />
                  <InfoRow label="Código rastreio" value={op.codigoRastreio ?? "-"} />
                  <InfoRow label="Criado em" value={toDateTime(op.createdAt)} />
                  <InfoRow label="Atualizado em" value={toDateTime(op.updatedAt)} />
                  <InfoRow label="Concluído em" value={toDateTime(op.completedAt)} />

                  <InfoRow
                    label="Anexos antigos"
                    value={
                      op.anexos.length ? (
                        <div style={{ display: "grid", gap: 6 }}>
                          {op.anexos.map((a) => (
                            <a key={a.id} href={a.fileUrl ?? "#"} target="_blank" rel="noopener noreferrer">
                              {a.fileName} ({formatEnumLabel(a.tipoAnexo)})
                            </a>
                          ))}
                        </div>
                      ) : (
                        "-"
                      )
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {user.perfil === "ADMIN" ? (
        <details className="audit-accordion">
          <summary>
            <span>Histórico de auditoria</span>
            <span className="muted">Clique para expandir</span>
          </summary>

          <div className="audit-content">
            {Array.isArray(ticket.auditoria) && ticket.auditoria.length ? (
              <ul>
                {ticket.auditoria.map((item) => (
                  <li key={item.id}>
                    {formatDateTimeBR(item.dataHora)} — {formatEnumLabel(item.acao)} — {formatEnumLabel(item.campo)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Nenhum histórico de auditoria registrado.</p>
            )}
          </div>
        </details>
      ) : null}
    </section>
  );
}