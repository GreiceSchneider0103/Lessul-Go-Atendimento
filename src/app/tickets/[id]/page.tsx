import { requireCurrentUser } from "@/lib/auth/require-user";
import Link from "next/link";
import { ArrowLeft, FileText, User, Package, Clock, Wallet, Paperclip, MessageSquare, type LucideIcon } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { getTicketById } from "@/lib/services/tickets-service";
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

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getAnexoFromTicket(
  ticketId: string,
  ticket: {
    anexoPath?: string | null;
    anexoUrl?: string | null;
    anexoNome?: string | null;
    anexoMimeType?: string | null;
  }
): AnexoTicket | null {
  if (!ticket.anexoPath && !ticket.anexoUrl) return null;

  return {
    url: `/api/tickets/${ticketId}/attachment/view`,
    nome: ticket.anexoNome ?? "Anexo",
    mimeType: ticket.anexoMimeType ?? null
  };
}

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <h2 className="ticket-section-title">
      <span className="ticket-section-icon">
        <Icon size={14} strokeWidth={2.5} aria-hidden />
      </span>
      {children}
    </h2>
  );
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
      className="inline-flex w-fit items-center gap-2.5"
    >
      {isImage ? (
        <img
          src={anexo.url}
          alt={anexo.nome ?? "Anexo do ticket"}
          className="h-14 w-14 rounded-[10px] border border-slate-200 object-cover"
        />
      ) : (
        <span className="flex h-14 w-14 items-center justify-center rounded-[10px] border border-slate-200 bg-slate-50 text-slate-500">
          <FileText size={22} strokeWidth={2} />
        </span>
      )}

      <span className="ticket-info-value font-semibold text-brand-700 hover:underline">Abrir anexo</span>
    </a>
  );
}

function ComentarioBubble({ comentario }: { comentario: ComentarioOperacional }) {
  const perfil = comentario.autorPerfil ?? "Usuário";

  return (
    <div
      className="rounded-xl border border-slate-200 p-3"
      style={{ background: perfil === "LOJA" ? "#f8fafc" : "#ffffff" }}
    >
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <strong>{comentario.autorNome ?? "Usuário"}</strong>
        <span className="muted">
          {perfil} • {toDateTime(comentario.criadoEm)}
        </span>
      </div>

      <div className="whitespace-pre-wrap text-sm">{comentario.comentario}</div>
    </div>
  );
}

export default async function TicketDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const { ticket, error } = await getTicket(id, user);

  if (error || !ticket) {
    throw new Error(error ?? "Ticket não encontrado");
  }

  const ticketComExtras = ticket as typeof ticket & {
    valorAssistencia?: unknown;
    valorColetaEnvioPecas?: unknown;
    valorRecuperado?: unknown;
    codigoRastreio?: string | null;
    statusOperacionalLoja?: string | null;
    comentariosOperacionais?: ComentarioOperacional[];
    anexoPath?: string | null;
    anexoUrl?: string | null;
    anexoNome?: string | null;
    anexoMimeType?: string | null;
  };

  const comentariosOperacionais = ticketComExtras.comentariosOperacionais ?? [];
  const anexo = getAnexoFromTicket(ticket.id, ticketComExtras);

  const backHref = user.perfil === "LOJA" ? "/loja/solicitacoes" : "/tickets";

  return (
    <section className="page">
      <Link href={backHref} className="ticket-back-link">
        <ArrowLeft size={15} strokeWidth={2.25} aria-hidden />
        Voltar
      </Link>

      <div className="ticket-hero">
        <div className="ticket-hero-main">
          <span className="ticket-hero-avatar">{getInitials(ticket.nomeCliente) || "?"}</span>

          <div className="ticket-hero-title">
            <h1>{ticket.nomeCliente}</h1>
            <p className="ticket-hero-meta">
              Pedido {ticket.numeroVenda} · {formatEnumLabel(ticket.empresa)} · {formatEnumLabel(ticket.canalMarketplace)}
            </p>
            <div className="ticket-hero-badges">
              <StatusBadge value={ticket.statusTicket} />
              <StatusBadge value={ticket.slaStatus} />
            </div>
          </div>
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
          <SectionTitle icon={User}>Dados do cliente</SectionTitle>

          <div className="ticket-info-list">
            <InfoRow label="Nome" value={ticket.nomeCliente} />
            <InfoRow label="CPF" value={ticket.cpf} />
            <InfoRow label="UF" value={ticket.uf} />
            <InfoRow label="Detalhes" value={ticket.detalhesCliente || "-"} />
          </div>
        </article>

        <article className="card">
          <SectionTitle icon={Package}>Dados do pedido</SectionTitle>

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
          <SectionTitle icon={Clock}>Reclamação e prazo</SectionTitle>

          <div className="ticket-info-list">
            <InfoRow label="Status da reclamação" value={<StatusBadge value={ticket.statusReclamacao} context="statusReclamacao" />} />
            <InfoRow label="Motivo" value={<StatusBadge value={ticket.motivo} context="motivo" />} />
            <InfoRow label="Resolução" value={ticket.resolucao ? formatEnumLabel(ticket.resolucao) : "-"} />
            <InfoRow
              label="Ação operacional da loja"
              value={
                ticketComExtras.statusOperacionalLoja === "DEVOLUCAO_RECEBIDA" ? (
                  <span className="badge badge-danger">Cobrança</span>
                ) : (
                  <StatusBadge value={ticket.acaoOperacionalLoja ?? "NENHUMA"} />
                )
              }
            />
            <InfoRow
              label="Status operacional da loja"
              value={ticketComExtras.statusOperacionalLoja ? <StatusBadge value={ticketComExtras.statusOperacionalLoja} /> : "-"}
            />
            <InfoRow label="Data da reclamação" value={toDate(ticket.dataReclamacao)} />
            <InfoRow label="Prazo de conclusão" value={toDate(ticket.prazoConclusao)} />
            <InfoRow label="Concluído em" value={toDateTime(ticket.concluidoEm)} />
          </div>
        </article>

        <article className="card">
          <SectionTitle icon={Paperclip}>Anexo do ticket</SectionTitle>

          <div className="ticket-info-list">
            <AttachmentPreview anexo={anexo} />
          </div>
        </article>
      </div>

      <article className="card ticket-values-panel">
        <SectionTitle icon={Wallet}>Valores e rastreabilidade</SectionTitle>

        <div className="ticket-stat-grid">
          <div className="ticket-stat">
            <span className="ticket-stat-label">Reembolso</span>
            <span className="ticket-stat-value">{toCurrency(ticket.valorReembolso)}</span>
          </div>

          <div className="ticket-stat">
            <span className="ticket-stat-label">Envio assistência</span>
            <span className="ticket-stat-value">{toCurrency(ticketComExtras.valorAssistencia)}</span>
          </div>

          <div className="ticket-stat">
            <span className="ticket-stat-label">Coleta, envio ou peças</span>
            <span className="ticket-stat-value">{toCurrency(ticketComExtras.valorColetaEnvioPecas)}</span>
          </div>

          <div className="ticket-stat">
            <span className="ticket-stat-label">Custo total</span>
            <span className="ticket-stat-value brand">{toCurrency(ticket.custosTotais)}</span>
          </div>

          <div className="ticket-stat">
            <span className="ticket-stat-label">Recuperado do marketplace</span>
            <span className="ticket-stat-value positive">{toCurrency(ticketComExtras.valorRecuperado)}</span>
          </div>
        </div>

        <div className="ticket-info-row" style={{ marginTop: 18 }}>
          <span className="ticket-info-label">Código de rastreio</span>
          <span className="ticket-info-value">{ticketComExtras.codigoRastreio || "Sem rastreio"}</span>
        </div>
      </article>

      <article className="card">
        <SectionTitle icon={MessageSquare}>Comentários</SectionTitle>

        <div className="mb-5">
          <h3 className="mb-2 text-sm font-semibold text-slate-500">Interno</h3>

          <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            {ticket.comentarioInterno || "Sem comentário interno."}
          </div>
        </div>

        <h3 className="mb-2 text-sm font-semibold text-slate-500">Operacionais</h3>

        {comentariosOperacionais.length ? (
          <div className="grid gap-2.5">
            {comentariosOperacionais.map((comentario) => (
              <ComentarioBubble key={comentario.id} comentario={comentario} />
            ))}
          </div>
        ) : (
          <p className="muted">Nenhum comentário operacional registrado.</p>
        )}
      </article>

      {hasPermission(user.perfil, "audit.read") ? (
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