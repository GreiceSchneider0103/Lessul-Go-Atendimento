"use client";

import { useState } from "react";
import Link from "next/link";
import { TicketListResponse } from "@/lib/contracts";
import { formatCurrencyBR, formatEnumLabel } from "@/lib/formatters/display";

type Ticket = TicketListResponse["data"][number];

type EditableTicketField = "motivo" | "statusTicket" | "statusReclamacao";

const MOTIVOS = [
  "DESISTENCIA",
  "DEFEITO_FABRICACAO",
  "PRODUTO_INCORRETO",
  "FALTANDO_ITENS",
  "PRODUTO_DANIFICADO",
  "PROBLEMA"
] as const;

const STATUS_TICKET = [
  "ABERTO",
  "AGUARDANDO_CLIENTE",
  "AGUARDANDO_DEVOLUCAO",
  "AGUARDANDO_ASSISTENCIA",
  "AGUARDANDO_MARKETPLACE",
  "CONCLUIDO"
] as const;

const STATUS_RECLAMACAO = ["AFETANDO", "NAO_AFETANDO", "REMOVIDA"] as const;

const STATUS_RECLAMACAO_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  AFETANDO: {
    color: "#b42318",
    bg: "#fff1f0",
    border: "#ffccc7"
  },
  NAO_AFETANDO: {
    color: "#1f7a3f",
    bg: "#f6ffed",
    border: "#b7eb8f"
  },
  REMOVIDA: {
    color: "#475467",
    bg: "#f2f4f7",
    border: "#d0d5dd"
  }
};

const MARKETPLACE_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  MERCADO_LIVRE: {
    color: "#0056b3",
    bg: "#eaf3ff",
    border: "#b8dcff"
  },
  MAGALU: {
    color: "#005bb5",
    bg: "#e3f2fd",
    border: "#bbdefb"
  },
  AMAZON: {
    color: "#232f3e",
    bg: "#f5f5f5",
    border: "#d9d9d9"
  },
  SHOPEE: {
    color: "#ee4d2d",
    bg: "#fff1ed",
    border: "#ffd0c2"
  },
  SITE_PROPRIO: {
    color: "#2e7d32",
    bg: "#e8f5e9",
    border: "#c8e6c9"
  },
  OUTRO: {
    color: "#5f6368",
    bg: "#f5f5f5",
    border: "#d9d9d9"
  }
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Erro ao atualizar ticket.";
}

export function TicketListTable({ initialItems }: { initialItems: Ticket[] }) {
  const [items, setItems] = useState<Ticket[]>(initialItems);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelectChange(ticketId: string, field: EditableTicketField, value: string) {
    setError(null);

    const previousItems = items;
    const key = `${ticketId}:${field}`;
    setSavingKey(key);

    setItems((currentItems) =>
      currentItems.map((ticket) =>
        ticket.id === ticketId
          ? {
              ...ticket,
              [field]: value
            }
          : ticket
      )
    );

    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          [field]: value
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? "Falha ao atualizar ticket.");
      }

      await response.json().catch(() => null);

      // Notificar outros componentes/abas sobre mudança de status para sincronizar a listagem operacional
      try {
        if (field === "statusTicket") {
          const bc = new BroadcastChannel("tickets-updates");
          bc.postMessage({ type: "status_change", ticketId, newStatus: value });
          bc.close();
        }
      } catch {
        // Ignore se BroadcastChannel não estiver disponível
      }
    } catch (updateError) {
      setItems(previousItems);
      setError(getErrorMessage(updateError));
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="ticket-list-table">
      {error ? (
        <div
          className="field-error"
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            border: "1px solid #fecaca",
            borderRadius: 8,
            background: "#fff1f2"
          }}
        >
          {error}
        </div>
      ) : null}

      <div className="table-wrap" style={{ overflowX: "auto" }}>
        <table className="table" style={{ minWidth: "980px" }}>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Venda</th>
              <th>Empresa</th>
              <th>Marketplace</th>
              <th>Motivo</th>
              <th>Status Ticket</th>
              <th>Status Reclamação</th>
              <th>Custos</th>
              <th style={{ width: 48 }}>SLA</th>
            </tr>
          </thead>

          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={9} className="muted" style={{ textAlign: "center", padding: 20 }}>
                  Nenhum ticket encontrado com os filtros atuais.
                </td>
              </tr>
            ) : (
              items.map((ticket) => {
                const isSlaAtrasado = ticket.slaStatus === "ATRASADO";
                const marketplaceConfig = MARKETPLACE_CONFIG[ticket.canalMarketplace] ?? MARKETPLACE_CONFIG.OUTRO;
                const statusReclamacaoConfig =
                  STATUS_RECLAMACAO_CONFIG[ticket.statusReclamacao] ?? STATUS_RECLAMACAO_CONFIG.REMOVIDA;

                return (
                  <tr key={ticket.id}>
                    <td>
                      <Link
                        href={`/tickets/${ticket.id}`}
                        title="Abrir ticket"
                        style={{
                          fontWeight: 700,
                          color: "#1d4ed8",
                          textDecoration: "none"
                        }}
                      >
                        {ticket.nomeCliente}
                      </Link>
                    </td>

                    <td>
                      {ticket.linkPedido ? (
                        <a
                          href={ticket.linkPedido}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link"
                          title="Abrir pedido no marketplace"
                          style={{ fontWeight: 600 }}
                        >
                          {ticket.numeroVenda}
                        </a>
                      ) : (
                        ticket.numeroVenda
                      )}
                    </td>

                    <td>{formatEnumLabel(ticket.empresa)}</td>

                    <td>
                      <span
                        style={{
                          backgroundColor: marketplaceConfig.bg,
                          color: marketplaceConfig.color,
                          border: `1px solid ${marketplaceConfig.border}`,
                          padding: "3px 10px",
                          borderRadius: 999,
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {formatEnumLabel(ticket.canalMarketplace)}
                      </span>
                    </td>

                    <td>
                      <select
                        name={`motivo-${ticket.id}`}
                        value={ticket.motivo}
                        disabled={savingKey === `${ticket.id}:motivo`}
                        onChange={(event) => handleSelectChange(ticket.id, "motivo", event.target.value)}
                        style={{
                          fontSize: "0.78rem",
                          padding: "4px 8px",
                          minWidth: 132,
                          maxWidth: 150
                        }}
                        title={formatEnumLabel(ticket.motivo)}
                      >
                        {MOTIVOS.map((motivo) => (
                          <option key={motivo} value={motivo}>
                            {formatEnumLabel(motivo)}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <select
                        name={`statusTicket-${ticket.id}`}
                        value={ticket.statusTicket}
                        disabled={savingKey === `${ticket.id}:statusTicket`}
                        onChange={(event) => handleSelectChange(ticket.id, "statusTicket", event.target.value)}
                        style={{
                          fontSize: "0.78rem",
                          padding: "4px 8px",
                          minWidth: 150,
                          maxWidth: 170
                        }}
                        title={formatEnumLabel(ticket.statusTicket)}
                      >
                        {STATUS_TICKET.map((status) => (
                          <option key={status} value={status}>
                            {formatEnumLabel(status)}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <select
                        name={`statusReclamacao-${ticket.id}`}
                        value={ticket.statusReclamacao}
                        disabled={savingKey === `${ticket.id}:statusReclamacao`}
                        onChange={(event) => handleSelectChange(ticket.id, "statusReclamacao", event.target.value)}
                        style={{
                          fontSize: "0.78rem",
                          padding: "4px 8px",
                          minWidth: 130,
                          maxWidth: 150,
                          backgroundColor: statusReclamacaoConfig.bg,
                          color: statusReclamacaoConfig.color,
                          border: `1px solid ${statusReclamacaoConfig.border}`,
                          borderRadius: 8,
                          fontWeight: 600
                        }}
                        title={formatEnumLabel(ticket.statusReclamacao)}
                      >
                        {STATUS_RECLAMACAO.map((status) => (
                          <option key={status} value={status}>
                            {formatEnumLabel(status)}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>{formatCurrencyBR(Number(ticket.custosTotais))}</td>

                    <td>
                      <span
                        className="sla-indicator"
                        title={isSlaAtrasado ? "Atrasado" : "No prazo"}
                        aria-label={isSlaAtrasado ? "Atrasado" : "No prazo"}
                        style={{
                          display: "inline-block",
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          backgroundColor: isSlaAtrasado ? "#ef4444" : "#22c55e",
                          verticalAlign: "middle"
                        }}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}