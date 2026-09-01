"use client";

import { useState } from "react";
import { Perfil } from "@prisma/client";
import { FileText, SlidersHorizontal, X } from "lucide-react";
import { formatDateTimeBR, formatEnumLabel } from "@/lib/formatters/display";

type ComentarioRow = {
  id: string;
  autorNome: string | null;
  autorPerfil: string | null;
  comentario: string;
  criadoEm: string;
};

type AnexoRow = {
  id: string;
  fileName: string;
  mimeType: string | null;
};

export type SupportTicketRow = {
  id: string;
  empresa: string;
  categoria: string;
  titulo: string;
  descricao: string;
  status: string;
  prazoResposta: string;
  slaStatus: string;
  responsavel: { id: string; nome: string } | null;
  criadoPor: { id: string; nome: string } | null;
  criadoEm: string;
  atualizadoEm: string;
  concluidoEm: string | null;
  comentarios: ComentarioRow[];
  anexos: AnexoRow[];
};

const STATUS_OPTIONS = ["ABERTO", "EM_ANDAMENTO", "AGUARDANDO_LOJA", "CONCLUIDO"];

function isAtrasado(row: SupportTicketRow) {
  return row.status !== "CONCLUIDO" && new Date(row.prazoResposta) < new Date();
}

export function SupportTicketsPanel({
  data,
  perfil,
  assignableUsers
}: {
  data: SupportTicketRow[];
  perfil: Perfil;
  assignableUsers: Array<{ id: string; nome: string }>;
}) {
  const [rows, setRows] = useState(data);
  const [selected, setSelected] = useState<SupportTicketRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const isStaff = perfil !== "LOJA";

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;

    setIsSaving(true);
    setNotice(null);

    try {
      const formData = new FormData(event.currentTarget);
      const payload: Record<string, unknown> = {};

      const status = formData.get("status");
      if (typeof status === "string" && status) payload.status = status;

      const responsavelId = formData.get("responsavelId");
      if (responsavelId !== null) payload.responsavelId = responsavelId === "" ? null : responsavelId;

      const comentario = formData.get("comentario");
      if (typeof comentario === "string" && comentario.trim()) payload.comentario = comentario;

      const response = await fetch(`/api/support/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const body = await response.json();

      if (!response.ok) {
        setNotice({ type: "error", message: body?.message ?? "Falha ao atualizar o chamado." });
        return;
      }

      const updated: SupportTicketRow = body.data;
      setRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));
      setSelected(updated);
      setNotice({ type: "success", message: "Chamado atualizado com sucesso." });
      (event.target as HTMLFormElement).reset();
    } catch (error) {
      setNotice({ type: "error", message: "Erro ao salvar: " + (error instanceof Error ? error.message : String(error)) });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;

    const file = (event.currentTarget.querySelector('input[type="file"]') as HTMLInputElement)?.files?.[0];
    if (!file) {
      setNotice({ type: "error", message: "Selecione um arquivo." });
      return;
    }

    setNotice(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/support/${selected.id}/attachments`, { method: "POST", body: formData });
      const body = await response.json();

      if (!response.ok) {
        setNotice({ type: "error", message: body?.message ?? "Falha no upload." });
        return;
      }

      const anexo: AnexoRow = { id: body.data.id, fileName: body.data.fileName, mimeType: body.data.mimeType };
      setSelected((current) => (current ? { ...current, anexos: [...current.anexos, anexo] } : current));
      setRows((current) => current.map((row) => (row.id === selected.id ? { ...row, anexos: [...row.anexos, anexo] } : row)));
      setNotice({ type: "success", message: "Anexo enviado com sucesso." });
      (event.target as HTMLFormElement).reset();
    } catch (error) {
      setNotice({ type: "error", message: "Erro no upload: " + (error instanceof Error ? error.message : String(error)) });
    }
  }

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
              {isStaff ? <th>Empresa</th> : null}
              <th>Título</th>
              <th>Categoria</th>
              <th>Status</th>
              <th>Prazo</th>
              <th>Responsável</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={isStaff ? 7 : 6} className="muted">
                  Nenhum chamado encontrado.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const atrasado = isAtrasado(row);

                return (
                  <tr key={row.id}>
                    {isStaff ? <td>{formatEnumLabel(row.empresa)}</td> : null}
                    <td>{row.titulo}</td>
                    <td>{formatEnumLabel(row.categoria)}</td>
                    <td>
                      {atrasado ? (
                        <span className="badge badge-danger">Atrasado</span>
                      ) : (
                        <span className="badge badge-info">{formatEnumLabel(row.status)}</span>
                      )}
                    </td>
                    <td>{formatDateTimeBR(row.prazoResposta)}</td>
                    <td>{row.responsavel?.nome ?? "-"}</td>
                    <td>
                      <button className="btn btn-secondary whitespace-nowrap px-3 py-1.5 text-xs" onClick={() => setSelected(row)}>
                        <SlidersHorizontal size={13} strokeWidth={2.25} aria-hidden />
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {selected ? <div className="fixed inset-0 z-[999] cursor-pointer bg-black/50" onClick={() => setSelected(null)} /> : null}

      {selected ? (
        <div
          className="fixed right-0 top-0 z-[1000] flex h-screen w-[680px] max-w-[92vw] flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-[-2px_0_8px_rgba(0,0,0,0.1)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="sticky top-0 z-[1001] flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4">
            <h3 className="m-0 text-lg font-bold text-slate-800">{selected.titulo}</h3>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="flex h-8 w-8 items-center justify-center rounded-md bg-transparent p-0 text-slate-500 hover:bg-slate-100"
            >
              <X size={18} strokeWidth={2.25} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-3">
              <fieldset className="rounded-lg border border-slate-200 p-3">
                <legend className="px-1 text-xs font-bold text-slate-500">Chamado</legend>
                <div className="grid gap-1.5 text-sm">
                  <div><strong>Empresa:</strong> {formatEnumLabel(selected.empresa)}</div>
                  <div><strong>Categoria:</strong> {formatEnumLabel(selected.categoria)}</div>
                  <div><strong>Aberto por:</strong> {selected.criadoPor?.nome ?? "-"}</div>
                  <div><strong>Aberto em:</strong> {formatDateTimeBR(selected.criadoEm)}</div>
                </div>
              </fieldset>

              <fieldset className="rounded-lg border border-slate-200 p-3">
                <legend className="px-1 text-xs font-bold text-slate-500">Prazo</legend>
                <div className="grid gap-1.5 text-sm">
                  <div>
                    <strong>Responder até:</strong>{" "}
                    <span style={{ color: isAtrasado(selected) ? "#cf1322" : "#389e0d", fontWeight: 700 }}>
                      {formatDateTimeBR(selected.prazoResposta)}
                    </span>
                  </div>
                  <div><strong>Última atualização:</strong> {formatDateTimeBR(selected.atualizadoEm)}</div>
                  {selected.concluidoEm ? <div><strong>Concluído em:</strong> {formatDateTimeBR(selected.concluidoEm)}</div> : null}
                </div>
              </fieldset>
            </div>

            <fieldset className="mt-3 rounded-lg border border-slate-200 p-3">
              <legend className="px-1 text-xs font-bold text-slate-500">Descrição</legend>
              <p className="whitespace-pre-wrap text-sm">{selected.descricao}</p>
            </fieldset>

            {selected.anexos.length > 0 ? (
              <fieldset className="mt-3 rounded-lg border border-slate-200 p-3">
                <legend className="px-1 text-xs font-bold text-slate-500">Anexos ({selected.anexos.length})</legend>
                <div className="grid grid-cols-4 gap-2">
                  {selected.anexos.map((anexo) => {
                    const viewUrl = `/api/support/attachments/${anexo.id}/view`;
                    return (
                      <a key={anexo.id} href={viewUrl} target="_blank" rel="noopener noreferrer" title={anexo.fileName}>
                        {anexo.mimeType?.startsWith("image/") ? (
                          <img src={viewUrl} alt={anexo.fileName} className="h-24 w-full rounded-md border border-slate-200 object-cover" />
                        ) : (
                          <div className="flex h-24 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-[#d32f2f]">
                            <FileText size={22} strokeWidth={1.75} />
                          </div>
                        )}
                      </a>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}

            <fieldset className="mt-3 rounded-lg border border-slate-200 p-3">
              <legend className="px-1 text-xs font-bold text-slate-500">Conversa</legend>
              {selected.comentarios.length === 0 ? (
                <p className="muted">Nenhum comentário ainda.</p>
              ) : (
                <div className="grid gap-2">
                  {selected.comentarios.map((comentario) => (
                    <div key={comentario.id} className="rounded-md bg-slate-50 p-2.5 text-sm">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <strong>{comentario.autorNome ?? "Usuário"}</strong>
                        <span className="text-xs text-slate-400">{formatDateTimeBR(comentario.criadoEm)}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{comentario.comentario}</p>
                    </div>
                  ))}
                </div>
              )}
            </fieldset>

            <form onSubmit={handleSave} className="mt-3 grid gap-3">
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-600">
                Adicionar comentário
                <textarea name="comentario" rows={3} placeholder="Escreva uma resposta..." />
              </label>

              {isStaff ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-600">
                    Status
                    <select name="status" defaultValue={selected.status}>
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {formatEnumLabel(status)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-600">
                    Responsável
                    <select name="responsavelId" defaultValue={selected.responsavel?.id ?? ""}>
                      <option value="">Sem responsável</option>
                      {assignableUsers.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}

              <button type="submit" className="btn btn-primary w-full" disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar"}
              </button>
            </form>

            <div className="mt-4 border-t border-slate-200 pt-4">
              <h4 className="mb-3 text-sm font-semibold text-slate-700">Adicionar anexo</h4>
              <form onSubmit={handleUpload} className="grid gap-2">
                <input type="file" accept="image/*,application/pdf" className="text-sm" />
                <button type="submit" className="btn btn-secondary w-full">
                  Fazer upload
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
