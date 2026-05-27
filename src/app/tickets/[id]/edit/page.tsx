import { requireCurrentUser } from "@/lib/auth/require-user";
import { getTicketById, softDeleteTicket } from "@/lib/services/tickets-service";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { TicketForm } from "@/components/forms/ticket-form";
import { prisma } from "@/lib/db/prisma";
import { Perfil } from "@prisma/client";
import { TicketFormInput } from "@/lib/validation/ticket";
import { formatDateTimeBR, formatEnumLabel, formatDateBR, formatCurrencyBR } from "@/lib/formatters/display";

export default async function TicketEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser();
  const ticket = await getTicketById(id, user);

  if (!ticket) notFound();

  const assignableUsers = await prisma.usuario.findMany({
    where: { ativo: true, perfil: { in: ["ATENDENTE", "SUPERVISOR", "ADMIN"] } },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true }
  });

  const isLoja = user.perfil === Perfil.LOJA;
  const isAdmin = user.perfil === Perfil.ADMIN;

  // Prepare initial values for the form
  const initialValues: Partial<TicketFormInput> = {
    ...ticket as any,
    canalMarketplace: ticket.canalMarketplace as TicketFormInput['canalMarketplace'],
    dataCompra: ticket.dataCompra.toISOString().slice(0, 10),
    dataReclamacao: ticket.dataReclamacao.toISOString().slice(0, 10),
    prazoConclusao: ticket.prazoConclusao?.toISOString().slice(0, 10) ?? "",
    valorReembolso: Number(ticket.valorReembolso),
    valorColeta: Number(ticket.valorColeta),
    valorAssistencia: Number(ticket.valorAssistencia),
    valorColetaEnvioPecas: Number(ticket.valorColetaEnvioPecas),
    // Comentários e anexo não são mais passados para o form principal
    comentarioLoja: ticket.comentarioLoja ?? "", // Mantido para compatibilidade com o schema, mas não renderizado
    comentarioInterno: ticket.comentarioInterno ?? "", // Mantido para compatibilidade com o schema, mas não renderizado
    codigoRastreio: ticket.codigoRastreio ?? "",
    linkPedido: ticket.linkPedido ?? "",
    fabricante: ticket.fabricante ?? "",
    transportadora: ticket.transportadora ?? "",
    detalhesCliente: ticket.detalhesCliente ?? "",
    responsavelId: ticket.responsavelId ?? "",
    resolucao: ticket.resolucao ?? ""
  };

  const ticketAttachment = ticket.anexoUrl ? {
    fileUrl: ticket.anexoUrl,
    fileName: ticket.anexoNome,
    filePath: ticket.anexoPath,
    mimeType: ticket.anexoMimeType,
    sizeBytes: ticket.anexoSizeBytes ? Number(ticket.anexoSizeBytes) : null,
    uploadedAt: ticket.anexoUploadedAt?.toISOString() ?? null,
    uploadedBy: ticket.anexoUploadedBy ?? null
  } : undefined;

  return (
    <section className="page ticket-edit-page">
      {/* 1. Botões do Topo e Título */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <Link href={`/tickets/${id}`} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            ← Voltar para o Ticket
          </Link>
          
          <div style={{ display: "flex", gap: 8 }}>
            <Link href={`/tickets/${id}`} className="btn btn-secondary" style={{ height: '42px', display: 'flex', alignItems: 'center', padding: '0 20px' }}>
              Cancelar
            </Link>
            {!isLoja && ( // Only ADMIN/SUPERVISOR/ATENDENTE can delete
              <form action={async () => { "use server"; await softDeleteTicket(id, user); redirect("/tickets"); }}>
                <button className="btn btn-danger" style={{ height: '42px', padding: '0 20px' }}>
                  Excluir ticket
                </button>
              </form>
            )}
          </div>
        </div>
        <h1 style={{ margin: '24px 0 0 0' }}>Editar Ticket: {ticket.nomeCliente}</h1>
        <p className="muted">ID: {ticket.id}</p>
      </div>

      {/* 5. Layout principal do formulário e lateral direita */}
      <div className="ticket-edit-layout" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
        {/* Formulário principal (esquerda) */}
        <div style={{ gridColumn: '1 / -1' }}> {/* Default to full width on mobile */}
          <TicketForm
            ticketId={id}
            initialValues={initialValues}
            canEditSensitive={!isLoja} // LOJA cannot edit sensitive fields
            assignableUsers={assignableUsers}
            cancelHref={`/tickets/${id}`}
            userPerfil={user.perfil}
          />
        </div>

        {/* Lateral direita (sidebar) */}
        <div className="ticket-sidebar" style={{ gridColumn: '1 / -1' }}> {/* Default to full width on mobile */}
          {/* 4. Anexo como miniatura */}
          <article className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: 12, marginBottom: 16 }}>📎 Anexo do Ticket</h3>
            {ticketAttachment?.fileUrl ? (
              <div style={{ textAlign: 'center' }}>
                {ticketAttachment.mimeType?.startsWith('image/') ? (
                  <img
                    src={ticketAttachment.fileUrl}
                    alt={ticketAttachment.fileName || "Anexo"}
                    style={{ maxWidth: '100%', maxHeight: 72, borderRadius: 8, marginBottom: 12, objectFit: 'contain', border: '1px solid #eee' }}
                  />
                ) : (
                  <div style={{
                    width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: '#f8f9fa', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, fontWeight: 'bold', color: ticketAttachment.mimeType === "application/pdf" ? '#d32f2f' : '#666'
                  }}>
                    {ticketAttachment.mimeType === "application/pdf" ? "PDF" : "FILE"}
                  </div>
                )}
                <a href={ticketAttachment.fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-link btn-sm" title={ticketAttachment.fileName ?? "Ver anexo"}>
                  {ticketAttachment.fileName ?? "Ver anexo"}
                </a>
                <p className="muted" style={{ fontSize: '0.75rem', marginTop: 8 }}>
                  Enviado por {ticketAttachment.uploadedBy} em {ticketAttachment.uploadedAt ? formatDateBR(new Date(ticketAttachment.uploadedAt)) : '-'}
                </p>
              </div>
            ) : (
              <p className="muted" style={{ textAlign: 'center', padding: '20px 0' }}>Nenhum anexo disponível.</p>
            )}
          </article>

          {/* 6. Comentário interno */}
          <article className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: 12, marginBottom: 16 }}>📝 Notas Internas</h3>
            <div style={{ padding: 16, backgroundColor: '#f1f5f9', borderRadius: 8, minHeight: 100 }}>
              {ticket.comentarioInterno ? (
                <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{ticket.comentarioInterno}</p>
              ) : (
                <p className="muted" style={{ fontStyle: 'italic' }}>Nenhuma nota interna disponível para este ticket.</p>
              )}
            </div>
          </article>

          {/* 6. Comentários operacionais em estilo chat */}
          <article className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: 12, marginBottom: 16 }}>💬 Conversa Operacional</h3>
            <div style={{ maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {ticket.comentariosOperacionais.length === 0 ? (
                <p className="muted" style={{ textAlign: 'center', padding: '20px 0' }}>Nenhum comentário registrado.</p>
              ) : ticket.comentariosOperacionais.map(c => {
                const isAutorLoja = c.autorPerfil === Perfil.LOJA;
                const avatarBg = isAutorLoja ? '#0891b2' : '#2563eb';
                const messageBg = isAutorLoja ? 'white' : '#dbeafe';
                const messageBorder = isAutorLoja ? '1px solid #e2e8f0' : '1px solid #bfdbfe';

                return (
                  <div
                    key={c.id}
                    style={{
                      alignSelf: isAutorLoja ? 'flex-start' : 'flex-end',
                      maxWidth: '90%',
                      display: 'flex',
                      gap: 8,
                      flexDirection: isAutorLoja ? 'row' : 'row-reverse'
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', backgroundColor: avatarBg,
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 600, flexShrink: 0
                    }}>
                      {c.autorNome?.substring(0, 2).toUpperCase()}
                    </div>
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: 12,
                      backgroundColor: messageBg,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      border: messageBorder
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
                        <strong style={{ fontSize: '0.85rem' }}>{c.autorNome} <span className="muted" style={{ fontWeight: 400 }}>({c.autorPerfil})</span></strong>
                        <small className="muted" style={{ fontSize: '0.7rem' }}>{formatDateTimeBR(c.criadoEm)}</small>
                      </div>
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.4, fontSize: '0.9rem' }}>{c.comentario}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          {/* 2. Histórico lateral recolhível (Auditoria) */}
          {isAdmin && (
            <details className="panel" style={{ marginTop: 24, cursor: 'pointer' }}>
              <summary style={{ fontWeight: 700, fontSize: '1.1rem', padding: '10px 0' }}>
                🔍 Histórico de Alterações (Auditoria)
              </summary>
              <div className="table-wrap" style={{ marginTop: 16, maxHeight: 400, overflowY: 'auto' }}>
                <table className="table table-sm" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>Data/Hora</th>
                      <th>Ação</th>
                      <th>Campo</th>
                      <th>Antigo</th>
                      <th>Novo</th>
                      <th>Usuário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticket.auditoria?.map((log) => (
                      <tr key={log.id}>
                        <td>{formatDateTimeBR(log.dataHora)}</td>
                        <td><span className="badge">{log.acao}</span></td>
                        <td><code>{log.campo}</code></td>
                        <td className="muted" style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.valorAntigo || '-'}</td>
                        <td style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.valorNovo || '-'}</td>
                        <td>{log.usuarioId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      </div>
    </section>
  );
}