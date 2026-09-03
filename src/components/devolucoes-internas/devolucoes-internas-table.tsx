"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { formatCurrencyBR, formatEnumLabel } from "@/lib/formatters/display";

type Row = {
  id: string;
  numero: number;
  codigoVenda: string;
  cliente: string;
  canalMarketplace: string;
  produto: string;
  sku: string | null;
  defeito: string;
  dataRecebimento: string;
  solucao: string | null;
  solicitadoReembolso: boolean;
  valorRecuperado: number;
};

export function DevolucoesInternasTable({ items, canManage }: { items: Row[]; canManage: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState(items);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Excluir este registro de devolução? Essa ação não pode ser desfeita.")) return;

    setDeletingId(id);
    setError(null);

    const response = await fetch(`/api/devolucoes-internas/${id}`, { method: "DELETE" });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body?.message ?? "Falha ao excluir o registro.");
      setDeletingId(null);
      return;
    }

    setRows((current) => current.filter((row) => row.id !== id));
    setDeletingId(null);
    router.refresh();
  }

  return (
    <div className="panel table-wrap">
      {error ? <p className="field-error mb-2">{error}</p> : null}
      <table className="table">
        <thead>
          <tr>
            <th>Nº</th>
            <th>Recebido em</th>
            <th>Cliente</th>
            <th>Canal</th>
            <th>Produto</th>
            <th>SKU</th>
            <th>Defeito</th>
            <th>Solução</th>
            <th>Reembolso</th>
            <th>Valor recuperado</th>
            {canManage ? <th>Ações</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={canManage ? 11 : 10} className="muted">Nenhum registro encontrado.</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td>{row.numero}</td>
                <td>{row.dataRecebimento}</td>
                <td>{row.cliente}</td>
                <td>{formatEnumLabel(row.canalMarketplace)}</td>
                <td>{row.produto}</td>
                <td>{row.sku ?? "-"}</td>
                <td>{formatEnumLabel(row.defeito)}</td>
                <td>{row.solucao ? formatEnumLabel(row.solucao) : "-"}</td>
                <td>{row.solicitadoReembolso ? <span className="badge badge-info">Sim</span> : "-"}</td>
                <td>{formatCurrencyBR(row.valorRecuperado)}</td>
                {canManage ? (
                  <td>
                    <div className="flex items-center gap-1.5">
                      <Link href={`/devolucoes-internas/${row.id}/editar`} className="btn btn-secondary px-2.5 py-1.5 text-xs">
                        <Pencil size={13} strokeWidth={2.25} aria-hidden />
                      </Link>
                      <button
                        type="button"
                        className="btn btn-danger px-2.5 py-1.5 text-xs"
                        disabled={deletingId === row.id}
                        onClick={() => handleDelete(row.id)}
                      >
                        <Trash2 size={13} strokeWidth={2.25} aria-hidden />
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
