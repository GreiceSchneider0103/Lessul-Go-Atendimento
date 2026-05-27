"use client";
import Link from "next/link";
import { TicketListResponse } from "@/lib/contracts";
import { formatCurrencyBR, formatDateBR, formatEnumLabel } from "@/lib/formatters/display";
import { Motivo, StatusReclamacao, StatusTicket } from "@prisma/client";

type Ticket = TicketListResponse["data"][number];

const STATUS_TICKET_LABELS: Record<string, string> = {
  ABERTO: "Aberto",
  AGUARDANDO_CLIENTE: "Aguardando Cliente",
  AGUARDANDO_DEVOLUCAO: "Aguardando Devolução",
  AGUARDANDO_ASSISTENCIA: "Aguardando Assistência",
  AGUARDANDO_MARKETPLACE: "Aguardando Marketplace",
  CONCLUIDO: "Concluído",
};

const STATUS_RECLAMACAO_LABELS: Record<string, string> = {
  AFETANDO: "Afetando",
  NAO_AFETANDO: "Não Afetando",
  REMOVIDA: "Removida",
};

const MOTIVO_LABELS: Record<string, string> = {
  DESISTENCIA: "Desistência",
  DEFEITO_FABRICACAO: "Defeito Fabricação",
  PRODUTO_INCORRETO: "Produto Incorreto",
  FALTANDO_ITENS: "Faltando Itens",
  PRODUTO_DANIFICADO: "Produto Danificado",
  PROBLEMA: "Problema",
};

export function TicketListTable({ initialItems }: { initialItems: Ticket[] }) {
  // Placeholder for inline editing logic - not implemented in this diff
  const handleSelectChange = async (ticketId: string, field: string, value: string) => {
    console.log(`Updating ticket ${ticketId}, field ${field} to ${value}`);
    // In a real scenario, this would trigger an API call (e.g., PATCH /api/tickets/{ticketId})
    // For now, it just logs.
  };

  return (
    <div className="table-wrap" style={{ overflowX: 'auto' }}>
      <table className="table" style={{ minWidth: '1000px' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>SLA</th>
            <th>Cliente</th>
            <th>Venda</th>
            <th>Empresa</th>
            <th>Marketplace</th>
            <th>Motivo</th>
            <th>Status Ticket</th>
            <th>Status Reclamação</th>
            <th>Responsável</th>
            <th>Custos</th>
            <th>Criado em</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {initialItems.length === 0 ? (
            <tr>
              <td colSpan={13} className="muted" style={{ textAlign: 'center', padding: '20px' }}>
                Nenhum ticket encontrado com os filtros atuais.
              </td>
            </tr>
          ) : (
            initialItems.map((ticket) => {
              const isSlaAtrasado = ticket.slaStatus === "ATRASADO";
              return (
                <tr key={ticket.id}>
                  <td>{ticket.id.slice(0, 8)}...</td>
                  <td>
                    <span
                      className="sla-indicator"
                      title={isSlaAtrasado ? "Atrasado" : "No prazo"}
                      style={{
                        display: 'inline-block',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: isSlaAtrasado ? '#ef4444' : '#22c55e',
                        verticalAlign: 'middle',
                        marginRight: '6px',
                      }}
                    ></span>
                  </td>
                  <td>{ticket.nomeCliente}</td>
                  <td>{ticket.numeroVenda}</td>
                  <td>{formatEnumLabel(ticket.empresa)}</td>
                  <td>{ticket.canalMarketplace}</td>
                  <td>
                    <select
                      name="motivo"
                      defaultValue={ticket.motivo}
                      onChange={(e) => handleSelectChange(ticket.id, "motivo", e.target.value)}
                      style={{ fontSize: '0.85rem', padding: '4px 8px', minWidth: '120px' }}
                    >
                      {Object.values(Motivo).map((m) => (
                        <option key={m} value={m}>{MOTIVO_LABELS[m] ?? formatEnumLabel(m)}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      name="statusTicket"
                      defaultValue={ticket.statusTicket}
                      onChange={(e) => handleSelectChange(ticket.id, "statusTicket", e.target.value)}
                      style={{ fontSize: '0.85rem', padding: '4px 8px', minWidth: '140px' }}
                    >
                      {Object.values(StatusTicket).map((s) => (
                        <option key={s} value={s}>{STATUS_TICKET_LABELS[s] ?? formatEnumLabel(s)}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      name="statusReclamacao"
                      defaultValue={ticket.statusReclamacao}
                      onChange={(e) => handleSelectChange(ticket.id, "statusReclamacao", e.target.value)}
                      style={{ fontSize: '0.85rem', padding: '4px 8px', minWidth: '120px' }}
                    >
                      {Object.values(StatusReclamacao).map((sr) => (
                        <option key={sr} value={sr}>{STATUS_RECLAMACAO_LABELS[sr] ?? formatEnumLabel(sr)}</option>
                      ))}
                    </select>
                  </td>
                  <td>{(ticket as any).responsavel?.nome ?? "N/A"}</td>
                  <td>{formatCurrencyBR(Number(ticket.custosTotais))}</td>
                  <td>{formatDateBR(ticket.criadoEm)}</td>
                  <td>
                    <Link href={`/tickets/${ticket.id}`} className="btn btn-sm btn-secondary">
                      Ver
                    </Link>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}