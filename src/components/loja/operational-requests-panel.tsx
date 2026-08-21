"use client";
import { useState } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { Perfil, StatusOperacional } from "@prisma/client";
import { X, FileText, Paperclip, Upload } from "lucide-react";
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
    if (!row.anexo) return <span className="text-[0.85rem] text-slate-400">Sem anexo</span>;

    const isImage = row.anexo.mimeType?.startsWith("image/");
    const isPDF = row.anexo.mimeType === "application/pdf";
    const attachmentViewUrl = `/api/tickets/${row.ticketId}/attachment/view`;

    return (
      <a href={attachmentViewUrl} target="_blank" rel="noopener noreferrer" title="Ver anexo">
        {isImage ? (
          <img
            src={attachmentViewUrl}
            alt="Anexo"
            className="h-10 w-10 rounded-md border border-slate-200 object-cover"
          />
        ) : (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-slate-50"
            style={{ color: isPDF ? "#d32f2f" : "#64748b" }}
          >
            {isPDF ? <FileText size={16} strokeWidth={2.25} /> : <Paperclip size={16} strokeWidth={2.25} />}
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
          className="alert mb-3"
          style={{
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
                  <td><span className="badge badge-info">{formatEnumLabel(row.tipoAcao)}</span></td>
                  <td>{formatEnumLabel(row.status)}</td>
                  <td>
                    {row.prazoOperacional ? (
                      <span
                        className="rounded px-2 py-1 text-[0.85rem] font-medium"
                        style={{
                          backgroundColor: isAtrasado ? "#fff1f0" : "#f6ffed",
                          color: isAtrasado ? "#cf1322" : "#389e0d",
                          border: `1px solid ${isAtrasado ? "#ffa39e" : "#b7eb8f"}`
                        }}
                      >
                        {formatDateBR(new Date(row.prazoOperacional))}
                      </span>
                    ) : '-'}
                  </td>
                  <td>{renderAnexoThumbnail(row)}</td>
                  <td>
                    <button
                      className="btn btn-secondary px-3 py-1.5 text-xs"
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
          className="fixed inset-0 z-[999] cursor-pointer bg-black/50"
          onClick={() => setSelectedRow(null)}
        />
      )}

      {/* Drawer */}
      {selectedRow && (
        <div
          className="fixed right-0 top-0 z-[1000] flex h-screen w-[420px] max-w-[92vw] flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-[-2px_0_8px_rgba(0,0,0,0.1)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-[1001] flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4">
            <h3 className="m-0 text-lg font-bold text-slate-800">Dados Complementares</h3>
            <button
              type="button"
              onClick={() => setSelectedRow(null)}
              className="flex h-8 w-8 items-center justify-center rounded-md bg-transparent p-0 text-slate-500 hover:bg-slate-100"
            >
              <X size={18} strokeWidth={2.25} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <form onSubmit={handleSaveDrawer} className="grid gap-3">
              {/* Client Info */}
              <fieldset className="rounded-lg border border-slate-200 p-3">
                <legend className="px-1 text-xs font-bold text-slate-500">
                  Informações do Cliente
                </legend>
                <div className="grid gap-2">
                  <div className="text-sm">
                    <strong>Cliente:</strong> {selectedRow.ticket.nomeCliente}
                  </div>
                  <div className="text-sm">
                    <strong>Número do Pedido:</strong>
                    {selectedRow.ticket.linkPedido ? (
                      <a
                        href={selectedRow.ticket.linkPedido}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 font-semibold text-brand-700 hover:underline"
                      >
                        {selectedRow.ticket.numeroVenda}
                      </a>
                    ) : (
                      <span className="ml-2">{selectedRow.ticket.numeroVenda}</span>
                    )}
                  </div>
                </div>
              </fieldset>

              {/* Product Info */}
              <fieldset className="rounded-lg border border-slate-200 p-3">
                <legend className="px-1 text-xs font-bold text-slate-500">
                  Informações do Produto
                </legend>
                <div className="grid gap-2">
                  <div className="text-sm">
                    <strong>SKU:</strong> {selectedRow.ticket.sku}
                  </div>
                  <div className="text-sm">
                    <strong>Produto:</strong> {selectedRow.ticket.produto}
                  </div>
                </div>
              </fieldset>

              {/* Attachment */}
              <fieldset className="rounded-lg border border-slate-200 p-3">
                <legend className="px-1 text-xs font-bold text-slate-500">
                  Anexo
                </legend>
                {selectedRow.anexo ? (
                  <div className="mb-2 text-center">
                    {selectedRow.anexo.mimeType?.startsWith("image/") ? (
                      <img
                        src={`/api/tickets/${selectedRow.ticketId}/attachment/view`}
                        alt="Anexo"
                        className="max-h-[200px] max-w-full rounded-md border border-slate-200"
                      />
                    ) : selectedRow.anexo.mimeType === "application/pdf" ? (
                      <div className="flex items-center justify-center rounded-md border border-slate-200 bg-slate-50 p-6 text-[#d32f2f]">
                        <FileText size={40} strokeWidth={1.75} />
                      </div>
                    ) : (
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-6 text-sm">
                        Arquivo: {selectedRow.anexo.fileName}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mb-2 text-sm text-slate-400">
                    Sem anexo
                  </div>
                )}
              </fieldset>

              {/* Details */}
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-600">
                Detalhes do Cliente
                <textarea
                  name="detalhesCliente"
                  defaultValue={selectedRow.ticket.detalhesCliente ?? ""}
                  rows={3}
                  placeholder="Observações sobre o cliente..."
                />
              </label>

              {/* Commentary */}
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-600">
                Comentário da Loja
                <textarea
                  name="comentarioLoja"
                  defaultValue={selectedRow.ticket.comentarioLoja ?? ""}
                  rows={3}
                  placeholder="Observações da loja..."
                />
              </label>

              {/* Action */}
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-600">
                Ação Operacional da Loja
                <select name="acaoOperacionalLoja" defaultValue={selectedRow.ticket.acaoOperacionalLoja}>
                  {acoesOptions.map((opcao) => (
                    <option key={opcao} value={opcao}>
                      {formatEnumLabel(opcao)}
                    </option>
                  ))}
                </select>
              </label>

              {/* Resolution */}
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-600">
                Resolução
                <select name="resolucao" defaultValue={selectedRow.ticket.resolucao ?? ""}>
                  <option value="">Sem resolução</option>
                  {resolucoesOptions.map((opcao) => (
                    <option key={opcao} value={opcao}>
                      {formatEnumLabel(opcao)}
                    </option>
                  ))}
                </select>
              </label>

              {/* Status */}
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-600">
                Status Operacional da Loja
                <select name="statusOperacionalLoja" defaultValue={selectedRow.ticket.statusOperacionalLoja}>
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
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-600">
                Código de Rastreio
                <input
                  type="text"
                  name="codigoRastreio"
                  defaultValue={selectedRow.codigoRastreio ?? ""}
                  placeholder="Código de rastreio..."
                />
              </label>

              {/* Values */}
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-600">
                  Valor de Reembolso
                  <input
                    type="number"
                    name="valorReembolso"
                    defaultValue={selectedRow.valorReembolso}
                    step="0.01"
                    min="0"
                    placeholder="R$ 0,00"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-600">
                  Valor de Assistência
                  <input
                    type="number"
                    name="valorAssistencia"
                    defaultValue={selectedRow.valorAssistencia ?? 0}
                    step="0.01"
                    min="0"
                    placeholder="R$ 0,00"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-600">
                Valor de Coleta, Envio ou Peças
                <input
                  type="number"
                  name="valorColetaEnvioPecas"
                  defaultValue={selectedRow.valorColetaEnvioPecas}
                  step="0.01"
                  min="0"
                  placeholder="R$ 0,00"
                />
              </label>

              <button type="submit" className="btn btn-primary mt-2 w-full" disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar Alterações"}
              </button>
            </form>

            {/* Upload Section */}
            <div className="mt-4 border-t border-slate-200 pt-4">
              <h4 className="mb-3 text-sm font-semibold text-slate-700">
                {selectedRow.anexo ? "Substituir Anexo" : "Adicionar Anexo"}
              </h4>
              <form onSubmit={handleUploadAttachment} className="grid gap-2">
                <input type="file" accept="image/*,application/pdf" className="text-sm" />
                <button type="submit" className="btn btn-secondary w-full">
                  <Upload size={15} strokeWidth={2.25} aria-hidden />
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
