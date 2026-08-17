"use client";
import { useState } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { Perfil, StatusOperacional } from "@prisma/client";
import { formatDateBR, formatEnumLabel } from "@/lib/formatters/display";

type Row = { 
  id: string; 
  empresa: string; 
  ticketId: string; 
  tipoAcao: string; 
  status: StatusOperacional; 
  prazoOperacional: string | null; 
  updatedAt: string; 
  comentarioLoja: string | null; 
  comentarioAtendente: string | null; 
  codigoRastreio: string | null; 
  valorReembolso: number;
  valorAssistencia?: number;
  valorColetaEnvioPecas: number; 
  ticket: { 
    nomeCliente: string; 
    numeroVenda: string; 
    linkPedido: string | null;
    produto: string;
    sku: string;
    detalhesCliente: string | null;
    resolucao: string | null;
    acaoOperacionalLoja: string;
    statusOperacionalLoja: string;
    comentarioLoja: string | null;
  }; 
  anexo?: { fileUrl: string | null; fileName?: string; filePath?: string | null; mimeType?: string | null } 
};

const statusOptions = ["EM_ABERTO","ASSISTENCIA_ENVIADA","ASSISTENCIA_A_CAMINHO","ASSISTENCIA_ENTREGUE","COLETA_SOLICITADA","COLETA_FEITA","DEVOLUCAO_SOLICITADA","DEVOLUCAO_A_CAMINHO","DEVOLUCAO_RECEBIDA","DEVOLUCAO_REALIZADA","REEMBOLSO_PENDENTE","REEMBOLSO_REALIZADO","AGUARDANDO_ATENDENTE","CONCLUIDA"];
const resolucoesOptions = ["ASSISTENCIA", "DEVOLUCAO", "REEMBOLSO", "RESOLVIDO"];
const acoesOptions = ["NENHUMA", "ASSISTENCIA", "COLETA", "DEVOLUCAO", "REEMBOLSO"];

export function OperationalRequestsPanel({ data, perfil }: { data: Row[]; perfil: Perfil }) {
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [rows, setRows] = useState<Row[]>(data);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    // Escuta atualizações vindas de outras abas/componentes (ex: Tickets) para sincronizar exibição
    try {
      const bc = new BroadcastChannel("tickets-updates");

      bc.onmessage = (ev) => {
        const msg = ev.data;
        if (!msg || msg.type !== "status_change") return;

        const { ticketId, newStatus } = msg as { ticketId?: string; newStatus?: string };
        if (!ticketId) return;

        // Se ticket foi concluído, remove da listagem atual (padrão não mostra concluídos)
        if (newStatus === "CONCLUIDO") {
          setRows((prev) => prev.filter((r) => r.ticketId !== ticketId));
        } else {
          // Caso contrário, atualiza o status operacional do ticket quando disponível
          setRows((prev) =>
            prev.map((r) => (r.ticketId === ticketId ? { ...r, ticket: { ...r.ticket, statusOperacionalLoja: msg.newOperacionalStatus ?? r.ticket.statusOperacionalLoja } } : r))
          );
        }
      };

      return () => bc.close();
    } catch {
      // BroadcastChannel pode não estar disponível em alguns ambientes; falhar silenciosamente
    }
  }, []);

  const renderAnexoThumbnail = (row: Row) => {
    if (!row.anexo) return <span style={{ color: '#999', fontSize: '0.85rem' }}>Sem anexo</span>;

    const isImage = row.anexo.mimeType?.startsWith("image/");
    const isPDF = row.anexo.mimeType === "application/pdf";
    const attachmentViewUrl = `/api/tickets/${row.ticketId}/attachment/view`;

    return (
      <a href={attachmentViewUrl} target="_blank" rel="noopener noreferrer" title="Ver anexo">
        {isImage ? (
          <img 
            src={attachmentViewUrl} 
            alt="Anexo" 
            style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd' }}
          />
        ) : (
          <div style={{ 
            width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', 
            background: '#f8f9fa', borderRadius: 4, border: '1px solid #ddd', fontSize: 10, fontWeight: 'bold', color: isPDF ? '#d32f2f' : '#666'
          }}>
            {isPDF ? "PDF" : "FILE"}
          </div>
        )}
      </a>
    );
  };

  const handleSaveDrawer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedRow) return;

    setIsSaving(true);
    setNotice(null);
    try {
      const fd = new FormData(e.currentTarget);
      const payload = Object.fromEntries(fd.entries());
      
      // Objetivo 2: Concluir ticket automaticamente se statusOperacionalLoja for REEMBOLSO_REALIZADO ou ASSISTENCIA_ENTREGUE
      if (payload.statusOperacionalLoja === "REEMBOLSO_REALIZADO" || payload.statusOperacionalLoja === "ASSISTENCIA_ENTREGUE") {
        payload.statusTicket = "CONCLUIDO";
      }

      if (payload.statusOperacionalLoja === "DEVOLUCAO_RECEBIDA" && !selectedRow.anexo) {
        setNotice({ type: "error", message: "Anexe uma foto do produto recebido antes de marcar como devolução recebida." });
        setIsSaving(false);
        return;
      }

      // Remove empty strings
      Object.keys(payload).forEach(key => {
        if (payload[key] === "") delete payload[key];
      });

      const response = await fetch(`/api/tickets/${selectedRow.ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setNotice({ type: "error", message: body?.message ?? "Falha ao atualizar os dados." });
        return;
      }

      const updatedTicket = await response.json();
      setRows((current) => current.map((row) => row.ticketId === selectedRow.ticketId ? {
        ...row,
        status: updatedTicket.statusOperacionalLoja ?? row.status,
        codigoRastreio: updatedTicket.codigoRastreio ?? null,
        valorReembolso: Number(updatedTicket.valorReembolso ?? row.valorReembolso),
        valorAssistencia: Number(updatedTicket.valorAssistencia ?? row.valorAssistencia ?? 0),
        valorColetaEnvioPecas: Number(updatedTicket.valorColetaEnvioPecas ?? row.valorColetaEnvioPecas),
        ticket: { ...row.ticket, ...updatedTicket }
      } : row));
      setNotice({ type: "success", message: "Dados salvos com sucesso!" });
      setSelectedRow(null);
    } catch (error) {
      setNotice({ type: "error", message: "Erro ao salvar: " + (error instanceof Error ? error.message : String(error)) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadAttachment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedRow) return;

    const file = (e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement)?.files?.[0];
    if (!file) {
      setNotice({ type: "error", message: "Selecione um arquivo." });
      return;
    }

    setNotice(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      
      const response = await fetch(`/api/tickets/${selectedRow.ticketId}/attachment`, {
        method: "POST",
        body: fd
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setNotice({ type: "error", message: body?.message ?? "Falha no upload." });
        return;
      }

      const body = await response.json() as { data: { anexoUrl?: string | null; anexoNome?: string | null; anexoPath?: string | null; anexoMimeType?: string | null } };
      const anexo = {
        fileUrl: body.data.anexoUrl ?? null,
        fileName: body.data.anexoNome ?? file.name,
        filePath: body.data.anexoPath ?? null,
        mimeType: body.data.anexoMimeType ?? file.type
      };
      setRows((current) => current.map((row) => row.ticketId === selectedRow.ticketId ? { ...row, anexo } : row));
      setNotice({ type: "success", message: "Anexo enviado com sucesso!" });
      setSelectedRow(null);
    } catch (error) {
      setNotice({ type: "error", message: "Erro no upload: " + (error instanceof Error ? error.message : String(error)) });
    }
  };

  return (
    <>
      {notice ? (
        <div
          role={notice.type === "error" ? "alert" : "status"}
          className={notice.type === "error" ? "field-error" : undefined}
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 8,
            border: `1px solid ${notice.type === "error" ? "#fecaca" : "#bbf7d0"}`,
            background: notice.type === "error" ? "#fff1f2" : "#f0fdf4",
            color: notice.type === "error" ? "#b42318" : "#166534"
          }}
        >
          {notice.message}
        </div>
      ) : null}
      <div className="panel table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Ticket</th>
              <th>Cliente</th>
              <th>Pedido</th>
              <th>Ação</th>
              <th>Status</th>
              <th>Prazo</th>
              <th>Anexo</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isAtrasado = row.prazoOperacional && new Date(row.prazoOperacional) < new Date() && row.status !== "CONCLUIDA";
              
              return (
                <tr key={row.id}>
                  <td>{formatEnumLabel(row.empresa)}</td>
                  <td><Link href={`/tickets/${row.ticketId}`} className="link">Ver Ticket</Link></td>
                  <td>{row.ticket.nomeCliente}</td>
                  <td>
                    {row.ticket.linkPedido ? (
                      <a href={row.ticket.linkPedido} target="_blank" rel="noopener noreferrer" className="link">
                        {row.ticket.numeroVenda}
                      </a>
                    ) : row.ticket.numeroVenda}
                  </td>
                  <td><span className="badge">{formatEnumLabel(row.tipoAcao)}</span></td>
                  <td>{formatEnumLabel(row.status)}</td>
                  <td>
                    {row.prazoOperacional ? (
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        fontSize: '0.85rem',
                        fontWeight: '500',
                        backgroundColor: isAtrasado ? '#fff1f0' : '#f6ffed', 
                        color: isAtrasado ? '#cf1322' : '#389e0d',
                        border: `1px solid ${isAtrasado ? '#ffa39e' : '#b7eb8f'}`
                      }}>
                        {formatDateBR(new Date(row.prazoOperacional))}
                      </span>
                    ) : '-'}
                  </td>
                  <td>{renderAnexoThumbnail(row)}</td>
                  <td>
                    <button 
                      className="btn btn-sm" 
                      onClick={() => setSelectedRow(row)}
                    >
                      Ações
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Overlay */}
      {selectedRow && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 999,
            cursor: "pointer"
          }}
          onClick={() => setSelectedRow(null)}
        />
      )}

      {/* Drawer */}
      {selectedRow && (
        <div
          style={{
            position: "fixed",
            right: 0,
            top: 0,
            height: "100vh",
            width: "420px",
            backgroundColor: "white",
            borderLeft: "1px solid #e2e8f0",
            boxShadow: "-2px 0 8px rgba(0, 0, 0, 0.1)",
            zIndex: 1000,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column"
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              position: "sticky",
              top: 0,
              backgroundColor: "white",
              zIndex: 1001
            }}
          >
            <h3 style={{ margin: 0, fontSize: "18px" }}>Dados Complementares</h3>
            <button
              type="button"
              onClick={() => setSelectedRow(null)}
              style={{
                background: "none",
                border: "none",
                fontSize: "24px",
                cursor: "pointer",
                color: "#666",
                padding: 0,
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div style={{ flex: 1, padding: "16px", overflowY: "auto" }}>
            <form onSubmit={handleSaveDrawer} style={{ display: "grid", gap: "12px" }}>
              {/* Client Info */}
              <fieldset style={{ border: "1px solid #e2e8f0", padding: "12px", borderRadius: "4px" }}>
                <legend style={{ paddingInline: "4px", fontSize: "0.85rem", fontWeight: "bold", color: "#666" }}>
                  Informações do Cliente
                </legend>
                <div style={{ display: "grid", gap: "8px" }}>
                  <div style={{ fontSize: "0.9rem" }}>
                    <strong>Cliente:</strong> {selectedRow.ticket.nomeCliente}
                  </div>
                  <div style={{ fontSize: "0.9rem" }}>
                    <strong>Número do Pedido:</strong>
                    {selectedRow.ticket.linkPedido ? (
                      <a 
                        href={selectedRow.ticket.linkPedido} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ marginLeft: "8px" }}
                        className="link"
                      >
                        {selectedRow.ticket.numeroVenda}
                      </a>
                    ) : (
                      <span style={{ marginLeft: "8px" }}>{selectedRow.ticket.numeroVenda}</span>
                    )}
                  </div>
                </div>
              </fieldset>

              {/* Product Info */}
              <fieldset style={{ border: "1px solid #e2e8f0", padding: "12px", borderRadius: "4px" }}>
                <legend style={{ paddingInline: "4px", fontSize: "0.85rem", fontWeight: "bold", color: "#666" }}>
                  Informações do Produto
                </legend>
                <div style={{ display: "grid", gap: "8px" }}>
                  <div style={{ fontSize: "0.9rem" }}>
                    <strong>SKU:</strong> {selectedRow.ticket.sku}
                  </div>
                  <div style={{ fontSize: "0.9rem" }}>
                    <strong>Produto:</strong> {selectedRow.ticket.produto}
                  </div>
                </div>
              </fieldset>

              {/* Attachment */}
              <fieldset style={{ border: "1px solid #e2e8f0", padding: "12px", borderRadius: "4px" }}>
                <legend style={{ paddingInline: "4px", fontSize: "0.85rem", fontWeight: "bold", color: "#666" }}>
                  Anexo
                </legend>
                {selectedRow.anexo ? (
                  <div style={{ marginBottom: "8px", textAlign: "center" }}>
                    {selectedRow.anexo.mimeType?.startsWith("image/") ? (
                      <img 
                        src={`/api/tickets/${selectedRow.ticketId}/attachment/view`}
                        alt="Anexo"
                        style={{ maxWidth: "100%", maxHeight: "200px", borderRadius: "4px", border: "1px solid #e2e8f0" }}
                      />
                    ) : selectedRow.anexo.mimeType === "application/pdf" ? (
                      <div style={{
                        padding: "24px",
                        backgroundColor: "#f8f9fa",
                        borderRadius: "4px",
                        border: "1px solid #e2e8f0",
                        fontSize: "48px",
                        color: "#d32f2f"
                      }}>
                        📄
                      </div>
                    ) : (
                      <div style={{
                        padding: "24px",
                        backgroundColor: "#f8f9fa",
                        borderRadius: "4px",
                        border: "1px solid #e2e8f0"
                      }}>
                        Arquivo: {selectedRow.anexo.fileName}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: "0.9rem", color: "#999", marginBottom: "8px" }}>
                    Sem anexo
                  </div>
                )}
              </fieldset>

              {/* Details */}
              <label style={{ fontSize: "0.9rem", fontWeight: "500" }}>
                Detalhes do Cliente
                <textarea
                  name="detalhesCliente"
                  defaultValue={selectedRow.ticket.detalhesCliente ?? ""}
                  rows={3}
                  placeholder="Observações sobre o cliente..."
                  style={{
                    width: "100%",
                    padding: "8px",
                    marginTop: "4px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "4px",
                    fontFamily: "inherit",
                    fontSize: "0.9rem"
                  }}
                />
              </label>

              {/* Commentary */}
              <label style={{ fontSize: "0.9rem", fontWeight: "500" }}>
                Comentário da Loja
                <textarea
                  name="comentarioLoja"
                  defaultValue={selectedRow.ticket.comentarioLoja ?? ""}
                  rows={3}
                  placeholder="Observações da loja..."
                  style={{
                    width: "100%",
                    padding: "8px",
                    marginTop: "4px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "4px",
                    fontFamily: "inherit",
                    fontSize: "0.9rem"
                  }}
                />
              </label>

              {/* Action */}
              <label style={{ fontSize: "0.9rem", fontWeight: "500" }}>
                Ação Operacional da Loja
                <select
                  name="acaoOperacionalLoja"
                  defaultValue={selectedRow.ticket.acaoOperacionalLoja}
                  style={{
                    width: "100%",
                    padding: "8px",
                    marginTop: "4px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "4px",
                    fontSize: "0.9rem"
                  }}
                >
                  {acoesOptions.map((opcao) => (
                    <option key={opcao} value={opcao}>
                      {formatEnumLabel(opcao)}
                    </option>
                  ))}
                </select>
              </label>

              {/* Resolution */}
              <label style={{ fontSize: "0.9rem", fontWeight: "500" }}>
                Resolução
                <select
                  name="resolucao"
                  defaultValue={selectedRow.ticket.resolucao ?? ""}
                  style={{
                    width: "100%",
                    padding: "8px",
                    marginTop: "4px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "4px",
                    fontSize: "0.9rem"
                  }}
                >
                  <option value="">Sem resolução</option>
                  {resolucoesOptions.map((opcao) => (
                    <option key={opcao} value={opcao}>
                      {formatEnumLabel(opcao)}
                    </option>
                  ))}
                </select>
              </label>

              {/* Status */}
              <label style={{ fontSize: "0.9rem", fontWeight: "500" }}>
                Status Operacional da Loja
                <select
                  name="statusOperacionalLoja"
                  defaultValue={selectedRow.ticket.statusOperacionalLoja}
                  style={{
                    width: "100%",
                    padding: "8px",
                    marginTop: "4px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "4px",
                    fontSize: "0.9rem"
                  }}
                >
                  {statusOptions.map((status) => (
                    <option
                      key={status}
                      value={status}
                      disabled={perfil === Perfil.LOJA && status === "CONCLUIDA"}
                    >
                      {formatEnumLabel(status)}
                    </option>
                  ))}
                </select>
              </label>

              {/* Tracking Code */}
              <label style={{ fontSize: "0.9rem", fontWeight: "500" }}>
                Código de Rastreio
                <input
                  type="text"
                  name="codigoRastreio"
                  defaultValue={selectedRow.codigoRastreio ?? ""}
                  placeholder="Código de rastreio..."
                  style={{
                    width: "100%",
                    padding: "8px",
                    marginTop: "4px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "4px",
                    fontSize: "0.9rem",
                    boxSizing: "border-box"
                  }}
                />
              </label>

              {/* Values */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <label style={{ fontSize: "0.9rem", fontWeight: "500" }}>
                  Valor de Reembolso
                  <input
                    type="number"
                    name="valorReembolso"
                    defaultValue={selectedRow.valorReembolso}
                    step="0.01"
                    min="0"
                    placeholder="R$ 0,00"
                    style={{
                      width: "100%",
                      padding: "8px",
                      marginTop: "4px",
                      border: "1px solid #e2e8f0",
                      borderRadius: "4px",
                      fontSize: "0.9rem",
                      boxSizing: "border-box"
                    }}
                  />
                </label>
                <label style={{ fontSize: "0.9rem", fontWeight: "500" }}>
                  Valor de Assistência
                  <input
                    type="number"
                    name="valorAssistencia"
                    defaultValue={selectedRow.valorAssistencia ?? 0}
                    step="0.01"
                    min="0"
                    placeholder="R$ 0,00"
                    style={{
                      width: "100%",
                      padding: "8px",
                      marginTop: "4px",
                      border: "1px solid #e2e8f0",
                      borderRadius: "4px",
                      fontSize: "0.9rem",
                      boxSizing: "border-box"
                    }}
                  />
                </label>
              </div>

              <label style={{ fontSize: "0.9rem", fontWeight: "500" }}>
                Valor de Coleta, Envio ou Peças
                <input
                  type="number"
                  name="valorColetaEnvioPecas"
                  defaultValue={selectedRow.valorColetaEnvioPecas}
                  step="0.01"
                  min="0"
                  placeholder="R$ 0,00"
                  style={{
                    width: "100%",
                    padding: "8px",
                    marginTop: "4px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "4px",
                    fontSize: "0.9rem",
                    boxSizing: "border-box"
                  }}
                />
              </label>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={isSaving}
                style={{ marginTop: "8px" }}
              >
                {isSaving ? "Salvando..." : "Salvar Alterações"}
              </button>
            </form>

            {/* Upload Section */}
            <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #e2e8f0" }}>
              <h4 style={{ margin: "0 0 12px 0", fontSize: "0.95rem", fontWeight: "500" }}>
                {selectedRow.anexo ? "Substituir Anexo" : "Adicionar Anexo"}
              </h4>
              <form onSubmit={handleUploadAttachment} style={{ display: "grid", gap: "8px" }}>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  style={{
                    padding: "8px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "4px",
                    fontSize: "0.9rem"
                  }}
                />
                <button
                  type="submit"
                  className="btn btn-secondary btn-block"
                >
                  Fazer Upload
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
