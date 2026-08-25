"use client";

import { useState } from "react";
import Link from "next/link";
import { TicketListResponse } from "@/lib/contracts";
import { formatEnumLabel } from "@/lib/formatters/display";

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
      {error ? <div className="alert alert-error mb-3">{error}</div> : null}

      <div className="table-wrap overflow-x-auto">
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
              <th style={{ width: 48 }}>SLA</th>
            </tr>
          </thead>

          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted text-center" style={{ padding: 20 }}>
                  Nenhum ticket encontrado com os filtros atuais.
                </td>
              </tr>
            ) : (
              items.map((ticket) => {
                const isSlaAtrasado = ticket.slaStatus === "ATRASADO";
                const marketplaceConfig = MARKETPLACE_CONFIG[ticket.canalMarketplace] ?? MARKETPLACE_CONFIG.OUTRO;
                const statusReclamacaoConfig =
                  STATUS_RECLAMACAO_CONFIG[ticket.statusReclamacao] ?? STATUS_RECLAMACAO_CONFIG.REMOVIDA;
                const isCobranca = ticket.statusOperacionalLoja === "DEVOLUCAO_RECEBIDA";

                return (
                  <tr key={ticket.id}>
                    <td>
                      <Link
                        href={`/tickets/${ticket.id}`}
                        title="Abrir ticket"
                        className="font-bold text-slate-900 no-underline hover:text-brand-700 hover:underline"
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
                          title="Abrir pedido no marketplace"
                          className="font-semibold text-slate-900 hover:text-brand-700 hover:underline"
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
                        className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold"
                        style={{
                          backgroundColor: marketplaceConfig.bg,
                          color: marketplaceConfig.color,
                          border: `1px solid ${marketplaceConfig.border}`
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
                        className="min-w-[132px] max-w-[150px] px-2 py-1 text-[0.78rem]"
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
                        className="min-w-[150px] max-w-[170px] rounded-lg px-2 py-1 text-[0.78rem]"
                        style={
                          isCobranca
                            ? { backgroundColor: "#fff1f0", color: "#b42318", border: "1px solid #ffccc7", fontWeight: 700 }
                            : undefined
                        }
                        title={isCobranca ? "Cobrar" : formatEnumLabel(ticket.statusTicket)}
                      >
                        {STATUS_TICKET.map((status) => (
                          <option key={status} value={status}>
                            {isCobranca && status === ticket.statusTicket ? "Cobrar" : formatEnumLabel(status)}
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
                        className="min-w-[130px] max-w-[150px] rounded-lg px-2 py-1 text-[0.78rem] font-semibold"
                        style={{
                          backgroundColor: statusReclamacaoConfig.bg,
                          color: statusReclamacaoConfig.color,
                          border: `1px solid ${statusReclamacaoConfig.border}`
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

                    <td>
                      <span
                        className="inline-block h-3 w-3 rounded-full align-middle"
                        title={isSlaAtrasado ? "Atrasado" : "No prazo"}
                        aria-label={isSlaAtrasado ? "Atrasado" : "No prazo"}
                        style={{ backgroundColor: isSlaAtrasado ? "#ef4444" : "#22c55e" }}
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