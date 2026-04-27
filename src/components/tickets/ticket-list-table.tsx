"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ticket } from "@prisma/client";
import { MOTIVOS, STATUS_RECLAMACAO, STATUS_TICKET } from "@/config/domains";
import { formatEnumLabel } from "@/lib/formatters/display";
import { StatusBadge } from "@/components/ui/status-badge";

type EditableField = "motivo" | "statusTicket" | "statusReclamacao" | "prazoConclusao";

function toDateInput(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function TicketListTable({ initialItems }: { initialItems: Ticket[] }) {
  const [items, setItems] = useState<Ticket[]>(Array.isArray(initialItems) ? initialItems : []);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const motivoOptions = useMemo(() => MOTIVOS.map((value) => ({ value, label: formatEnumLabel(value) })), []);
  const statusTicketOptions = useMemo(() => STATUS_TICKET.map((value) => ({ value, label: formatEnumLabel(value) })), []);
  const statusReclamacaoOptions = useMemo(() => STATUS_RECLAMACAO.map((value) => ({ value, label: formatEnumLabel(value) })), []);

  async function updateField(ticketId: string, field: EditableField, value: string | null) {
    setError(null);
    setSavingId(ticketId);

    const previous = items;
    setItems((current) => current.map((item) => (item.id === ticketId ? { ...item, [field]: value } : item)));

    const body = field === "prazoConclusao" ? { prazoConclusao: value || null } : { [field]: value };

    const response = await fetch(`/api/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setItems(previous);
      setError(payload.message ?? "Não foi possível atualizar o ticket na lista.");
    }

    setSavingId(null);
  }

  if (!items.length) {
    return <div className="empty-state">Nenhum ticket encontrado para os filtros atuais.</div>;
  }

  return (
    <>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <table className="table">
        <thead>
          <tr>
            <th>Nome do cliente</th>
            <th>Link</th>
            <th>SKU</th>
            <th>Marketplace</th>
            <th>Empresa</th>
            <th>Motivo</th>
            <th>Status ticket</th>
            <th>Status reclamação</th>
            <th>Prazo</th>
            <th>SLA</th>
            <th>Custos totais</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isSaving = savingId === item.id;

            return (
              <tr key={item.id}>
                <td><Link href={`/tickets/${item.id}`}>{item.nomeCliente}</Link></td>
                <td>
                  {item.linkPedido ? (
                    <a href={item.linkPedido} target="_blank" rel="noreferrer">Link</a>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>{item.sku}</td>
                <td><StatusBadge value={item.canalMarketplace} context="marketplace" /></td>
                <td><StatusBadge value={item.empresa} context="empresa" /></td>
                <td>
                  <select
                    value={item.motivo}
                    onChange={(e) => updateField(item.id, "motivo", e.target.value)}
                    disabled={isSaving}
                    aria-label={`Motivo do ticket ${item.nomeCliente}`}
                  >
                    {motivoOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    value={item.statusTicket}
                    onChange={(e) => updateField(item.id, "statusTicket", e.target.value)}
                    disabled={isSaving}
                    aria-label={`Status ticket de ${item.nomeCliente}`}
                  >
                    {statusTicketOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    value={item.statusReclamacao}
                    onChange={(e) => updateField(item.id, "statusReclamacao", e.target.value)}
                    disabled={isSaving}
                    aria-label={`Status reclamação de ${item.nomeCliente}`}
                  >
                    {statusReclamacaoOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </td>
                <td>
                  <input
                    type="date"
                    value={toDateInput(item.prazoConclusao as unknown as string)}
                    onChange={(e) => updateField(item.id, "prazoConclusao", e.target.value || null)}
                    disabled={isSaving}
                    aria-label={`Prazo de ${item.nomeCliente}`}
                  />
                </td>
                <td><StatusBadge value={item.slaStatus} /></td>
                <td>{Number(item.custosTotais).toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted" style={{ marginTop: 8 }}>Alterações feitas nas colunas são salvas automaticamente.</p>
    </>
  );
}
